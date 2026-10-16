import { Test, TestingModule } from '@nestjs/testing';
import { RemboursementsService } from './remboursements.service';
import { PrismaService } from '../prisma/prisma.service';
import { BalancesService } from '../balances/balances.service';

describe('RemboursementsService', () => {
  let service: RemboursementsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemboursementsService,
        { provide: PrismaService, useValue: {} },
        { provide: BalancesService, useValue: {} },
      ],
    }).compile();

    service = module.get<RemboursementsService>(RemboursementsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
