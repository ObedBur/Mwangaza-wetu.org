import { BadRequestException } from '@nestjs/common';
import { NatureCompte, SensEcriture } from '@prisma/client';
import { ComptabiliteReportingService } from './comptabilite-reporting.service';

describe('ComptabiliteReportingService', () => {
  const prisma = {
    ecritureComptable: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    compte: { findMany: jest.fn() },
  };
  let service: ComptabiliteReportingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ComptabiliteReportingService(prisma as any);
  });

  it('uses UTC inclusive calendar dates and applies the section filter to the balance', async () => {
    prisma.ecritureComptable.groupBy.mockResolvedValue([]);
    prisma.compte.findMany.mockResolvedValue([]);

    await service.balance({ debut: '2026-03-01', fin: '2026-03-31', section: 'MW-BIA' });

    const where = prisma.ecritureComptable.groupBy.mock.calls[0][0].where;
    expect(where.operation.dateOperation).toEqual({
      gte: new Date('2026-03-01T00:00:00.000Z'),
      lt: new Date('2026-04-01T00:00:00.000Z'),
    });
    expect(where.operation.codeAnalytique).toEqual({ code: 'MW-BIA' });
  });

  it('rejects invalid dates before querying the database', async () => {
    await expect(service.balance({ debut: '2026-02-30', fin: '2026-03-01' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.ecritureComptable.groupBy).not.toHaveBeenCalled();
  });

  it('computes the income statement from account nature, not account number prefixes', async () => {
    const expense = {
      compteId: 1,
      devise: 'USD',
      montant: 80,
      sens: SensEcriture.DEBIT,
      compte: { numeroCompte: '6999', planCompte: { nature: NatureCompte.CHARGE, libelle: 'Frais' } },
      operation: { codeAnalytique: { code: 'MW-BIA' } },
    };
    const income = {
      compteId: 2,
      devise: 'USD',
      montant: 120,
      sens: SensEcriture.CREDIT,
      compte: { numeroCompte: '7099', planCompte: { nature: NatureCompte.PRODUIT, libelle: 'Commissions' } },
      operation: { codeAnalytique: { code: 'MW-BIA' } },
    };
    prisma.ecritureComptable.findMany.mockImplementation(({ where }: any) =>
      Promise.resolve(where.compte.planCompte.nature === NatureCompte.CHARGE ? [expense] : [income]),
    );

    const report = await service.compteResultat({ debut: '2026-01-01', fin: '2026-01-31', section: 'MW-BIA' });

    expect(prisma.ecritureComptable.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.ecritureComptable.findMany.mock.calls.map(([args]) => args.where.compte.planCompte.nature)).toEqual([
      NatureCompte.CHARGE,
      NatureCompte.PRODUIT,
    ]);
    expect(report.consolide.USD).toEqual({ produits: 120, charges: 80, resultat: 40 });
    expect(report.consolide.FC).toEqual({ produits: 0, charges: 0, resultat: 0 });
  });
});
