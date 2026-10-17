import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-request';
import { CreateRemboursementDto } from './dto/create-remboursement.dto';
import { Devise, StatutCredit, Prisma, Remboursement } from '@prisma/client';
import { getSectionTrigram } from '../common/constants/sections';
import { BalancesService } from '../balances/balances.service';
import * as crypto from 'crypto';

const Decimal = Prisma.Decimal;

@Injectable()
export class RemboursementsService {
  private readonly logger = new Logger(RemboursementsService.name);

  constructor(
    private prisma: PrismaService,
    private balancesService: BalancesService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC METHODS
  // ══════════════════════════════════════════════════════════════════════

  async findAll(skip = 0, take = 20) {
    const remboursements = await this.prisma.remboursement.findMany({
      where: { deletedAt: null },
      orderBy: { dateRemboursement: 'desc' },
      skip,
      take,
      include: {
        credit: {
          include: { membre: true },
        },
      },
    });

    const total = await this.prisma.remboursement.count({
      where: { deletedAt: null },
    });

    return {
      data: remboursements.map((r) => this.mapToResponse(r)),
      meta: {
        total,
        page: Math.floor(skip / take) + 1,
        pageSize: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async findByCredit(creditId: number, skip = 0, take = 10) {
    const remboursements = await this.prisma.remboursement.findMany({
      where: { creditId, deletedAt: null },
      orderBy: { dateRemboursement: 'desc' },
      skip,
      take,
      include: {
        credit: {
          include: { membre: true },
        },
      },
    });

    const total = await this.prisma.remboursement.count({
      where: { creditId, deletedAt: null },
    });

    const page = Math.floor(skip / take) + 1;
    return {
      data: remboursements.map((r) => this.mapToResponse(r)),
      meta: {
        total,
        page,
        pageSize: take,
        totalPages: Math.ceil(total / take),
        hasPrevPage: page > 1,
        hasNextPage: skip + take < total,
      },
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // CRÉATION DE REMBOURSEMENT AVEC VENTILATION PRORATA TEMPORIS
  // ────────────────────────────────────────────────────────────────────
  async create(dto: CreateRemboursementDto, actor: AuthUser) {
    const {
      creditId,
      montant,
      devise,
      dateRemboursement,
      description,
      idempotencyKey,
    } = dto;

    if (actor.role === 'agent' && !actor.userId) {
      throw new BadRequestException('Une session agent valide est requise.');
    }

    this.logger.log(
      `📥 Créer remboursement: crédit #${creditId}, ${montant} ${devise}`,
    );

    // ========================================================================
    // PHASE 1: VALIDATIONS
    // ========================================================================
    if (montant <= 0) {
      throw new BadRequestException('Montant doit être strictement positif');
    }

    const credit = await this.prisma.credit.findUnique({
      where: { id: creditId },
      include: {
        membre: true,
        remboursements: {
          where: { deletedAt: null },
          orderBy: { dateRemboursement: 'desc' },
        },
      },
    });

    if (!credit) throw new NotFoundException(`Crédit #${creditId} non trouvé`);
    if (credit.statut !== StatutCredit.actif) {
      throw new BadRequestException(`Crédit #${creditId} n'est pas actif.`);
    }
    if (devise !== credit.devise) {
      throw new BadRequestException(`Devise mismatch.`);
    }

    const dateR = actor.role === 'agent' ? new Date() : new Date(dateRemboursement);
    const dateDebut = new Date(credit.dateDebut);
    if (dateR < dateDebut) throw new BadRequestException(`Date invalide.`);

    const montantCredit = Number(credit.montant);
    const tauxInteret = Number(credit.tauxInteret);
    const montantTotalAttendu = montantCredit * (1 + tauxInteret / 100);
    const montantDejaRembourse = Number(credit.montantRembourse);
    const resteAPayer = montantTotalAttendu - montantDejaRembourse;

    if (montant > resteAPayer + 0.01) {
      // Tolérance pour arrondis
      throw new BadRequestException(`Montant dépasse le reste à payer.`);
    }

    // ========================================================================
    // PHASE 2: CALCUL VENTILATION
    // ========================================================================
    let dateDernierRemboursement = credit.dateDebut;
    if (credit.remboursements && credit.remboursements.length > 0) {
      dateDernierRemboursement = credit.remboursements[0].dateRemboursement;
    }

    const joursEcoules = Math.max(
      1,
      Math.ceil(
        (dateR.getTime() - new Date(dateDernierRemboursement).getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    );

    // Ventilation simple : on couvre les intérêts d'abord, puis le principal
    const totalInteretAttendu = montantCredit * (tauxInteret / 100);
    const ratioInteret = totalInteretAttendu / montantTotalAttendu;

    const partInteret = Math.round(montant * ratioInteret * 100) / 100;
    const partPrincipal = Math.round((montant - partInteret) * 100) / 100;

    // ========================================================================
    // PHASE 3: IDEMPOTENCE
    // ========================================================================
    const finalKey = idempotencyKey || this.generateIdempotencyKey(dto);
    const existing = await this.prisma.remboursement.findUnique({
      where: { idempotencyKey: finalKey },
    });
    if (existing && !existing.deletedAt) {
      if (
        existing.creditId !== creditId || existing.devise !== devise ||
        Number(existing.montant) !== montant ||
        (actor.role === 'agent' && (existing.executeParRole !== 'agent' || existing.executeParId !== actor.userId))
      ) throw new BadRequestException('La clé idempotente est déjà utilisée par une autre opération.');
      return this.mapToResponse(existing);
    }

    // ========================================================================
    // PHASE 4: TRANSACTION
    // ========================================================================
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw<Array<{ id: number }>>`
          SELECT "id" FROM "credits" WHERE "id" = ${creditId} FOR UPDATE
        `;
        const currentCredit = await tx.credit.findUnique({
          where: { id: creditId },
          select: { statut: true, montant: true, montantRembourse: true, tauxInteret: true },
        });
        if (!currentCredit || currentCredit.statut !== StatutCredit.actif) {
          throw new BadRequestException('Ce crédit n’est plus actif.');
        }
        const totalDueNow = Number(currentCredit.montant) * (1 + Number(currentCredit.tauxInteret) / 100);
        const remainingNow = totalDueNow - Number(currentCredit.montantRembourse);
        if (montant > remainingNow + 0.01) {
          throw new BadRequestException('Le montant dépasse le solde restant dû.');
        }

        if (actor.role === 'agent') {
          await tx.$queryRaw<Array<{ id: number }>>`
            SELECT "id" FROM "caisses_agents"
            WHERE "agent_id" = ${actor.userId!} AND "devise" = ${devise}::"Devise"
            FOR UPDATE
          `;
        }
        const caisse = actor.role === 'agent'
          ? await tx.caisseAgent.findUnique({
            where: { agentId_devise: { agentId: actor.userId!, devise: devise as Devise } },
          })
          : null;
        if (actor.role === 'agent' && !caisse) {
          throw new BadRequestException('Votre caisse n’est pas initialisée dans cette devise.');
        }

        const remboursement = await tx.remboursement.create({
          data: {
            creditId,
            montant: new Decimal(montant),
            devise,
            dateRemboursement: dateR,
            partPrincipal: new Decimal(partPrincipal),
            partInteret: new Decimal(partInteret),
            idempotencyKey: finalKey,
            description: description || `Remboursement #${creditId}`,
            executeParId: actor.userId ?? null,
            executeParRole: actor.role ?? null,
          },
        });

        if (caisse) {
          const avant = Number(caisse.solde);
          const apres = avant + montant;
          await tx.caisseAgent.update({ where: { id: caisse.id }, data: { solde: { increment: montant } } });
          await tx.mouvementCaisseAgent.create({
            data: {
              caisseId: caisse.id,
              remboursementId: remboursement.id,
              type: 'REMBOURSEMENT_CREDIT',
              devise: devise as Devise,
              montant,
              soldeAvant: avant,
              soldeApres: apres,
              motif: `Remboursement du crédit #${creditId}`,
              acteurId: actor.userId,
              acteurRole: actor.role,
              idempotencyKey: finalKey,
            },
          });
        }

        const sectionTrigram = getSectionTrigram(credit.membre.typeCompte);
        const compCrSection = `MW-${sectionTrigram}-CREDITS`;

        // Écritures Principal
        await tx.epargne.create({
          data: {
            compte: compCrSection,
            typeOperation: 'depot',
            devise: devise as Devise,
            montant: new Decimal(partPrincipal),
            dateOperation: dateR,
            description: `Remb. principal #${creditId}`,
            remboursementId: remboursement.id,
          },
        });

        await tx.epargne.create({
          data: {
            compte: 'MW-TRESORERIE-CREDITS',
            typeOperation: 'depot',
            devise: devise as Devise,
            montant: new Decimal(partPrincipal),
            dateOperation: dateR,
            description: `Remb. principal #${creditId} global`,
            remboursementId: remboursement.id,
          },
        });

        // Écritures Intérêts : 3% crédités au membre, 12% en revenus
        if (partInteret > 0) {
          // Taux total d'intérêts appliqué (ex: 15)
          const tauxTotal = Number(credit.tauxInteret) || 15;
          // Fraction reversée au membre : 3 / tauxTotal
          const ratioMembre = 3 / tauxTotal;
          const partMembre = Math.round(partInteret * ratioMembre * 100) / 100;
          const partRevenus =
            Math.round((partInteret - partMembre) * 100) / 100;

          // ── 1. Crédit 3% sur le compte collectif du membre ──────────
          await tx.epargne.create({
            data: {
              compte: credit.membre.numeroCompte,
              typeOperation: 'depot',
              devise: devise as Devise,
              montant: new Decimal(partMembre),
              dateOperation: dateR,
              description: `Retour intérêts (3%) remb. crédit #${creditId}`,
              remboursementId: remboursement.id,
            },
          });

          this.logger.log(
            `💰 3% intérêts → membre (${credit.membre.numeroCompte}): +${partMembre} ${devise}`,
          );

          // ── 2. Revenus 12% : compte de revenus de la section ────────
          const revType = await tx.revenuType.findFirst({
            where: { nom: 'Système Remboursement' },
          });

          if (revType) {
            await tx.revenu.create({
              data: {
                typeCompte: credit.membre.typeCompte,
                typeRevenuId: revType.id,
                montant: new Decimal(partRevenus),
                devise: devise as Devise,
                dateOperation: dateR,
                sourceCompte: credit.numeroCompte,
                remboursementId: remboursement.id,
              },
            });

            const revSection = `MW-${sectionTrigram}-REVENUS`;
            await tx.epargne.create({
              data: {
                compte: revSection,
                typeOperation: 'depot',
                devise: devise as Devise,
                montant: new Decimal(partRevenus),
                dateOperation: dateR,
                description: `Intérêts (12%) remb. #${creditId}`,
                remboursementId: remboursement.id,
              },
            });

            this.logger.log(
              `📈 12% intérêts → revenus section (${revSection}): +${partRevenus} ${devise}`,
            );
          }
        }

        // MAJ Crédit
        const totalRembourse = Number(currentCredit.montantRembourse) + montant;
        const nouveauStatut =
          totalRembourse >= montantTotalAttendu - 0.01
            ? StatutCredit.rembourse
            : StatutCredit.actif;

        await tx.credit.update({
          where: { id: creditId },
          data: {
            montantRembourse: new Decimal(totalRembourse),
            statut: nouveauStatut,
            derniereOperation: dateR,
          },
        });

        return remboursement;
      });

      // Libération des garanties
      await this.balancesService.rafraichirGarantie(credit.membre.id);

      return this.mapToResponse(result);
    } catch (error) {
      this.logger.error(`Erreur creation: ${error.message}`);
      throw error;
    }
  }

  async remove(id: number, reason: string = 'Suppression administrative', actor?: AuthUser) {
    const remboursement = await this.prisma.remboursement.findUnique({
      where: { id },
      include: {
        credit: { include: { membre: true } },
      },
    });

    if (!remboursement) throw new NotFoundException();
    if (remboursement.deletedAt) throw new BadRequestException();

    return this.prisma.$transaction(async (tx) => {
      // 1. Soft-delete du remboursement
      if (remboursement.executeParRole === 'agent' && remboursement.executeParId) {
        await tx.$queryRaw<Array<{ id: number }>>`
          SELECT "id" FROM "caisses_agents"
          WHERE "agent_id" = ${remboursement.executeParId} AND "devise" = ${remboursement.devise}::"Devise"
          FOR UPDATE
        `;
        const caisse = await tx.caisseAgent.findUnique({
          where: {
            agentId_devise: {
              agentId: remboursement.executeParId,
              devise: remboursement.devise as Devise,
            },
          },
        });
        if (!caisse || Number(caisse.solde) < Number(remboursement.montant)) {
          throw new BadRequestException(
            'Annulation impossible : la caisse de l’agent ne contient pas le montant à contrepasser.',
          );
        }
        const avant = Number(caisse.solde);
        const apres = avant - Number(remboursement.montant);
        await tx.caisseAgent.update({
          where: { id: caisse.id },
          data: { solde: { decrement: remboursement.montant } },
        });
        await tx.mouvementCaisseAgent.create({
          data: {
            caisseId: caisse.id,
            remboursementId: id,
            type: 'ANNULATION_REMBOURSEMENT',
            devise: remboursement.devise as Devise,
            montant: remboursement.montant,
            soldeAvant: avant,
            soldeApres: apres,
            motif: reason,
            acteurId: actor?.userId,
            acteurRole: actor?.role,
          },
        });
      }

      await tx.remboursement.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          deleteReason: reason,
        },
      });

      // 2. Inversion des écritures Epargne (Retour en trésorerie inverse)
      const relatedEpargnes = await tx.epargne.findMany({
        where: { remboursementId: id },
      });

      for (const e of relatedEpargnes) {
        await tx.epargne.create({
          data: {
            compte: e.compte,
            typeOperation: 'retrait', // Inversion du 'depot' initial
            devise: e.devise,
            montant: e.montant,
            dateOperation: new Date(),
            description: `ANNULATION REMB #${id} - ${e.description}`,
          },
        });
      }

      // 3. Inversion des écritures Revenu
      const relatedRevenus = await tx.revenu.findMany({
        where: { remboursementId: id },
      });

      for (const r of relatedRevenus) {
        await tx.revenu.create({
          data: {
            typeCompte: r.typeCompte,
            typeRevenuId: r.typeRevenuId,
            montant: r.montant.negated(), // Négatif pour annuler le revenu
            devise: r.devise,
            dateOperation: new Date(),
            sourceCompte: r.sourceCompte,
          },
        });
      }

      // 4. Recalculer l'état du crédit
      await this.recalculerCredit(remboursement.creditId, tx);

      // 5. Rafraîchir les garanties (balances gelées)
      await this.balancesService.rafraichirGarantie(
        remboursement.credit.membre.id,
      );

      await tx.adminLog.create({
        data: {
          action: 'REMBOURSEMENT_ANNULE',
          details: `Remboursement #${id} annulé par ${actor?.role ?? 'acteur inconnu'} #${actor?.userId ?? 'inconnu'}. Motif : ${reason}.`,
          success: true,
          userId: actor?.userId ?? null,
        },
      });

      return { success: true };
    });
  }

  /**
   * Recalcule complètement l'état financier d'un crédit
   */
  async recalculerCredit(creditId: number, tx?: Prisma.TransactionClient) {
    const prisma = tx || this.prisma;

    // 1. Somme des remboursements valides
    const aggregate = await prisma.remboursement.aggregate({
      where: { creditId, deletedAt: null },
      _sum: { montant: true },
    });

    const totalRembourse = Number(aggregate?._sum?.montant || 0);

    // 2. Infos du crédit
    const credit = await prisma.credit.findUnique({
      where: { id: creditId },
      select: { montant: true, tauxInteret: true },
    });

    if (!credit) return;

    const totalExpected =
      Number(credit.montant) * (1 + Number(credit.tauxInteret) / 100);
    const statut =
      totalRembourse >= totalExpected - 0.01
        ? StatutCredit.rembourse
        : StatutCredit.actif;

    // 3. Dernière date d'opération valide
    const lastRembo = await prisma.remboursement.findFirst({
      where: { creditId, deletedAt: null },
      orderBy: { dateRemboursement: 'desc' },
      select: { dateRemboursement: true },
    });

    // 4. Mise à jour de l'enregistrement crédit
    await prisma.credit.update({
      where: { id: creditId },
      data: {
        montantRembourse: new Decimal(totalRembourse),
        statut: statut,
        derniereOperation: lastRembo?.dateRemboursement || null,
      },
    });

    this.logger.log(
      `🔄 Crédit #${creditId} recalculé: ${totalRembourse}/${totalExpected} (${statut})`,
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ══════════════════════════════════════════════════════════════════════

  private generateIdempotencyKey(dto: CreateRemboursementDto): string {
    const data = `${dto.creditId}-${dto.montant}-${dto.dateRemboursement}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private mapToResponse(rembo: any) {
    const credit = rembo.credit;
    const membre = credit?.membre;

    const montantCredit = credit ? Number(credit.montant) : 0;
    const tauxInteret = credit ? Number(credit.tauxInteret) : 15;
    const montantTotal = montantCredit * (1 + tauxInteret / 100);
    const montantRembourse = credit
      ? Number(credit.montantRembourse)
      : Number(rembo.montant);
    const soldeRestant = Math.max(0, montantTotal - montantRembourse);
    const progressPercent =
      montantTotal > 0
        ? Math.min(100, Math.round((montantRembourse / montantTotal) * 100))
        : 0;

    const statusMap: Record<string, string> = {
      actif: 'active',
      rembourse: 'completed',
      en_retard: 'overdue',
    };
    const status = statusMap[credit?.statut] ?? 'active';

    const nomComplet = membre?.nomComplet ?? '';
    const initiales =
      nomComplet
        .split(' ')
        .map((n: string) => n[0] ?? '')
        .join('')
        .toUpperCase()
        .substring(0, 2) || '??';

    return {
      // Champs de base du remboursement
      id: rembo.id,
      creditId: rembo.creditId,
      montant: Number(rembo.montant),
      devise: rembo.devise,
      dateRemboursement: rembo.dateRemboursement,
      ventilation: {
        principal: Number(rembo.partPrincipal),
        interets: Number(rembo.partInteret),
      },
      description: rembo.description,
      createdAt: rembo.createdAt,
      updatedAt: rembo.updatedAt,

      // Champs attendus par le frontend (RepaymentRecord)
      date: rembo.dateRemboursement,
      currency: rembo.devise,
      memberName: nomComplet,
      memberInitials: initiales,
      accountId: credit?.numeroCompte ?? membre?.numeroCompte ?? '',
      initialAmount: montantCredit,
      interestAmount: montantCredit * (tauxInteret / 100),
      interestRate: tauxInteret,
      totalDue: montantTotal,
      paidAmount: montantRembourse,
      remainingAmount: soldeRestant,
      progressPercent,
      status,
    };
  }
}
