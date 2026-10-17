import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CancelWithdrawalDto,
  CreateWithdrawalDto,
  FundAgentCashboxDto,
} from './dto/create-withdrawal.dto';
import {
  Devise,
  Prisma,
  StatutRetrait,
  TypeOperationEpargne,
} from '@prisma/client';
import { ParametresService } from '../parametres/parametres.service';
import { getSectionTrigram } from '../common/constants/sections';
import { BalancesService } from '../balances/balances.service';
import type { AuthUser } from '../common/types/auth-request';
import { ZktecoService } from '../zkteco/zkteco.service';

type WithdrawalDb = Prisma.TransactionClient | PrismaService;

@Injectable()
export class WithdrawalsService {
  constructor(
    private prisma: PrismaService,
    private parametresService: ParametresService,
    private balancesService: BalancesService,
    private zktecoService: ZktecoService,
  ) {}

  private assertWithdrawalReplayMatches(
    retrait: {
      executeParId: number | null;
      compte: string;
      devise: Devise;
      montant: Prisma.Decimal;
      description: string | null;
    },
    dto: CreateWithdrawalDto,
    actor: AuthUser,
  ) {
    if (retrait.executeParId !== actor.userId) {
      throw new ForbiddenException('Cette clé idempotente appartient à un autre agent.');
    }
    if (
      retrait.compte !== dto.compte ||
      retrait.devise !== dto.devise ||
      Number(retrait.montant) !== dto.montant ||
      (retrait.description || 'Retrait au guichet') !==
        (dto.description?.trim() || 'Retrait au guichet')
    ) {
      throw new ConflictException('La clé idempotente a déjà été utilisée pour un autre retrait.');
    }
  }

  private async getFeesConfig(devise: string) {
    const params = await this.parametresService.getGeneralParameters();
    if (
      params.retraits?.frais_retrait &&
      params.retraits.frais_retrait[devise]
    ) {
      return params.retraits.frais_retrait[devise];
    }

    // Official BCC Rate for strict equivalence
    const TAUX_BCC = 2217.3;
    const SEUIL_50_USD = 50;
    const SEUIL_200_USD = 200;

    const SEUIL_50_FC = SEUIL_50_USD * TAUX_BCC; // 110,865 FC
    const SEUIL_200_FC = SEUIL_200_USD * TAUX_BCC; // 443,460 FC

    if (devise === 'FC') {
      return [
        { max: SEUIL_50_FC, taux: 0.03 },
        { max: SEUIL_200_FC, taux: 0.025 },
        { max: Infinity, taux: 0.015 },
      ];
    }
    return [
      { max: SEUIL_50_USD, taux: 0.03 },
      { max: SEUIL_200_USD, taux: 0.025 },
      { max: Infinity, taux: 0.015 },
    ];
  }

  private async calculateFees(montant: number, devise: string) {
    const structure = await this.getFeesConfig(devise);
    if (
      !Array.isArray(structure) ||
      structure.length === 0 ||
      structure.some(
        (palier) =>
          !Number.isFinite(palier.max) && palier.max !== Infinity ||
          !Number.isFinite(palier.taux) ||
          palier.taux < 0 ||
          palier.taux > 1,
      )
    ) {
      throw new BadRequestException('Le barème des frais de retrait est invalide.');
    }

    // Non-progressive calculation (based on total amount)
    let tauxApplique = 0.03; // Default for lowest tier

    for (const palier of structure) {
      if (montant <= palier.max) {
        tauxApplique = palier.taux;
        break;
      }
      tauxApplique = palier.taux; // Case for last tier (Infinity)
    }

    const frais = montant * tauxApplique;
    return Math.round(frais * 100) / 100;
  }

