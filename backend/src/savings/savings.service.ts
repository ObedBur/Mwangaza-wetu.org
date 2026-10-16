import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSavingsDto, TypeOperation } from './dto/create-savings.dto';
import {
  Devise,
  TypeOperationEpargne as PrismaTypeOperation,
} from '@prisma/client';
import { ParametresService } from '../parametres/parametres.service';

@Injectable()
export class SavingsService {
  constructor(
    private prisma: PrismaService,
    private parametresService: ParametresService,
  ) {}

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

    // Calculer les dépôts
    const sumDepots = await this.prisma.epargne.groupBy({
      by: ['devise'],
      where: { compte: numeroCompte, typeOperation: 'depot' },
      _sum: { montant: true },
    });

    // Calculer les retraits
    const sumRetraits = await this.prisma.epargne.groupBy({
      by: ['devise'],
      where: { compte: numeroCompte, typeOperation: 'retrait' },
      _sum: { montant: true },
    });

    // Calculer les frais de retrait (depuis la table retraits)
    const sumFrais = await this.prisma.retrait.groupBy({
      by: ['devise'],
      where: { compte: numeroCompte },
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

  async create(createDto: CreateSavingsDto) {
    const { typeOperation, devise, montant } = createDto;

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
      where: { compte: { in: comptes } },
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
