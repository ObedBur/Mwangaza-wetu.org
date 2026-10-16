import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Devise, TypeOperationEpargne } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getRapport(type: string, periode: string) {
    let start: Date;
    let end: Date;

    if (type === 'jour') {
      start = new Date(periode);
      start.setHours(0, 0, 0, 0);
      end = new Date(periode);
      end.setHours(23, 59, 59, 999);
    } else if (type === 'semaine') {
      if (!/-W/.test(periode))
        throw new BadRequestException('Format de semaine invalide');
      const [year, week] = periode.split('-W');
      const y = parseInt(year);
      const w = parseInt(week);

      const firstDay = new Date(y, 0, 1 + (w - 1) * 7);
      while (firstDay.getDay() !== 1) firstDay.setDate(firstDay.getDate() - 1);

      start = new Date(firstDay);
      start.setHours(0, 0, 0, 0);

      end = new Date(firstDay);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (type === 'mois') {
      const [year, month] = periode.split('-');
      const y = parseInt(year);
      const m = parseInt(month);
      start = new Date(y, m - 1, 1, 0, 0, 0, 0);
      end = new Date(y, m, 0, 23, 59, 59, 999);
    } else if (type === 'annee') {
      const y = parseInt(periode);
      start = new Date(y, 0, 1, 0, 0, 0, 0);
      end = new Date(y, 11, 31, 23, 59, 59, 999);
    } else {
      throw new BadRequestException('Type de période invalide');
    }

    const getSumEpargne = async (
      opType: TypeOperationEpargne,
      devise: string,
    ) => {
      const res = await this.prisma.epargne.aggregate({
        where: {
          typeOperation: opType,
          devise: devise as Devise,
          dateOperation: { gte: start, lte: end },
        },
        _sum: { montant: true },
      });
      return res._sum.montant || 0;
    };

    const getSumCredit = async (devise: string) => {
      const res = await this.prisma.credit.aggregate({
        where: {
          devise: devise as Devise,
          dateDebut: { gte: start, lte: end },
        },
        _sum: { montant: true },
      });
      return res._sum.montant || 0;
    };

    const getSumRemboursement = async (devise: string) => {
      const res = await this.prisma.remboursement.aggregate({
        where: {
          devise: devise as Devise,
          dateRemboursement: { gte: start, lte: end },
        },
        _sum: { montant: true },
      });
      return res._sum.montant || 0;
    };

    const results = await Promise.all([
      getSumEpargne(TypeOperationEpargne.depot, 'FC'),
      getSumEpargne(TypeOperationEpargne.depot, 'USD'),
      getSumEpargne(TypeOperationEpargne.retrait, 'FC'),
      getSumEpargne(TypeOperationEpargne.retrait, 'USD'),
      getSumCredit('FC'),
      getSumCredit('USD'),
      getSumRemboursement('FC'),
      getSumRemboursement('USD'),
    ]);

    return {
      epargne: results[0],
      epargneUSD: results[1],
      retrait: results[2],
      retraitUSD: results[3],
      credit: results[4],
      creditUSD: results[5],
      remboursement: results[6],
      remboursementUSD: results[7],
    };
  }
}