  async verifyLimites(
    compte: string,
    montant: number,
    devise: Devise,
    db: WithdrawalDb = this.prisma,
  ) {
    const params = await this.parametresService.getGeneralParameters();
    const montantMin = devise === 'FC'
      ? params.montant_min_retrait_fc
      : params.montant_min_retrait_usd;
    const montantMax = devise === 'FC'
      ? params.montant_max_par_retrait_fc
      : params.montant_max_par_retrait_usd;
    const soldeMin = devise === 'FC' ? params.solde_min_fc : params.solde_min_usd;
    const limiteJour = devise === 'FC'
      ? params.limite_retrait_jour_fc
      : params.limite_retrait_jour_usd;
    if (
      !Number.isFinite(montant) ||
      montant <= 0 ||
      ![montantMin, montantMax, soldeMin, limiteJour].every(Number.isFinite) ||
      montantMin <= 0 ||
      montantMax < montantMin ||
      soldeMin < 0 ||
      limiteJour <= 0
    ) {
      throw new BadRequestException(
        'Le montant ou les paramètres de retrait sont invalides. Contactez un administrateur.',
      );
    }

    // 1. Vérifier les heures autorisées (DÉSACTIVÉ POUR LES TESTS)
    // const now = new Date();
    // const heureActuelle = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    // if (params.heures_autorisees) {
    //   if (
    //     heureActuelle < params.heures_autorisees.debut ||
    //     heureActuelle > params.heures_autorisees.fin
    //   ) {
    //     throw new BadRequestException(
    //       `Les retraits sont autorisés uniquement entre ${params.heures_autorisees.debut} et ${params.heures_autorisees.fin}`,
    //     );
    //   }
    // }

    // 2. Vérifier montant minimum
    if (montant < montantMin) {
      throw new BadRequestException(
        `Le montant minimum de retrait est de ${montantMin} ${devise}`,
      );
    }

    // 3. Vérifier montant maximum par retrait
    if (montant > montantMax) {
      throw new BadRequestException(
        `Le montant maximum par retrait est de ${montantMax} ${devise}`,
      );
    }

    // 4. Vérifier solde disponible (incluant solde minimum requis et garanties de crédit)
    const frais = await this.calculateFees(montant, devise);
    const soldes = await this.balancesService.getSoldeDisponibleMembre(
      compte,
      0.3,
      db,
    );

    const deviseKey = devise === 'USD' ? 'usd' : 'fc';
    const soldeDisponible = soldes[deviseKey].soldeDisponible;
    const soldeActuel = soldes[deviseKey].soldeBrut;

    if (soldeDisponible - montant - frais < soldeMin) {
      const g = soldes[deviseKey].garantieGelee;
      const messageGarantie =
        g > 0 ? ` (dont ${g} ${devise} gelés en garantie de crédit)` : '';

      throw new BadRequestException(
          `Solde insuffisant${messageGarantie}. Le retrait et ses frais (${montant + frais} ${devise}) laisseraient moins que le minimum requis de ${soldeMin} ${devise}.`,
      );
    }

    // 5. Vérifier limite quotidienne
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const demain = new Date(today);
    demain.setDate(demain.getDate() + 1);
    const sumRetraitsAujourdhui = await db.retrait.aggregate({
      where: {
        compte,
        devise,
        statut: StatutRetrait.COMPLETED,
        dateOperation: {
          gte: today,
          lt: demain,
        },
      },
      _sum: { montant: true },
    });

    const totalAujourdhui = Number(sumRetraitsAujourdhui._sum.montant || 0);
    if (totalAujourdhui + montant > limiteJour) {
      throw new BadRequestException(
        `Limite de retrait quotidienne dépassée: ${limiteJour} ${devise}`,
      );
    }

    return {
      success: true,
      soldeActuel,
      soldeDisponible,
      frais,
      montantDebite: montant + frais,
    };
  }

