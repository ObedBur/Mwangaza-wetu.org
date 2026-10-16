import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Devise,
  StatutCredit,
  StatutProjet,
  TypeOperationEpargne,
} from '@prisma/client';

@Injectable()
export class BalancesService {
  /**
   * Recalcule et retourne la garantie gelée pour un membre (tous crédits actifs)
   */
  async rafraichirGarantie(membreId: number, tauxGarantie = 0.3) {
    // Récupérer le numéro de compte du membre
    const membre = await this.prisma.membre.findUnique({
      where: { id: membreId },
      select: { numeroCompte: true },
    });
    if (!membre) throw new Error('Membre non trouvé');

    // Récupérer tous les crédits actifs du membre
    const creditsActifs = await this.prisma.credit.findMany({
      where: { numeroCompte: membre.numeroCompte, statut: 'actif' },
      select: { montant: true, montantRembourse: true, devise: true },
    });

    // Calculer la garantie gelée (somme des encours × tauxGarantie)
    const garantieFC = creditsActifs
      .filter((c) => c.devise === 'FC')
      .reduce(
        (sum, c) =>
          sum + (Number(c.montant) - Number(c.montantRembourse)) * tauxGarantie,
        0,
      );

    const garantieUSD = creditsActifs
      .filter((c) => c.devise === 'USD')
      .reduce(
        (sum, c) =>
          sum + (Number(c.montant) - Number(c.montantRembourse)) * tauxGarantie,
        0,
      );

    return {
      fc: Math.round(garantieFC * 100) / 100,
      usd: Math.round(garantieUSD * 100) / 100,
    };
  }
  constructor(private prisma: PrismaService) {}

  async getTotal() {
    const excludeSystem = [
      { compte: { contains: 'REVENUS' } },
      { compte: { contains: 'SECTION-0000' } },
      { compte: { contains: 'CREDITS' } },
      { compte: { contains: 'TRESORERIE' } },
    ];

    const epargneStats = await this.prisma.epargne.groupBy({
      by: ['devise', 'typeOperation'],
      where: {
        NOT: excludeSystem,
      },
      _sum: { montant: true },
    });

    const getSum = (devise: Devise, type: TypeOperationEpargne) => {
      const item = epargneStats.find(
        (s) => s.devise === devise && s.typeOperation === type,
      );
      return item ? item._sum.montant || 0 : 0;
    };

    const creditStats = await this.prisma.credit.groupBy({
      by: ['devise'],
      _sum: { montant: true, montantRembourse: true },
    });

    const getCreditSum = (devise: Devise) => {
      const item = creditStats.find((s) => s.devise === devise);
      return {
        total: item ? item._sum.montant || 0 : 0,
        rembourse: item ? item._sum.montantRembourse || 0 : 0,
      };
    };

    const fraisStats = await this.prisma.retrait.groupBy({
      by: ['devise'],
      where: {
        NOT: excludeSystem,
      },
      _sum: { frais: true },
    });

    const getFraisSum = (devise: Devise) => {
      const item = fraisStats.find((s) => s.devise === devise);
      return item ? item._sum.frais || 0 : 0;
    };

    const beneficesFC = await this.prisma.epargne.aggregate({
      where: {
        compte: 'MW-REVENUS-GLOBAL',
        devise: Devise.FC,
        typeOperation: TypeOperationEpargne.depot,
      },
      _sum: { montant: true },
    });

    const beneficesUSD = await this.prisma.epargne.aggregate({
      where: {
        compte: 'MW-REVENUS-GLOBAL',
        devise: Devise.USD,
        typeOperation: TypeOperationEpargne.depot,
      },
      _sum: { montant: true },
    });

    return {
      fc: {
        solde:
          Number(getSum(Devise.FC, TypeOperationEpargne.depot)) -
          Number(getSum(Devise.FC, TypeOperationEpargne.retrait)) -
          Number(getFraisSum(Devise.FC)),
        epargne: Number(getSum(Devise.FC, TypeOperationEpargne.depot)),
        retrait: Number(getSum(Devise.FC, TypeOperationEpargne.retrait)),
        frais: Number(getFraisSum(Devise.FC)),
        credit: Number(getCreditSum(Devise.FC).total),
        remboursement: Number(getCreditSum(Devise.FC).rembourse),
        benefices: Number(beneficesFC._sum.montant || 0),
      },
      usd: {
        solde:
          Number(getSum(Devise.USD, TypeOperationEpargne.depot)) -
          Number(getSum(Devise.USD, TypeOperationEpargne.retrait)) -
          Number(getFraisSum(Devise.USD)),
        epargne: Number(getSum(Devise.USD, TypeOperationEpargne.depot)),
        retrait: Number(getSum(Devise.USD, TypeOperationEpargne.retrait)),
        frais: Number(getFraisSum(Devise.USD)),
        credit: Number(getCreditSum(Devise.USD).total),
        remboursement: Number(getCreditSum(Devise.USD).rembourse),
        benefices: Number(beneficesUSD._sum.montant || 0),
      },
    };
  }

