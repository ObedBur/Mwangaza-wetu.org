import { Test, TestingModule } from '@nestjs/testing';
import { AdminsService } from './admins.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AdminsService', () => {
  let service: AdminsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminsService, { provide: PrismaService, useValue: {} }],
    }).compile();

    service = module.get<AdminsService>(AdminsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
