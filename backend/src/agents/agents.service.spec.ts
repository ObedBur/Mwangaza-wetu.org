import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../members/cloudinary.service';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { ComptabiliteService } from '../comptabilite/comptabilite.service';

describe('AgentsService', () => {
  let service: AgentsService;
  const findUnique = jest.fn();
  const tx = {
    agent: { create: jest.fn().mockResolvedValue({ id: 1 }) },
    caisseAgent: { create: jest.fn().mockResolvedValue({ id: 10 }) },
    mouvementCaisseAgent: { create: jest.fn() },
  };

  beforeEach(async () => {
    findUnique.mockReset();
    tx.agent.create.mockClear();
    tx.caisseAgent.create.mockClear();
    tx.mouvementCaisseAgent.create.mockClear();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentsService,
        {
          provide: PrismaService,
          useValue: {
            agent: { findUnique },
            $transaction: jest.fn((callback) => callback(tx)),
          },
        },
        { provide: CloudinaryService, useValue: {} },
        { provide: ComptabiliteService, useValue: { enregistrerOuvertureCaisse: jest.fn() } },
      ],
    }).compile();

    service = module.get<AgentsService>(AgentsService);
  });

  it('allows creating an agent without a fingerprint', async () => {
    const dto = {
      nom: 'Agent Terrain',
      email: 'agent@example.org',
      telephone: '+243000000000',
      guichetAssigne: 'Guichet 1',
    } as CreateAgentDto;

    findUnique.mockResolvedValue(null);

    const result = await service.create(dto);

    expect(result).toMatchObject({ id: 1 });
    expect(tx.agent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: null }),
    }));
    expect(findUnique).toHaveBeenCalledWith({ where: { email: dto.email } });
  });

  it('normalizes a whitespace-only fingerprint to null', async () => {
    findUnique.mockResolvedValue(null);
    const dto = {
        nom: 'Agent Terrain',
        email: 'agent@example.org',
        telephone: '+243000000000',
        guichetAssigne: 'Guichet 1',
        userId: '   ',
      };

    await service.create(dto);

    expect(tx.agent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: null }),
    }));
    expect(findUnique).toHaveBeenCalledTimes(1);
  });
});