  async getByType(typeCompte: string) {
    const typeNormalise = typeCompte.toUpperCase();
    const membres = await this.prisma.membre.findMany({
      where: { typeCompte: typeNormalise },
      select: { numeroCompte: true },
    });

    const comptes = membres.map((m) => m.numeroCompte);
    if (comptes.length === 0) {
      return {
        soldeFC: 0,
        soldeUSD: 0,
        epargneFC: 0,
        epargneUSD: 0,
        retraitFC: 0,
        retraitUSD: 0,
        creditFC: 0,
        creditUSD: 0,
        remboursementFC: 0,
        remboursementUSD: 0,
      };
    }

    const epargneStats = await this.prisma.epargne.groupBy({
      by: ['devise', 'typeOperation'],
      where: { compte: { in: comptes } },
      _sum: { montant: true },
    });

    const getSum = (devise: Devise, type: TypeOperationEpargne) => {
      const item = epargneStats.find(
        (s) => s.devise === devise && s.typeOperation === type,
      );
      return item ? item._sum.montant || 0 : 0;
    };

    const creditStats = await this.prisma.credit.groupBy({
      by: ['devise'],
      where: { numeroCompte: { in: comptes } },
      _sum: { montant: true, montantRembourse: true },
    });

    const getCreditSum = (devise: Devise) => {
      const item = creditStats.find((s) => s.devise === devise);
      return {
        montant: item ? item._sum.montant || 0 : 0,
        rembourse: item ? item._sum.montantRembourse || 0 : 0,
      };
    };

    return {
      soldeFC:
        Number(getSum(Devise.FC, TypeOperationEpargne.depot)) -
        Number(getSum(Devise.FC, TypeOperationEpargne.retrait)),
      soldeUSD:
        Number(getSum(Devise.USD, TypeOperationEpargne.depot)) -
        Number(getSum(Devise.USD, TypeOperationEpargne.retrait)),
      epargneFC: Number(getSum(Devise.FC, TypeOperationEpargne.depot)),
      epargneUSD: Number(getSum(Devise.USD, TypeOperationEpargne.depot)),
      retraitFC: Number(getSum(Devise.FC, TypeOperationEpargne.retrait)),
      retraitUSD: Number(getSum(Devise.USD, TypeOperationEpargne.retrait)),
      creditFC: Number(getCreditSum(Devise.FC).montant),
      creditUSD: Number(getCreditSum(Devise.USD).montant),
      remboursementFC: Number(getCreditSum(Devise.FC).rembourse),
      remboursementUSD: Number(getCreditSum(Devise.USD).rembourse),
    };
  }

  async getFraisRetraits() {
    const rows = await this.prisma.retrait.findMany({
      where: { frais: { gt: 0 } },
      orderBy: { dateOperation: 'desc' },
    });

    const aggregate = rows.reduce(
      (acc, r) => {
        const d = r.devise.toUpperCase();
        acc[d] = (acc[d] || 0) + Number(r.frais || 0);
        return acc;
      },
      {} as Record<string, number>,
    );

    return { rows, aggregate };
  }

