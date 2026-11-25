import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: {} }],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('compares the selected period with the immediately preceding period of equal length', async () => {
    const current = {
      totaux: {
        depots: { FC: 500, USD: 10 },
        creditsDecaisses: { FC: 0, USD: 20 },
        remboursements: { FC: 100, USD: 5 },
        adhesions: 2,
      },
    };
    const previous = {
      totaux: {
        depots: { FC: 250, USD: 0 },
        creditsDecaisses: { FC: 0, USD: 10 },
        remboursements: { FC: 100, USD: 0 },
        adhesions: 1,
      },
    };
    const synthese = jest.spyOn(service, 'getSynthese')
      .mockResolvedValueOnce(current as any)
      .mockResolvedValueOnce(previous as any);

    const evaluation = await service.getEvaluation({ debut: '2026-01-01', fin: '2026-01-31' });

    expect(evaluation.comparaison).toEqual({ debut: '2025-12-01', fin: '2025-12-31', dureeJours: 31 });
    expect(synthese).toHaveBeenNthCalledWith(1, { debut: '2026-01-01', fin: '2026-01-31' });
    expect(synthese).toHaveBeenNthCalledWith(2, { debut: '2025-12-01', fin: '2025-12-31' });
    expect(evaluation.indicateurs.find((item) => item.label === 'Dépôts reçus' && item.devise === 'FC')).toMatchObject({
      valeur: 500, valeurPrecedente: 250, variation: 250, variationPourcent: 100,
    });
    expect(evaluation.indicateurs.find((item) => item.label === 'Dépôts reçus' && item.devise === 'USD')?.variationPourcent).toBeNull();
    expect(evaluation.indicateurs.find((item) => item.label === 'Nouvelles adhésions')).toMatchObject({
      valeur: 2, valeurPrecedente: 1, variation: 1, variationPourcent: 100, devise: '—',
    });
  });

  it('rejects an inverted evaluation period', async () => {
    await expect(service.getEvaluation({ debut: '2026-02-01', fin: '2026-01-31' })).rejects.toThrow(
      'La date de fin doit être égale ou postérieure à la date de début.',
    );
  });
});
