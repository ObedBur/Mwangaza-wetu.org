import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSavingsDto, TypeOperation } from './dto/create-savings.dto';
import {
  Devise,
  TypeOperationEpargne as PrismaTypeOperation,
} from '@prisma/client';
import { ParametresService } from '../parametres/parametres.service';
import { ZktecoService } from '../zkteco/zkteco.service';
import type { AuthUser } from '../common/types/auth-request';

@Injectable()
export class SavingsService {
  constructor(
    private prisma: PrismaService,
    private parametresService: ParametresService,
    private zktecoService: ZktecoService,
  ) {}

  private async captureAndVerifyMemberFingerprint(
    memberUserId: string | null,
    delegateUserIds: (string | null)[],
  ) {
    let scannedUserId: string;
    try {
      scannedUserId = await this.zktecoService.captureFingerprint();
    } catch (error) {
      if (error instanceof Error && error.message === 'CAPTURE_IN_FLIGHT') {
        throw new ConflictException(
          'Une lecture biométrique est déjà en cours; réessayez dans un instant.',
        );
      }
      throw new ServiceUnavailableException(
        'Le lecteur biométrique est indisponible. Le dépôt n’a pas été enregistré.',
      );
    }

    if (memberUserId !== scannedUserId && !delegateUserIds.includes(scannedUserId)) {
      throw new ForbiddenException(
        'Le scan ZKTeco ne correspond ni au membre ni à un délégué autorisé pour ce compte.',
      );
    }
    return scannedUserId;
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    type?: TypeOperation;
  }) {
    const { page = 1, pageSize = 10, type } = params;
    const skip = (page - 1) * pageSize;

    const where: { typeOperation?: PrismaTypeOperation; NOT?: any } = {};
    if (type) {
      where.typeOperation = type;
    }
    // Jamais afficher les transactions des comptes système dans le tableau général
    where.NOT = [
      { compte: { contains: 'REVENUS' } },
      { compte: { contains: 'SECTION-0000' } },
      { compte: { contains: 'CREDITS' } },
      { compte: { contains: 'TRESORERIE' } },
    ];

    const [total, data] = await Promise.all([
      this.prisma.epargne.count({ where }),
      this.prisma.epargne.findMany({
        where,
        include: { membre: true },
        orderBy: { dateOperation: 'desc' },
        skip,
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
    return this.prisma.epargne.findMany({
      where: { compte },
      orderBy: { dateOperation: 'desc' },
    });
  }

  async getPrincipalDashboard() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const historyStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const dailyStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    const systemAccounts = [
      { compte: { contains: 'REVENUS' } },
      { compte: { contains: 'SECTION-0000' } },
      { compte: { contains: 'CREDITS' } },
      { compte: { contains: 'TRESORERIE' } },
    ];
    const principalFilter = { typeCompte: 'PRINCIPAL', NOT: systemAccounts };

    const [totals, fees, thisMonth, historyEntries, historyFees, members, lastDeposits] = await Promise.all([
      this.prisma.epargne.groupBy({
        by: ['compte', 'devise', 'typeOperation'],
        where: principalFilter,
        _sum: { montant: true },
      }),
      this.prisma.retrait.groupBy({
        by: ['compte', 'devise'],
        where: { NOT: systemAccounts, statut: 'COMPLETED' },
        _sum: { frais: true },
      }),
      this.prisma.epargne.groupBy({
        by: ['devise', 'typeOperation'],
        where: { ...principalFilter, dateOperation: { gte: monthStart } },
        _sum: { montant: true },
      }),
      this.prisma.epargne.findMany({
        where: { ...principalFilter, dateOperation: { gte: historyStart } },
        select: { compte: true, devise: true, typeOperation: true, montant: true, dateOperation: true },
      }),
      this.prisma.retrait.findMany({
        where: { dateOperation: { gte: historyStart }, NOT: systemAccounts, statut: 'COMPLETED' },
        select: { compte: true, devise: true, frais: true, dateOperation: true },
      }),
      this.prisma.membre.findMany({
        where: {
          NOT: [
            { numeroCompte: { contains: 'REVENUS' } },
            { numeroCompte: { contains: 'SECTION-0000' } },
            { numeroCompte: { contains: 'CREDITS' } },
            { numeroCompte: { contains: 'TRESORERIE' } },
          ],
        },
        select: { id: true, numeroCompte: true, nomComplet: true, telephone: true, dateAdhesion: true, statut: true },
      }),
      this.prisma.epargne.findMany({
        where: { ...principalFilter, typeOperation: 'depot' },
        orderBy: { dateOperation: 'desc' },
        distinct: ['compte'],
        select: { compte: true, dateOperation: true },
      }),
    ]);

    const balanceByAccount = new Map<string, { USD: number; FC: number }>();
    for (const row of totals) {
      const values = balanceByAccount.get(row.compte) ?? { USD: 0, FC: 0 };
      const amount = Number(row._sum.montant || 0) * (row.typeOperation === 'retrait' ? -1 : 1);
      values[row.devise] += amount;
      balanceByAccount.set(row.compte, values);
    }
    for (const row of fees) {
      const values = balanceByAccount.get(row.compte) ?? { USD: 0, FC: 0 };
      values[row.devise] -= Number(row._sum.frais || 0);
      balanceByAccount.set(row.compte, values);
    }

    const monthTotals = { deposits: { USD: 0, FC: 0 }, withdrawals: { USD: 0, FC: 0 } };
    for (const row of thisMonth) {
      const key = row.typeOperation === 'depot' ? 'deposits' : 'withdrawals';
      monthTotals[key][row.devise] = Number(row._sum.montant || 0);
    }

    const lastDepositByAccount = new Map(lastDeposits.map((item) => [item.compte, item.dateOperation]));
    const holders = members
      .map((member) => {
        const balance = balanceByAccount.get(member.numeroCompte) ?? { USD: 0, FC: 0 };
        return {
          memberId: member.id,
          accountNumber: member.numeroCompte,
          name: member.nomComplet,
          phone: member.telephone,
          joinedAt: member.dateAdhesion,
          status: member.statut,
          lastDeposit: lastDepositByAccount.get(member.numeroCompte) ?? null,
          balanceUSD: Math.round(balance.USD * 100) / 100,
          balanceFC: Math.round(balance.FC * 100) / 100,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const netAfter = (cutoff: Date, currency: Devise) => {
      const savings = historyEntries
        .filter((entry) => entry.devise === currency && entry.dateOperation > cutoff)
        .reduce((sum, entry) => sum + Number(entry.montant) * (entry.typeOperation === 'retrait' ? -1 : 1), 0);
      const feesAfter = historyFees
        .filter((entry) => entry.devise === currency && entry.dateOperation > cutoff)
        .reduce((sum, entry) => sum + Number(entry.frais), 0);
      return savings - feesAfter;
    };
    const currentUSD = [...balanceByAccount.values()].reduce((sum, item) => sum + item.USD, 0);
    const currentFC = [...balanceByAccount.values()].reduce((sum, item) => sum + item.FC, 0);
    const months = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
      const cutoff = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
      return {
        label: new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit' }).format(date),
        USD: Math.round((currentUSD - netAfter(cutoff, Devise.USD)) * 100) / 100,
        FC: Math.round((currentFC - netAfter(cutoff, Devise.FC)) * 100) / 100,
      };
    });
    const daily = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(dailyStart.getFullYear(), dailyStart.getMonth(), dailyStart.getDate() + index);
      const cutoff = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
      return {
        label: new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date),
        USD: Math.round((currentUSD - netAfter(cutoff, Devise.USD)) * 100) / 100,
        FC: Math.round((currentFC - netAfter(cutoff, Devise.FC)) * 100) / 100,
      };
    });

    const [deposits, withdrawals] = await Promise.all([
      this.prisma.epargne.findMany({
        where: { ...principalFilter, typeOperation: 'depot' },
        include: { membre: { select: { id: true, nomComplet: true } } },
        orderBy: { dateOperation: 'desc' },
        take: 20,
      }),
      this.prisma.retrait.findMany({
        where: { NOT: systemAccounts },
        include: { membre: { select: { id: true, nomComplet: true } } },
        orderBy: { dateOperation: 'desc' },
        take: 20,
      }),
    ]);
    const operations = [
      ...deposits.map((row) => ({ id: `d-${row.id}`, type: 'depot', memberId: row.membre.id, accountNumber: row.compte, memberName: row.membre.nomComplet, amount: Number(row.montant), currency: row.devise, date: row.dateOperation, status: 'COMPLETED', description: row.description })),
      ...withdrawals.map((row) => ({ id: `r-${row.id}`, type: 'retrait', memberId: row.membre.id, accountNumber: row.compte, memberName: row.membre.nomComplet, amount: Number(row.montant), currency: row.devise, date: row.dateOperation, status: row.statut, description: row.description })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 20);

    return {
      overview: {
        balanceUSD: Math.round(currentUSD * 100) / 100,
        balanceFC: Math.round(currentFC * 100) / 100,
        holderCount: holders.length,
        depositsThisMonth: monthTotals.deposits,
        withdrawalsThisMonth: monthTotals.withdrawals,
      },
      holders,
      members: members.map((member) => ({ id: member.id, accountNumber: member.numeroCompte, name: member.nomComplet })),
      operations,
      history: { monthly: months, daily },
    };
  }

  private getSumFromGrouped(
    arr: {
      devise: Devise;
      _sum: { montant?: any; frais?: any };
    }[],
    devise: Devise,
    field: 'montant' | 'frais' = 'montant',
  ): number {
    const item = arr.find((d) => d.devise === devise);
    if (!item || !item._sum) return 0;
    return Number(item._sum[field]) || 0;
  }

  async getSoldes(numeroCompte: string) {
    const membre = await this.prisma.membre.findUnique({
      where: { numeroCompte },
    });

    if (!membre) {
      return { soldeFC: 0, soldeUSD: 0 };
    }

    // Filtre typeCompte = 'PRINCIPAL' : le solde retirable n'inclut jamais
    // le capital d'un DAT bloqué jusqu'à échéance (décision E1).
    const principal = { compte: numeroCompte, typeCompte: 'PRINCIPAL' };

    // Calculer les dépôts
    const sumDepots = await this.prisma.epargne.groupBy({
      by: ['devise'],
      where: { ...principal, typeOperation: 'depot' },
      _sum: { montant: true },
    });

    // Calculer les retraits
    const sumRetraits = await this.prisma.epargne.groupBy({
      by: ['devise'],
      where: { ...principal, typeOperation: 'retrait' },
      _sum: { montant: true },
    });

    // Calculer les frais de retrait (depuis la table retraits)
    const sumFrais = await this.prisma.retrait.groupBy({
      by: ['devise'],
      where: { compte: numeroCompte, statut: 'COMPLETED' },
      _sum: { frais: true },
    });

    const depFC = this.getSumFromGrouped(sumDepots, 'FC');
    const retFC = this.getSumFromGrouped(sumRetraits, 'FC');
    const fraFC = this.getSumFromGrouped(sumFrais, 'FC', 'frais');

    const depUSD = this.getSumFromGrouped(sumDepots, 'USD');
    const retUSD = this.getSumFromGrouped(sumRetraits, 'USD');
    const fraUSD = this.getSumFromGrouped(sumFrais, 'USD', 'frais');

    return {
      soldeFC: depFC - retFC - fraFC,
      soldeUSD: depUSD - retUSD - fraUSD,
    };
  }

  async getTotalsAll() {
    const excludeSystem = [
      { compte: { contains: 'REVENUS' } },
      { compte: { contains: 'SECTION-0000' } },
      { compte: { contains: 'CREDITS' } },
      { compte: { contains: 'TRESORERIE' } },
    ];

    const sumDepots = await this.prisma.epargne.groupBy({
      by: ['devise'],
      where: {
        typeOperation: 'depot',
        NOT: excludeSystem,
      },
      _sum: { montant: true },
    });

    const sumRetraits = await this.prisma.epargne.groupBy({
      by: ['devise'],
      where: {
        typeOperation: 'retrait',
        NOT: excludeSystem,
      },
      _sum: { montant: true },
    });

    const sumFrais = await this.prisma.retrait.groupBy({
      by: ['devise'],
      where: {
        NOT: excludeSystem,
        statut: 'COMPLETED',
      },
      _sum: { frais: true },
    });

    return {
      totalFC:
        this.getSumFromGrouped(sumDepots, 'FC') -
        this.getSumFromGrouped(sumRetraits, 'FC') -
        this.getSumFromGrouped(sumFrais, 'FC', 'frais'),
      totalUSD:
        this.getSumFromGrouped(sumDepots, 'USD') -
        this.getSumFromGrouped(sumRetraits, 'USD') -
        this.getSumFromGrouped(sumFrais, 'USD', 'frais'),
    };
  }

  async create(createDto: CreateSavingsDto, actor: AuthUser) {
    const { typeOperation, devise, montant } = createDto;

    if (actor.role === 'agent') {
      if (typeOperation !== TypeOperation.depot) {
        throw new ForbiddenException(
          'Un agent ne peut enregistrer que les dépôts ici; les retraits passent par le parcours biométrique dédié.',
        );
      }
      if (!actor.userId) throw new ForbiddenException('Session agent invalide');
      if (!createDto.idempotencyKey) {
        throw new BadRequestException('La clé idempotente du dépôt est obligatoire.');
      }
    }

    // Validation du montant minimum pour les dépôts
    if (typeOperation === TypeOperation.depot) {
      const params = await this.parametresService.getGeneralParameters();
      const montantMin =
        devise === Devise.FC
          ? params.montant_min_depot_fc || 1000
          : params.montant_min_depot_usd || 1;

      if (montant < montantMin) {
        throw new BadRequestException(
          `Montant minimum de dépôt requis: ${montantMin} ${devise}`,
        );
      }
    }

    if (actor.role !== 'agent') {
      if (typeOperation !== TypeOperation.depot) {
        return this.prisma.epargne.create({
          data: {
            compte: createDto.compte,
            typeOperation: createDto.typeOperation,
            devise: createDto.devise,
            montant: createDto.montant,
            dateOperation: new Date(createDto.dateOperation),
            description: createDto.description,
          },
        });
      }

      const member = await this.prisma.membre.findUnique({
        where: { numeroCompte: createDto.compte },
        select: {
          id: true,
          numeroCompte: true,
          statut: true,
          userId: true,
          delegues: { select: { userId: true } },
        },
      });
      if (!member || member.statut !== 'actif' || createDto.compte.includes('REVENUS') || createDto.compte.includes('CREDITS') || createDto.compte.includes('TRESORERIE')) {
        throw new NotFoundException('Compte membre actif introuvable.');
      }

      const scannedUserId = createDto.biometricUserId?.trim();
      if (!scannedUserId) {
        throw new BadRequestException(
          'Capturez et vérifiez l’empreinte du membre ou de son délégué avant de valider le dépôt.',
        );
      }
      if (
        member.userId !== scannedUserId &&
        !member.delegues.some((delegate) => delegate.userId === scannedUserId)
      ) {
        throw new ForbiddenException(
          'L’empreinte reconnue ne correspond ni au membre ni à un délégué autorisé pour ce compte.',
        );
      }

      return this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw<Array<{ id: number }>>`
          SELECT "id" FROM "membres" WHERE "id" = ${member.id} FOR UPDATE
        `;
        await tx.$queryRaw<Array<{ id: number }>>`
          SELECT "id" FROM "delegues" WHERE "membre_id" = ${member.id} FOR UPDATE
        `;
        const currentMember = await tx.membre.findUnique({
          where: { id: member.id },
          select: { numeroCompte: true, statut: true, userId: true, delegues: { select: { userId: true } } },
        });
        if (!currentMember || currentMember.statut !== 'actif') {
          throw new NotFoundException('Compte membre introuvable ou inactif.');
        }
        if (currentMember.userId !== scannedUserId && !currentMember.delegues.some((delegate) => delegate.userId === scannedUserId)) {
          throw new ForbiddenException('L’autorisation biométrique du membre ou de son délégué a changé pendant la capture.');
        }

        const operation = await tx.epargne.create({
          data: {
            compte: currentMember.numeroCompte,
            typeOperation: TypeOperation.depot,
            devise,
            montant,
            dateOperation: new Date(createDto.dateOperation),
            description: createDto.description?.trim() || `Dépôt au guichet — ${currentMember.numeroCompte}`,
            executeParId: actor.userId ?? null,
            executeParRole: actor.role ?? null,
          },
        });
        await tx.adminLog.create({
          data: {
            action: 'DEPOT_GUICHET',
            details: `Dépôt ${operation.id}, compte ${currentMember.numeroCompte}, ${montant} ${devise}; acteur ${actor.role} #${actor.userId ?? 'inconnu'}; vérification biométrique membre/délégué validée.`,
            success: true,
            userId: actor.userId ?? null,
          },
        });
        return operation;
      });
    }

    const agentId = actor.userId!;
    const member = await this.prisma.membre.findUnique({
      where: { numeroCompte: createDto.compte },
      select: {
        id: true,
        numeroCompte: true,
        statut: true,
        userId: true,
        delegues: { select: { userId: true } },
      },
    });
    if (!member || member.statut !== 'actif' || createDto.compte.includes('REVENUS') || createDto.compte.includes('CREDITS') || createDto.compte.includes('TRESORERIE')) {
      throw new NotFoundException('Compte membre actif introuvable.');
    }

    const replay = await this.prisma.mouvementCaisseAgent.findUnique({
      where: { idempotencyKey: createDto.idempotencyKey },
      include: { caisse: { select: { agentId: true } } },
    });
    if (replay) {
      const operation = replay.epargneId
        ? await this.prisma.epargne.findUnique({ where: { id: replay.epargneId } })
        : null;
      if (
        replay.caisse.agentId !== agentId || replay.type !== 'DEPOT' ||
        replay.devise !== devise || Number(replay.montant) !== montant ||
        operation?.compte !== createDto.compte
      ) {
        throw new ConflictException('La clé idempotente est déjà utilisée par une autre opération.');
      }
      return operation;
    }

    const scannedUserId = await this.captureAndVerifyMemberFingerprint(
      member.userId,
      member.delegues.map((delegate) => delegate.userId),
    );

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: number }>>`
        SELECT "id" FROM "caisses_agents"
        WHERE "agent_id" = ${agentId} AND "devise" = ${devise}::"Devise"
        FOR UPDATE
      `;
      const duplicate = await tx.mouvementCaisseAgent.findUnique({
        where: { idempotencyKey: createDto.idempotencyKey },
        include: { caisse: { select: { agentId: true } } },
      });
      if (duplicate) {
        if (duplicate.caisse.agentId !== agentId || duplicate.type !== 'DEPOT' || duplicate.devise !== devise || Number(duplicate.montant) !== montant) {
          throw new ConflictException('La clé idempotente est déjà utilisée par une autre opération.');
        }
        if (duplicate.epargneId) {
          const existingDeposit = await tx.epargne.findUnique({ where: { id: duplicate.epargneId } });
          if (existingDeposit?.compte === createDto.compte) return existingDeposit;
          throw new ConflictException('La clé idempotente est déjà utilisée par une autre opération.');
        }
        throw new ConflictException('Cette opération est déjà traitée mais sa référence est manquante.');
      }

      await tx.$queryRaw<Array<{ id: number }>>`
        SELECT "id" FROM "membres" WHERE "id" = ${member.id} FOR UPDATE
      `;
      await tx.$queryRaw<Array<{ id: number }>>`
        SELECT "id" FROM "delegues" WHERE "membre_id" = ${member.id} FOR UPDATE
      `;
      const currentMember = await tx.membre.findUnique({
        where: { id: member.id },
        select: { statut: true, userId: true, delegues: { select: { userId: true } } },
      });
      if (!currentMember || currentMember.statut !== 'actif') {
        throw new BadRequestException('Le compte membre est inactif.');
      }
      if (currentMember.userId !== scannedUserId && !currentMember.delegues.some((delegate) => delegate.userId === scannedUserId)) {
        throw new ForbiddenException('L’autorisation biométrique du membre ou de son délégué a changé pendant la capture.');
      }
      const caisse = await tx.caisseAgent.findUnique({
        where: { agentId_devise: { agentId, devise } },
      });
      if (!caisse) throw new BadRequestException('Votre caisse n’est pas initialisée dans cette devise.');

      const dateOperation = new Date();
      const operation = await tx.epargne.create({
        data: {
          compte: member.numeroCompte,
          typeOperation: TypeOperation.depot,
          devise,
          montant,
          dateOperation,
          description: createDto.description?.trim() || `Dépôt au guichet — ${member.numeroCompte}`,
          executeParId: agentId,
          executeParRole: 'agent',
        },
      });
      const avant = Number(caisse.solde);
      const apres = avant + montant;
      await tx.caisseAgent.update({ where: { id: caisse.id }, data: { solde: { increment: montant } } });
      await tx.mouvementCaisseAgent.create({
        data: {
          caisseId: caisse.id,
          epargneId: operation.id,
          type: 'DEPOT',
          devise,
          montant,
          soldeAvant: avant,
          soldeApres: apres,
          motif: `Dépôt reçu pour le compte ${member.numeroCompte}`,
          acteurId: agentId,
          acteurRole: 'agent',
          idempotencyKey: createDto.idempotencyKey,
        },
      });
      await tx.adminLog.create({
        data: {
          action: 'DEPOT_GUICHET',
          details: `Dépôt ${operation.id}, compte ${member.numeroCompte}, ${montant} ${devise}; agent #${agentId}; caisse ${avant} → ${apres}.`,
          success: true,
          userId: agentId,
        },
      });
      return operation;
    });
  }

  async remove(id: number) {
    return this.prisma.epargne.delete({ where: { id } });
  }

  async getSoldeByTypeCompte(type: string) {
    const typesNormalised = type.toUpperCase();
    const membres = await this.prisma.membre.findMany({
      where: { typeCompte: typesNormalised },
      select: { numeroCompte: true },
    });

    const comptes = membres.map((m) => m.numeroCompte);
    if (comptes.length === 0) return { soldeFC: 0, soldeUSD: 0 };

    const sumDepots = await this.prisma.epargne.groupBy({
      by: ['devise'],
      where: { compte: { in: comptes }, typeOperation: 'depot' },
      _sum: { montant: true },
    });

    const sumRetraits = await this.prisma.epargne.groupBy({
      by: ['devise'],
      where: { compte: { in: comptes }, typeOperation: 'retrait' },
      _sum: { montant: true },
    });

    const sumFrais = await this.prisma.retrait.groupBy({
      by: ['devise'],
      where: { compte: { in: comptes }, statut: 'COMPLETED' },
      _sum: { frais: true },
    });

    return {
      soldeFC:
        this.getSumFromGrouped(sumDepots, 'FC') -
        this.getSumFromGrouped(sumRetraits, 'FC') -
        this.getSumFromGrouped(sumFrais, 'FC', 'frais'),
      soldeUSD:
        this.getSumFromGrouped(sumDepots, 'USD') -
        this.getSumFromGrouped(sumRetraits, 'USD') -
        this.getSumFromGrouped(sumFrais, 'USD', 'frais'),
    };
  }

  async getAllBalances() {
    const membres = await this.prisma.membre.findMany({
      select: { numeroCompte: true },
    });

    const epargneStats = await this.prisma.epargne.groupBy({
      by: ['compte', 'devise', 'typeOperation'],
      _sum: { montant: true },
    });

    const retraitFraisStats = await this.prisma.retrait.groupBy({
      by: ['compte', 'devise'],
      where: { statut: 'COMPLETED' },
      _sum: { frais: true },
    });

    return membres.map((m) => {
      const getSum = (devise: Devise, type: PrismaTypeOperation) => {
        const item = epargneStats.find(
          (s) =>
            s.compte === m.numeroCompte &&
            s.devise === devise &&
            s.typeOperation === type,
        );
        return item ? item._sum.montant || 0 : 0;
      };

      const getFrais = (devise: Devise) => {
        const item = retraitFraisStats.find(
          (s) => s.compte === m.numeroCompte && s.devise === devise,
        );
        return item ? item._sum.frais || 0 : 0;
      };

      return {
        numero_compte: m.numeroCompte,
        soldeFC:
          Number(getSum(Devise.FC, PrismaTypeOperation.depot)) -
          Number(getSum(Devise.FC, PrismaTypeOperation.retrait)) -
          Number(getFrais(Devise.FC)),
        soldeUSD:
          Number(getSum(Devise.USD, PrismaTypeOperation.depot)) -
          Number(getSum(Devise.USD, PrismaTypeOperation.retrait)) -
          Number(getFrais(Devise.USD)),
      };
    });
  }
}