  // ────────────────────────────────────────────────────────────────────
  // TRÉSORERIE DISPONIBLE POUR PRÊTS
  // Formule : (Total Épargnes - Total Retraits - Frais) - 20% réserve - Crédits actifs non remboursés
  // ────────────────────────────────────────────────────────────────────
  async getTresorerieDisponible() {
    const TAUX_RESERVE = 0.2; // 20% de réserve obligatoire

    const totals = await this.getTotal();

    // Crédits actifs non remboursés (montant - montantRembourse)
    const creditsActifs = await this.prisma.credit.findMany({
      where: { statut: 'actif' },
      select: { montant: true, montantRembourse: true, devise: true },
    });

    const encoursCreditFC = creditsActifs
      .filter((c) => c.devise === 'FC')
      .reduce(
        (sum, c) => sum + (Number(c.montant) - Number(c.montantRembourse)),
        0,
      );

    const encoursCreditUSD = creditsActifs
      .filter((c) => c.devise === 'USD')
      .reduce(
        (sum, c) => sum + (Number(c.montant) - Number(c.montantRembourse)),
        0,
      );

    // Caisse réelle = solde des épargnes (dépôts - retraits - frais)
    const caisseFC = totals.fc.solde;
    const caisseUSD = totals.usd.solde;

    // Réserve obligatoire de 20%
    const reserveFC = caisseFC * TAUX_RESERVE;
    const reserveUSD = caisseUSD * TAUX_RESERVE;

    // Trésorerie disponible = Caisse - Réserve - Encours crédits
    const disponibleFC = caisseFC - reserveFC - encoursCreditFC;
    const disponibleUSD = caisseUSD - reserveUSD - encoursCreditUSD;

    return {
      fc: {
        caisse: caisseFC,
        reserve: Math.round(reserveFC * 100) / 100,
        encoursCredits: encoursCreditFC,
        disponible: Math.round(Math.max(0, disponibleFC) * 100) / 100,
      },
      usd: {
        caisse: caisseUSD,
        reserve: Math.round(reserveUSD * 100) / 100,
        encoursCredits: encoursCreditUSD,
        disponible: Math.round(Math.max(0, disponibleUSD) * 100) / 100,
      },
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // SOLDE DISPONIBLE D'UN MEMBRE (avec nantissement/garantie)
  // Si le membre a un crédit actif, une partie de son épargne est gelée
  // en guise de garantie (= montant du crédit non encore remboursé * tauxGarantie)
  // ────────────────────────────────────────────────────────────────────
  async getSoldeDisponibleMembre(numeroCompte: string, tauxGarantie = 0.3) {
    // 1. Calculer le solde brut d'épargne du membre
    const epargneStats = await this.prisma.epargne.groupBy({
      by: ['typeOperation', 'devise'],
      where: { compte: numeroCompte },
      _sum: { montant: true },
    });

    const getEpargneSum = (devise: Devise, type: TypeOperationEpargne) => {
      const item = epargneStats.find(
        (s) => s.devise === devise && s.typeOperation === type,
      );
      return Number(item?._sum?.montant || 0);
    };

    const fraisStats = await this.prisma.retrait.groupBy({
      by: ['devise'],
      where: { compte: numeroCompte },
      _sum: { frais: true },
    });

    const getFrais = (devise: Devise) => {
      const item = fraisStats.find((s) => s.devise === devise);
      return Number(item?._sum?.frais || 0);
    };

    const soldeBrutFC =
      getEpargneSum(Devise.FC, TypeOperationEpargne.depot) -
      getEpargneSum(Devise.FC, TypeOperationEpargne.retrait) -
      getFrais(Devise.FC);

    const soldeBrutUSD =
      getEpargneSum(Devise.USD, TypeOperationEpargne.depot) -
      getEpargneSum(Devise.USD, TypeOperationEpargne.retrait) -
      getFrais(Devise.USD);

    // 2. Calculer la garantie gelée (encours crédits actifs * tauxGarantie)
    const creditsActifs = await this.prisma.credit.findMany({
      where: { numeroCompte, statut: 'actif' },
      select: { montant: true, montantRembourse: true, devise: true },
    });

    const garantieFC = creditsActifs
      .filter((c) => c.devise === 'FC')
      .reduce(
        (sum, c) =>
          sum + (Number(c.montant) - Number(c.montantRembourse)) * tauxGarantie,
        0,
      );

    const garantieUSD = creditsActifs
      .filter((c) => c.devise === 'USD')
      .reduce(
        (sum, c) =>
          sum + (Number(c.montant) - Number(c.montantRembourse)) * tauxGarantie,
        0,
      );

    return {
      fc: {
        soldeBrut: Math.round(soldeBrutFC * 100) / 100,
        garantieGelee: Math.round(garantieFC * 100) / 100,
        soldeDisponible:
          Math.round(Math.max(0, soldeBrutFC - garantieFC) * 100) / 100,
      },
      usd: {
        soldeBrut: Math.round(soldeBrutUSD * 100) / 100,
        garantieGelee: Math.round(garantieUSD * 100) / 100,
        soldeDisponible:
          Math.round(Math.max(0, soldeBrutUSD - garantieUSD) * 100) / 100,
      },
    };
  }

  async getDashboardOverview() {
    const total = await this.getTotal();
    const tresorerie = await this.getTresorerieDisponible();

    // Récupérer les soldes par type de membre
    const types = ['PRIVILEGE', 'ORDINAIRE', 'DELERE', 'ENTREPRISE'];
    const byType = await Promise.all(
      types.map(async (t) => ({
        type: t,
        ...(await this.getByType(t)),
      })),
    );

    // Evolution mensuelle (6 derniers mois)
    const history = await this.getMonthlyHistory();
    // Evolution quotidienne (90 derniers jours) pour le graphique interactif
    const dailyHistory = await this.getDailyHistory();

    // Détail des revenus
    const revenusData = await this.prisma.revenu.groupBy({
      by: ['typeRevenuId', 'devise'],
      _sum: { montant: true },
    });

    const typesRevenu = await this.prisma.revenuType.findMany();
    const [activeProjectsCount, activityGroups, creditsForKpis] = await Promise.all([
      this.prisma.projet.count({
        where: { statut: StatutProjet.EN_COURS },
      }),
      this.prisma.membre.groupBy({
        by: ['activite'],
        where: {
          NOT: [
            { numeroCompte: { contains: 'SECTION-0000' } },
            { numeroCompte: { contains: 'REVENUS' } },
            { numeroCompte: { contains: 'CREDITS' } },
            { numeroCompte: { contains: 'TRESORERIE' } },
          ],
        },
        _count: { _all: true },
      }),
      this.prisma.credit.findMany({
        where: {
          statut: { in: [StatutCredit.actif, StatutCredit.en_retard] },
        },
        select: {
          montant: true,
          montantRembourse: true,
          tauxInteret: true,
          devise: true,
        },
      }),
    ]);

    const activeCreditBalance = { usd: 0, fc: 0 };
    let totalDue = 0;
    let totalPaid = 0;
    for (const credit of creditsForKpis) {
      const principal = Number(credit.montant);
      const paid = Number(credit.montantRembourse);
      const due = principal * (1 + Number(credit.tauxInteret) / 100);
      const currencyKey = credit.devise === Devise.USD ? 'usd' : 'fc';
      activeCreditBalance[currencyKey] += Math.max(0, due - paid);
      totalDue += due;
      totalPaid += paid;
    }

    const revenusDetails = typesRevenu.map((tr) => {
      const fc =
        revenusData.find((r) => r.typeRevenuId === tr.id && r.devise === 'FC')
          ?._sum.montant || 0;
      const usd =
        revenusData.find((r) => r.typeRevenuId === tr.id && r.devise === 'USD')
          ?._sum.montant || 0;
      return {
        id: tr.id,
        nom: tr.nom,
        description: tr.description,
        totalFC: Number(fc),
        totalUSD: Number(usd),
      };
    });

    return {
      overview: {
        totalCaisse: { usd: total.usd.solde, fc: total.fc.solde },
        totalEpargne: { usd: total.usd.epargne, fc: total.fc.epargne },
        totalRetrait: { usd: total.usd.retrait, fc: total.fc.retrait },
        totalFrais: { usd: total.usd.frais, fc: total.fc.frais },
        totalRevenus: { usd: total.usd.benefices, fc: total.fc.benefices },
        totalCredits: { usd: total.usd.credit, fc: total.fc.credit },
        totalRemboursements: {
          usd: total.usd.remboursement,
          fc: total.fc.remboursement,
        },
        activeMembersCount: await this.prisma.membre.count({
          where: {
            statut: 'actif',
            NOT: {
              OR: [
                { typeCompte: 'SYSTEME' },
                { nomComplet: { contains: 'Compte Collectif' } },
                { nomComplet: { contains: 'REVENUS' } },
                { nomComplet: { contains: 'CRÉDITS' } },
              ],
            },
          },
        }),
        activeCreditsCount: await this.prisma.credit.count({
          where: {
            statut: { in: [StatutCredit.actif, StatutCredit.en_retard] },
          },
        }),
        activeCreditBalance,
        repaymentRate:
          totalDue > 0 ? Math.min(100, Math.round((totalPaid / totalDue) * 100)) : 0,
        activeProjectsCount,
        overdueCreditsCount: await this.prisma.credit.count({
          where: { statut: 'en_retard' },
        }),
        totalMembers: await this.prisma.membre.count({
          where: {
            NOT: {
              OR: [
                { typeCompte: 'SYSTEME' },
                { nomComplet: { contains: 'Compte Collectif' } },
                { nomComplet: { contains: 'REVENUS' } },
                { nomComplet: { contains: 'CRÉDITS' } },
              ],
            },
          },
        }),
        totalAccounts: await this.prisma.compteEpargne.count({
          where: {
            NOT: {
              OR: [
                { typeCompte: 'SYSTEME' },
                { membre: { nomComplet: { contains: 'Compte Collectif' } } },
                { membre: { nomComplet: { contains: 'REVENUS' } } },
                { membre: { nomComplet: { contains: 'CRÉDITS' } } },
              ],
            },
          },
        }),
      },
      revenusDetails,
      activityDistribution: activityGroups.map(({ activite, _count }) => ({
        activite: activite || 'Non renseigné',
        total: _count._all,
      })),
      tresorerie,
      byType,
      history,
      dailyHistory,
    };
  }

  async getRecentTransactions(limit = 10) {
    const systemAccountFilters = {
      NOT: [
        { compte: { contains: 'SECTION-0000' } },
        { compte: { contains: 'REVENUS' } },
        { compte: { contains: 'CREDITS' } },
        { compte: { contains: 'TRESORERIE' } },
      ],
    };

    const [savings, withdrawals, credits, repayments] = await Promise.all([
      this.prisma.epargne.findMany({
        where: { ...systemAccountFilters, remboursementId: null },
        orderBy: { dateOperation: 'desc' },
        take: limit,
        include: { membre: { select: { nomComplet: true } } },
      }),
      this.prisma.retrait.findMany({
        where: systemAccountFilters,
        orderBy: { dateOperation: 'desc' },
        take: limit,
        include: { membre: { select: { nomComplet: true } } },
      }),
      this.prisma.credit.findMany({
        orderBy: { dateDebut: 'desc' },
        take: limit,
        include: { membre: { select: { nomComplet: true } } },
      }),
      this.prisma.remboursement.findMany({
        where: { deletedAt: null },
        orderBy: { dateRemboursement: 'desc' },
        take: limit,
        include: {
          credit: {
            include: { membre: { select: { nomComplet: true } } },
          },
        },
      }),
    ]);

    const data = [
      ...savings.map((row) => ({
        id: `epargne-${row.id}`,
        memberName: row.membre.nomComplet,
        type: row.typeOperation === 'depot' ? 'Cotisation' : 'Retrait',
        amount: Number(row.montant),
        currency: row.devise,
        date: row.dateOperation,
        status: 'valid',
      })),
      ...withdrawals.map((row) => ({
        id: `retrait-${row.id}`,
        memberName: row.membre.nomComplet,
        type: 'Retrait',
        amount: Number(row.montant),
        currency: row.devise,
        date: row.dateOperation,
        status:
          row.statut === 'COMPLETED'
            ? 'valid'
            : row.statut === 'PENDING'
              ? 'pending'
              : 'rejected',
      })),
      ...credits.map((row) => ({
        id: `credit-${row.id}`,
        memberName: row.membre.nomComplet,
        type: 'Crédit',
        amount: Number(row.montant),
        currency: row.devise,
        date: row.dateDebut,
        status: row.statut,
      })),
      ...repayments.map((row) => ({
        id: `remboursement-${row.id}`,
        memberName: row.credit.membre.nomComplet,
        type: 'Remboursement',
        amount: Number(row.montant),
        currency: row.devise,
        date: row.dateRemboursement,
        status: 'valid',
      })),
    ]
      .sort((left, right) => right.date.getTime() - left.date.getTime())
      .slice(0, limit)
      .map((transaction) => ({
        ...transaction,
        date: transaction.date.toISOString(),
      }));

    return { data };
  }

  async getMonthlyHistory() {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);

    const [epargnes, credits] = await Promise.all([
      this.prisma.epargne.findMany({
        where: {
          dateOperation: { gte: twelveMonthsAgo },
          typeOperation: TypeOperationEpargne.depot,
          remboursementId: null,
          NOT: [
            { compte: { contains: 'SECTION-0000' } },
            { compte: { contains: 'REVENUS' } },
            { compte: { contains: 'CREDITS' } },
            { compte: { contains: 'TRESORERIE' } },
          ],
        },
        select: { dateOperation: true, montant: true, devise: true },
      }),
      this.prisma.credit.findMany({
        where: { dateDebut: { gte: twelveMonthsAgo } },
        select: { dateDebut: true, montant: true, devise: true },
      }),
    ]);

    const months = [...new Array(12)]
      .map((_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        return d.toISOString().substring(0, 7); // YYYY-MM
      })
      .reverse();

    return months.map((month) => {
      const filtered = epargnes.filter((e) =>
        e.dateOperation.toISOString().startsWith(month),
      );
      return {
        month,
        depotsUSD: filtered
          .filter((e) => e.devise === Devise.USD)
          .reduce((sum, e) => sum + Number(e.montant), 0),
        creditsUSD: credits
          .filter((c) => c.devise === Devise.USD && c.dateDebut.toISOString().startsWith(month))
          .reduce((sum, c) => sum + Number(c.montant), 0),
        depotsFC: filtered
          .filter((e) => e.devise === Devise.FC)
          .reduce((sum, e) => sum + Number(e.montant), 0),
        creditsFC: credits
          .filter((c) => c.devise === Devise.FC && c.dateDebut.toISOString().startsWith(month))
          .reduce((sum, c) => sum + Number(c.montant), 0),
      };
    });
  }

  async getDailyHistory() {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const [epargnes, credits, remboursements] = await Promise.all([
      this.prisma.epargne.findMany({
        where: {
          dateOperation: { gte: ninetyDaysAgo },
          typeOperation: TypeOperationEpargne.depot,
          remboursementId: null,
          NOT: [
            { compte: { contains: 'SECTION-0000' } },
            { compte: { contains: 'REVENUS' } },
            { compte: { contains: 'CREDITS' } },
            { compte: { contains: 'TRESORERIE' } },
          ],
        },
        select: {
          dateOperation: true,
          montant: true,
          typeOperation: true,
          devise: true,
        },
      }),
      this.prisma.credit.findMany({
        where: { dateDebut: { gte: ninetyDaysAgo } },
        select: { dateDebut: true, montant: true, devise: true },
      }),
      this.prisma.remboursement.findMany({
        where: { dateRemboursement: { gte: ninetyDaysAgo } },
        select: {
          dateRemboursement: true,
          montant: true,
          credit: { select: { devise: true } },
        },
      }),
    ]);

    const data: any[] = [];
    const now = new Date();
    for (let i = 90; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      const dayEpargnes = epargnes.filter((e) =>
        e.dateOperation.toISOString().startsWith(dateStr),
      );
      const dayCredits = credits.filter((c) =>
        c.dateDebut.toISOString().startsWith(dateStr),
      );
      const dayRemboursements = remboursements.filter((r) =>
        r.dateRemboursement.toISOString().startsWith(dateStr),
      );

      data.push({
        date: dateStr,
        epargneUSD: dayEpargnes
          .filter((e) => e.devise === Devise.USD)
          .reduce((sum, e) => sum + Number(e.montant), 0),
        creditUSD: dayCredits
          .filter((c) => c.devise === 'USD')
          .reduce((sum, c) => sum + Number(c.montant), 0),
        epargneFC: dayEpargnes
          .filter((e) => e.devise === Devise.FC)
          .reduce((sum, e) => sum + Number(e.montant), 0),
        creditFC: dayCredits
          .filter((c) => c.devise === 'FC')
          .reduce((sum, c) => sum + Number(c.montant), 0),
        remboursementsUSD: dayRemboursements
          .filter((r) => r.credit.devise === Devise.USD)
          .reduce((sum, r) => sum + Number(r.montant), 0),
        remboursementsFC: dayRemboursements
          .filter((r) => r.credit.devise === Devise.FC)
          .reduce((sum, r) => sum + Number(r.montant), 0),
      });
    }
    return data;
  }

  async findAll(query: { page?: number; pageSize?: number; search?: string }) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 10;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (query.search) {
      where.OR = [
        { numeroCompte: { contains: query.search, mode: 'insensitive' } },
        {
          membre: {
            nomComplet: { contains: query.search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [total, comptes] = await Promise.all([
      this.prisma.compteEpargne.count({ where }),
      this.prisma.compteEpargne.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          membre: true,
        },
        orderBy: { numeroCompte: 'asc' },
      }),
    ]);

    const data = comptes.map((c) => {
      const initials = c.membre?.nomComplet
        ? c.membre.nomComplet
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2)
        : '??';

      return {
        id: c.id.toString(),
        memberId: c.numeroCompte,
        memberName: c.membre?.nomComplet || 'Inconnu',
        initials,
        accountType: c.typeCompte.toLowerCase(),
        currency: 'USD', // Par défaut
        balanceUSD: Number(c.solde),
        balanceFC: 0,
        totalDeposits: Number(c.solde),
        totalWithdrawals: 0,
        status: c.statut === 'actif' ? 'active' : 'closed',
        lastTransaction: c.updatedAt,
        openedDate: c.dateOuverture || c.createdAt,
      };
    });

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
}
