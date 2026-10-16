import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BalancesService } from '../balances/balances.service';
import { CreateCreditDto, StatutCredit } from './dto/create-credit.dto';
import { Devise } from '@prisma/client';
import { getSectionTrigram } from '../common/constants/sections';

@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(
    private prisma: PrismaService,
    private balancesService: BalancesService,
  ) {}

  async findAll() {
    const credits = await this.prisma.credit.findMany({
      orderBy: { createdAt: 'desc' },
      include: { membre: true },
    });

    return credits.map((credit) => this.mapCreditToResponse(credit));
  }

  async findAllPaginated(page: number = 1, pageSize: number = 10) {
    const skip = (page - 1) * pageSize;

    const [total, credits] = await Promise.all([
      this.prisma.credit.count(),
      this.prisma.credit.findMany({
        orderBy: { createdAt: 'desc' },
        include: { membre: true },
        skip,
        take: pageSize,
      }),
    ]);

    const data = credits.map((credit) => this.mapCreditToResponse(credit));

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

  private mapCreditToResponse(credit: any) {
    const totalPrincipal = Number(credit.montant);
    const taux = Number(credit.tauxInteret) || 15;
    const totalA_Payer = totalPrincipal * (1 + taux / 100);
    const dejaPaye = Number(credit.montantRembourse) || 0;
    const remainingAmount = Math.max(0, totalA_Payer - dejaPaye);

    const statusMap = {
      [StatutCredit.actif]: 'active',
      [StatutCredit.rembourse]: 'repaid',
      [StatutCredit.en_retard]: 'overdue',
    };

    return {
      id: credit.id.toString(),
      memberName: credit.membre?.nomComplet || credit.numeroCompte,
      memberRole: credit.membre?.typeCompte || '',
      initials: credit.membre?.nomComplet
        ? credit.membre.nomComplet
            .split(' ')
            .map((n: string) => n[0])
            .join('')
            .toUpperCase()
        : 'N/A',
      amount: Number(credit.montant),
      remainingAmount,
      currency: credit.devise,
      startDate: credit.dateDebut.toISOString().split('T')[0],
      interestRate: Number(credit.tauxInteret),
      durationMonths: credit.duree,
      status: statusMap[credit.statut] || 'active',
    };
  }

  async findOne(id: number) {
    const credit = await this.prisma.credit.findUnique({
      where: { id },
      include: { remboursements: true, membre: true },
    });
    if (!credit) throw new NotFoundException('Crédit non trouvé');
    return credit;
  }

  async findByMembre(numeroCompte: string) {
    return this.prisma.credit.findMany({
      where: { numeroCompte },
      include: { remboursements: true },
    });
  }

  async getSoldes() {
    const results = await this.prisma.credit.groupBy({
      by: ['devise'],
      _sum: {
        montant: true,
      },
    });

    const soldeUSD = results.find((r) => r.devise === 'USD')?._sum.montant || 0;
    const soldeFC = results.find((r) => r.devise === 'FC')?._sum.montant || 0;

    return { soldeUSD, soldeFC };
  }

  async getUpcomingDueDates(limit = 5, days = 30) {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const until = new Date(from);
    until.setDate(until.getDate() + days);

    const credits = await this.prisma.credit.findMany({
      where: {
        statut: { in: [StatutCredit.actif, StatutCredit.en_retard] },
        dateEcheance: { gte: from, lte: until },
      },
      orderBy: { dateEcheance: 'asc' },
      take: limit,
      include: { membre: { select: { nomComplet: true } } },
    });

    return {
      data: credits.map((credit) => ({
        id: credit.id,
        memberName: credit.membre.nomComplet,
        dueDate: credit.dateEcheance!.toISOString(),
        amountRemaining: Math.max(
          0,
          Number(credit.montant) * (1 + Number(credit.tauxInteret) / 100) -
            Number(credit.montantRembourse),
        ),
        currency: credit.devise,
        status: credit.statut,
      })),
    };
  }

  async getStats() {
    try {
      const credits = await this.prisma.credit.findMany({
        select: {
          id: true,
          montant: true,
          statut: true,
          devise: true,
        },
      });

      const getAmountByDevise = (statutFilter?: StatutCredit) => {
        return {
          usd: credits
            .filter(
              (c) =>
                c.devise === 'USD' &&
                (!statutFilter || c.statut === statutFilter),
            )
            .reduce((sum, c) => sum + Number(c.montant), 0),
          fc: credits
            .filter(
              (c) =>
                c.devise === 'FC' &&
                (!statutFilter || c.statut === statutFilter),
            )
            .reduce((sum, c) => sum + Number(c.montant), 0),
        };
      };

      const totalAmount = getAmountByDevise();
      const activeAmount = getAmountByDevise(StatutCredit.actif);
      const overdueAmount = getAmountByDevise(StatutCredit.en_retard);

      const tresorerie = await this.balancesService.getTresorerieDisponible();
      const availableBalance = {
        usd: tresorerie.usd.disponible,
        fc: tresorerie.fc.disponible,
      };

      return {
        totalAmount,
        activeAmount,
        overdueAmount,
        availableBalance,
        totalCount: credits.length,
        activeCount: credits.filter((c) => c.statut === StatutCredit.actif)
          .length,
        overdueCount: credits.filter((c) => c.statut === StatutCredit.en_retard)
          .length,
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors du calcul des statistiques des crédits:',
        error,
      );
      throw error;
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // CRÉATION DE CRÉDIT AVEC VALIDATION DE TRÉSORERIE + DOUBLE ÉCRITURE
  // ────────────────────────────────────────────────────────────────────
  async create(createDto: CreateCreditDto) {
    const { numeroCompte, montant, duree, dateDebut, devise } = createDto;
    const tauxInteret = createDto.tauxInteret ?? 15;

    this.logger.log(
      `📋 Demande de crédit: ${montant} ${devise} pour ${numeroCompte}`,
    );

    // ── 1. Vérifier que le membre existe ──────────────────────────────
    const membre = await this.prisma.membre.findUnique({
      where: { numeroCompte },
    });
    if (!membre) {
      throw new BadRequestException("Le membre n'existe pas");
    }

    // ── 1b. Compte activé et actif requis pour octroyer un crédit ─────
    if (membre.statut !== 'actif') {
      throw new BadRequestException(
        'Ce membre est inactif : octroi de crédit impossible',
      );
    }

    if (!membre.isActivated) {
      throw new BadRequestException(
        'Ce compte membre n’est pas encore activé : le membre doit finaliser son activation avant tout crédit',
      );
    }

    // ── 2. Vérifier la trésorerie disponible ─────────────────────────
    const tresorerie = await this.balancesService.getTresorerieDisponible();

    const deviseKey = devise === 'USD' ? 'usd' : 'fc';
    const disponible = tresorerie[deviseKey].disponible;

    if (montant > disponible) {
      this.logger.warn(
        `❌ Trésorerie insuffisante: demandé ${montant} ${devise}, disponible ${disponible} ${devise}`,
      );
      throw new BadRequestException(
        `Trésorerie insuffisante. Montant demandé: ${montant} ${devise}. ` +
          `Disponible après réserve de 20%: ${disponible} ${devise}. ` +
          `Caisse totale: ${tresorerie[deviseKey].caisse} ${devise}, ` +
          `Réserve obligatoire: ${tresorerie[deviseKey].reserve} ${devise}, ` +
          `Encours crédits: ${tresorerie[deviseKey].encoursCredits} ${devise}.`,
      );
    }

    this.logger.log(
      `✅ Trésorerie validée: disponible ${disponible} ${devise}`,
    );

    // ── 3. Calculer les dates ────────────────────────────────────────
    const dateD = new Date(dateDebut);
    const dateEcheance = new Date(dateD);
    dateEcheance.setMonth(dateEcheance.getMonth() + duree);

    // ── 4. Transaction Prisma : double écriture comptable ────────────
    const credit = await this.prisma.$transaction(async (tx) => {
      // 4.1 Créer l'enregistrement du crédit
      const credit = await tx.credit.create({
        data: {
          numeroCompte,
          montant,
          devise,
          tauxInteret,
          duree,
          dateDebut: dateD,
          dateEcheance,
          statut: StatutCredit.actif,
          description: createDto.description,
          derniereOperation: dateD,
        },
      });

      this.logger.log(`📝 Crédit #${credit.id} créé: ${montant} ${devise}`);

      // 4.2 Enregistrer la sortie de trésorerie (décaissement)
      const sectionTrigram = getSectionTrigram(membre.typeCompte);
      const compteCreditSection = `MW-${sectionTrigram}-CREDITS`;

      await tx.epargne.create({
        data: {
          compte: compteCreditSection,
          typeOperation: 'retrait',
          devise: devise as Devise,
          montant,
          dateOperation: dateD,
          description: `Décaissement crédit #${credit.id} pour ${numeroCompte} (${membre.nomComplet})`,
        },
      });

      this.logger.log(
        `📝 Sortie trésorerie section: ${compteCreditSection} -${montant} ${devise}`,
      );

      // 4.3 Enregistrer aussi une sortie sur la caisse globale
      await tx.epargne.create({
        data: {
          compte: 'MW-TRESORERIE-CREDITS',
          typeOperation: 'retrait',
          devise: devise as Devise,
          montant,
          dateOperation: dateD,
          description: `Décaissement crédit #${credit.id} membre ${numeroCompte} (via ${membre.typeCompte})`,
        },
      });

      this.logger.log(
        `📝 Sortie trésorerie globale: MW-TRESORERIE-CREDITS -${montant} ${devise}`,
      );
      this.logger.log(`✅ Crédit #${credit.id} décaissé avec succès`);

      return credit;
    });

    // Appel à la libération dynamique de la garantie
    await this.balancesService.rafraichirGarantie(membre.id);
    this.logger.log(`🔒 Garantie recalculée pour membre #${membre.id}`);
    return credit;
  }
}