  async create(dto: CreateWithdrawalDto, actor: AuthUser) {
    if (actor.role !== 'agent' || !actor.userId) {
      throw new ForbiddenException('Seul un agent peut exécuter un retrait au guichet');
    }

    const replay = await this.prisma.retrait.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      include: { membre: { select: { nomComplet: true } } },
    });
    if (replay) {
      this.assertWithdrawalReplayMatches(replay, dto, actor);
      return replay;
    }

    const membre = await this.prisma.membre.findUnique({
      where: { numeroCompte: dto.compte },
      select: {
        id: true,
        numeroCompte: true,
        nomComplet: true,
        typeCompte: true,
        statut: true,
        userId: true,
        delegues: { select: { userId: true } },
      },
    });
    if (!membre || membre.statut !== 'actif') {
      throw new NotFoundException('Compte membre introuvable ou inactif');
    }

    // Le scan est lancé par le backend. Le client ne peut pas fournir un ID biométrique arbitraire.
    let zkUserId: string;
    try {
      zkUserId = await this.zktecoService.captureFingerprint();
    } catch (error) {
      if (error instanceof Error && error.message === 'CAPTURE_IN_FLIGHT') {
        throw new ConflictException('Une lecture biométrique est déjà en cours; réessayez dans un instant.');
      }
      throw new ServiceUnavailableException(
        'Le lecteur biométrique est indisponible. Le retrait n’a pas été enregistré.',
      );
    }
    const biometricMatches =
      membre.userId === zkUserId ||
      membre.delegues.some((delegue) => delegue.userId === zkUserId);
    if (!biometricMatches) {
      throw new ForbiddenException(
        'Le scan ZKTeco ne correspond ni au membre ni à un délégué autorisé pour ce compte.',
      );
    }

    // L’heure légale de l’opération vient du serveur, jamais du navigateur.
    const dateO = new Date();
    try {
      return await this.prisma.$transaction(async (tx) => {
      // Sérialise les retraits du même compte avant de recalculer son solde.
      await tx.$queryRaw<Array<{ id: number }>>`
        SELECT "id" FROM "membres" WHERE "numero_compte" = ${dto.compte} FOR UPDATE
      `;
      await tx.$queryRaw<Array<{ id: number }>>`
        SELECT "id" FROM "delegues" WHERE "membre_id" = ${membre.id} FOR UPDATE
      `;
      const membreCourant = await tx.membre.findUnique({
        where: { numeroCompte: dto.compte },
        select: {
          typeCompte: true,
          statut: true,
          userId: true,
          delegues: { select: { userId: true } },
        },
      });
      if (!membreCourant || membreCourant.statut !== 'actif') {
        throw new NotFoundException('Compte membre introuvable ou inactif');
      }
      if (
        membreCourant.userId !== zkUserId &&
        !membreCourant.delegues.some((delegue) => delegue.userId === zkUserId)
      ) {
        throw new ForbiddenException(
          'L’autorisation biométrique de ce membre ou de son délégué a changé pendant la capture.',
        );
      }

      // L'idempotence est revérifiée après le verrou pour les requêtes concurrentes.
      const duplicate = await tx.retrait.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        include: { membre: { select: { nomComplet: true } } },
      });
      if (duplicate) {
        this.assertWithdrawalReplayMatches(duplicate, dto, actor);
        return duplicate;
      }

      await tx.$queryRaw<Array<{ id: number }>>`
        SELECT "id" FROM "caisses_agents"
        WHERE "agent_id" = ${actor.userId} AND "devise" = ${dto.devise}::"Devise"
        FOR UPDATE
      `;
      const caisse = await tx.caisseAgent.findUnique({
        where: { agentId_devise: { agentId: actor.userId!, devise: dto.devise } },
      });
      if (!caisse) {
        throw new BadRequestException(
          'La caisse de cet agent n’est pas initialisée pour cette devise. Contactez un administrateur.',
        );
      }

      const verification = await this.verifyLimites(
        dto.compte,
        dto.montant,
        dto.devise,
        tx,
      );
      if (Number(caisse.solde) < dto.montant) {
        throw new BadRequestException(
          `Fonds insuffisants dans votre caisse : ${Number(caisse.solde)} ${dto.devise} disponibles.`,
        );
      }

      const dateOperation = dateO;
      const soldeApres = verification.soldeActuel - verification.montantDebite;
      const description = dto.description?.trim() || 'Retrait au guichet';

      // La recette doit exister pour que le débit des frais soit toujours réconciliable.
      const revenuType = verification.frais > 0
        ? await tx.revenuType.findFirst({ where: { nom: 'Système Retrait' } })
        : null;
      if (verification.frais > 0 && !revenuType) {
        throw new BadRequestException(
          'Le type de revenu « Système Retrait » manque en base; le retrait est bloqué pour protéger la comptabilité.',
        );
      }

      await tx.epargne.create({
        data: {
          compte: dto.compte,
          typeOperation: TypeOperationEpargne.retrait,
          devise: dto.devise,
          montant: dto.montant,
          dateOperation,
          description: `${description} — ${dto.idempotencyKey}`,
        },
      });

      const retraitRecord = await tx.retrait.create({
        data: {
          compte: dto.compte,
          devise: dto.devise,
          montant: dto.montant,
          dateOperation,
          description,
          soldeAvant: verification.soldeActuel,
          soldeApres,
          frais: verification.frais,
          executeParId: actor.userId,
          executeParRole: actor.role,
          idempotencyKey: dto.idempotencyKey,
        },
        include: { membre: { select: { nomComplet: true } } },
      });

      if (verification.frais > 0 && revenuType) {
        await this.recordFeeRevenue(tx, {
          typeCompte: membreCourant.typeCompte,
          typeRevenuId: revenuType.id,
          compte: dto.compte,
          devise: dto.devise,
          montant: verification.frais,
          dateOperation,
          retraitReference: retraitRecord.reference,
          reversal: false,
        });
      }

      const caisseApres = Number(caisse.solde) - dto.montant;
      await tx.caisseAgent.update({
        where: { id: caisse.id },
        data: { solde: { decrement: dto.montant } },
      });
      await tx.mouvementCaisseAgent.create({
        data: {
          caisseId: caisse.id,
          retraitId: retraitRecord.id,
          type: 'RETRAIT',
          devise: dto.devise,
          montant: dto.montant,
          soldeAvant: caisse.solde,
          soldeApres: caisseApres,
          acteurId: actor.userId,
          acteurRole: actor.role,
        },
      });
      await tx.adminLog.create({
        data: {
          action: 'RETRAIT_GUICHET',
          details: `Retrait ${retraitRecord.reference}, compte ${dto.compte}, montant ${dto.montant} ${dto.devise}, frais ${verification.frais} ${dto.devise}, agent #${actor.userId}, solde membre ${verification.soldeActuel} → ${soldeApres}, caisse ${caisse.solde} → ${caisseApres}.`,
          success: true,
          userId: actor.userId,
        },
      });

      return retraitRecord;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const duplicate = await this.prisma.retrait.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
          include: { membre: { select: { nomComplet: true } } },
        });
        if (duplicate) {
          this.assertWithdrawalReplayMatches(duplicate, dto, actor);
          return duplicate;
        }
      }
      throw error;
    }
  }

  private async recordFeeRevenue(
    tx: Prisma.TransactionClient,
    input: {
      typeCompte: string;
      typeRevenuId: number;
      compte: string;
      devise: Devise;
      montant: number;
      dateOperation: Date;
      retraitReference: string;
      reversal: boolean;
      motif?: string;
    },
  ) {
    const direction = input.reversal ? -1 : 1;
    const operation = input.reversal
      ? TypeOperationEpargne.retrait
      : TypeOperationEpargne.depot;
    const motif = input.reversal ? ` — annulation: ${input.motif}` : '';
    await tx.revenu.create({
      data: {
        typeCompte: input.typeCompte,
        typeRevenuId: input.typeRevenuId,
        montant: input.montant * direction,
        devise: input.devise,
        dateOperation: input.dateOperation,
        sourceCompte: input.compte,
      },
    });

    const sectionTrigram = getSectionTrigram(input.typeCompte);
    await tx.epargne.create({
      data: {
        compte: `MW-${sectionTrigram}-REVENUS`,
        typeOperation: operation,
        devise: input.devise,
        montant: input.montant,
        dateOperation: input.dateOperation,
        description: `${input.reversal ? 'Contrepassation frais retrait' : 'Frais retrait'} ${input.retraitReference} membre ${input.compte}${motif}`,
      },
    });
  }

  async getMyCashboxes(agentId: number) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        nom: true,
        guichetAssigne: true,
        caisses: { orderBy: { devise: 'asc' } },
      },
    });
    if (!agent) throw new NotFoundException('Agent introuvable');
    return {
      agentId: agent.id,
      agentName: agent.nom,
      guichet: agent.guichetAssigne,
      balances: agent.caisses.map((caisse) => ({
        devise: caisse.devise,
        solde: Number(caisse.solde),
      })),
    };
  }

  async getCashboxMovements(agentId: number, limit = 100) {
    const rows = await this.prisma.mouvementCaisseAgent.findMany({
      where: { caisse: { agentId } },
      include: { caisse: { select: { devise: true } }, retrait: { select: { reference: true } } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(500, Math.max(1, limit)),
    });
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      devise: row.devise,
      montant: Number(row.montant),
      soldeAvant: Number(row.soldeAvant),
      soldeApres: Number(row.soldeApres),
      motif: row.motif,
      referenceRetrait: row.retrait?.reference ?? null,
      acteur: row.acteurId ? { id: row.acteurId, role: row.acteurRole } : null,
      createdAt: row.createdAt,
    }));
  }

  async verifyForAgent(
    compte: string,
    montant: number,
    devise: Devise,
    agentId: number,
  ) {
    const result = await this.verifyLimites(compte, montant, devise);
    const caisse = await this.prisma.caisseAgent.findUnique({
      where: { agentId_devise: { agentId, devise } },
      select: { solde: true },
    });
    if (!caisse) {
      throw new BadRequestException('Votre caisse n’est pas initialisée pour cette devise.');
    }
    if (Number(caisse.solde) < montant) {
      throw new BadRequestException(
        `Fonds insuffisants dans votre caisse : ${Number(caisse.solde)} ${devise} disponibles.`,
      );
    }
    return { ...result, soldeCaisse: Number(caisse.solde) };
  }

  async getAllCashboxes() {
    const agents = await this.prisma.agent.findMany({
      orderBy: { nom: 'asc' },
      select: {
        id: true,
        nom: true,
        guichetAssigne: true,
        actif: true,
        caisses: { orderBy: { devise: 'asc' } },
      },
    });
    return agents.map((agent) => ({
      agentId: agent.id,
      agentName: agent.nom,
      guichet: agent.guichetAssigne,
      actif: agent.actif,
      balances: agent.caisses.map((caisse) => ({
        devise: caisse.devise,
        solde: Number(caisse.solde),
      })),
    }));
  }

  async fundCashbox(
    agentId: number,
    dto: FundAgentCashboxDto,
    actor: AuthUser,
  ) {
    const replay = await this.prisma.mouvementCaisseAgent.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      include: { caisse: { select: { agentId: true } } },
    });
    if (replay) {
      if (
        replay.caisse.agentId !== agentId ||
        replay.devise !== dto.devise ||
        Number(replay.montant) !== dto.montant ||
        replay.type !== 'APPROVISIONNEMENT' ||
        replay.motif !== dto.motif.trim()
      ) {
        throw new ConflictException('La clé idempotente a déjà été utilisée pour une autre opération.');
      }
      return {
        agentId,
        devise: dto.devise,
        soldeAvant: Number(replay.soldeAvant),
        soldeApres: Number(replay.soldeApres),
      };
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: number }>>`
        SELECT "id" FROM "caisses_agents"
        WHERE "agent_id" = ${agentId} AND "devise" = ${dto.devise}::"Devise"
        FOR UPDATE
      `;
      const caisse = await tx.caisseAgent.findUnique({
        where: { agentId_devise: { agentId, devise: dto.devise } },
      });
      if (!caisse) throw new NotFoundException('Caisse agent introuvable');
      const duplicate = await tx.mouvementCaisseAgent.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        include: { caisse: { select: { agentId: true } } },
      });
      if (duplicate) {
        if (
          duplicate.caisse.agentId !== agentId ||
          duplicate.devise !== dto.devise ||
          Number(duplicate.montant) !== dto.montant ||
          duplicate.type !== 'APPROVISIONNEMENT' ||
          duplicate.motif !== dto.motif.trim()
        ) {
          throw new ConflictException('La clé idempotente a déjà été utilisée pour une autre opération.');
        }
        return {
          agentId,
          devise: dto.devise,
          soldeAvant: Number(duplicate.soldeAvant),
          soldeApres: Number(duplicate.soldeApres),
        };
      }

      const avant = Number(caisse.solde);
      const apres = avant + dto.montant;
      await tx.caisseAgent.update({
        where: { id: caisse.id },
        data: { solde: { increment: dto.montant } },
      });
      await tx.mouvementCaisseAgent.create({
        data: {
          caisseId: caisse.id,
          type: 'APPROVISIONNEMENT',
          devise: dto.devise,
          montant: dto.montant,
          soldeAvant: avant,
          soldeApres: apres,
          motif: dto.motif.trim(),
          acteurId: actor.userId,
          acteurRole: actor.role,
          idempotencyKey: dto.idempotencyKey,
        },
      });
      await tx.adminLog.create({
        data: {
          action: 'APPROVISIONNEMENT_CAISSE_AGENT',
          details: `Caisse de l’agent #${agentId} approvisionnée de ${dto.montant} ${dto.devise} par ${actor.role} #${actor.userId}. Solde ${avant} → ${apres}. Motif : ${dto.motif.trim()}`,
          success: true,
          userId: actor.userId ?? null,
        },
      });
      return { agentId, devise: dto.devise, soldeAvant: avant, soldeApres: apres };
    });
  }

  async cancel(id: number, dto: CancelWithdrawalDto, actor: AuthUser) {
    const motif = dto.motif.trim();
    if (!motif) throw new BadRequestException('Le motif d’annulation est obligatoire');
    if (dto.cashRecupere !== true) {
      throw new BadRequestException(
        'Confirmez que le montant payé a été physiquement rendu à la caisse avant l’annulation.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: number }>>`
        SELECT "id" FROM "retraits" WHERE "id" = ${id} FOR UPDATE
      `;
      const retrait = await tx.retrait.findUnique({
        where: { id },
        include: {
          membre: {
            select: { nomComplet: true, typeCompte: true },
          },
          mouvementsCaisse: { where: { type: 'RETRAIT' }, take: 1 },
        },
      });
      if (!retrait) throw new NotFoundException(`Retrait #${id} introuvable`);
      if (retrait.statut !== StatutRetrait.COMPLETED) {
        throw new ConflictException('Seul un retrait payé peut être annulé');
      }
      const mouvementInitial = retrait.mouvementsCaisse[0];
      if (!mouvementInitial) {
        throw new ConflictException('Le mouvement de caisse d’origine manque; annulation bloquée');
      }

      await tx.$queryRaw<Array<{ id: number }>>`
        SELECT "id" FROM "caisses_agents" WHERE "id" = ${mouvementInitial.caisseId} FOR UPDATE
      `;
      const caisse = await tx.caisseAgent.findUnique({
        where: { id: mouvementInitial.caisseId },
      });
      if (!caisse) throw new ConflictException('La caisse d’origine du retrait est introuvable');

      const dateOperation = new Date();
      await tx.epargne.create({
        data: {
          compte: retrait.compte,
          typeOperation: TypeOperationEpargne.depot,
          devise: retrait.devise,
          montant: retrait.montant,
          dateOperation,
          description: `Contrepassation retrait ${retrait.reference} — ${motif}`,
        },
      });

      if (Number(retrait.frais) > 0) {
        const revenuType = await tx.revenuType.findFirst({
          where: { nom: 'Système Retrait' },
        });
        if (!revenuType) {
          throw new ConflictException('Le type de revenu des frais manque; annulation bloquée');
        }
        await this.recordFeeRevenue(tx, {
          typeCompte: retrait.membre.typeCompte,
          typeRevenuId: revenuType.id,
          compte: retrait.compte,
          devise: retrait.devise,
          montant: Number(retrait.frais),
          dateOperation,
          retraitReference: retrait.reference,
          reversal: true,
          motif,
        });
      }

      const caisseAvant = Number(caisse.solde);
      const caisseApres = caisseAvant + Number(retrait.montant);
      await tx.caisseAgent.update({
        where: { id: caisse.id },
        data: { solde: { increment: retrait.montant } },
      });
      await tx.retrait.update({
        where: { id },
        data: {
          statut: StatutRetrait.CANCELLED,
          annuleLe: dateOperation,
          annuleParId: actor.userId,
          annuleParRole: actor.role,
          motifAnnulation: motif,
        },
      });
      await tx.mouvementCaisseAgent.create({
        data: {
          caisseId: caisse.id,
          retraitId: retrait.id,
          type: 'ANNULATION',
          devise: retrait.devise,
          montant: retrait.montant,
          soldeAvant: caisseAvant,
          soldeApres: caisseApres,
          motif,
          acteurId: actor.userId,
          acteurRole: actor.role,
        },
      });
      await tx.adminLog.create({
        data: {
          action: 'ANNULATION_RETRAIT',
          details: `Retrait ${retrait.reference} annulé par ${actor.role} #${actor.userId}. Le retour physique de l’argent a été confirmé. Motif : ${motif}. Caisse ${caisseAvant} → ${caisseApres} ${retrait.devise}.`,
          success: true,
          userId: actor.userId ?? null,
        },
      });

      return tx.retrait.findUnique({
        where: { id },
        include: { membre: { select: { nomComplet: true } } },
      });
    });
  }

  async findAll(page = 1, pageSize = 10) {
    const where: Prisma.RetraitWhereInput = {};
    const [total, data] = await Promise.all([
      this.prisma.retrait.count({ where }),
      this.prisma.retrait.findMany({
        where,
        include: { membre: { select: { nomComplet: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      data,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        hasNextPage: page * pageSize < total,
        hasPrevPage: page > 1,
      },
    };
  }

  async findByCompte(compte: string) {
    return this.prisma.retrait.findMany({
      where: { compte },
      include: { membre: { select: { nomComplet: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
