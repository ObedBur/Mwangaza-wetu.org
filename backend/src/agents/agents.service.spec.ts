import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../members/cloudinary.service';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';

describe('AgentsService', () => {
  let service: AgentsService;
  const findUnique = jest.fn();

  beforeEach(async () => {
    findUnique.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentsService,
        {
          provide: PrismaService,
          useValue: { agent: { findUnique } },
        },
        { provide: CloudinaryService, useValue: {} },
      ],
    }).compile();

    service = module.get<AgentsService>(AgentsService);
  });

  it('rejects creating an agent without a fingerprint before checking the database', async () => {
    const dto = {
      nom: 'Agent Terrain',
      email: 'agent@example.org',
      telephone: '+243000000000',
      guichetAssigne: 'Guichet 1',
    } as CreateAgentDto;

    await expect(service.create(dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('rejects a whitespace-only fingerprint', async () => {
    await expect(
      service.create({
        nom: 'Agent Terrain',
        email: 'agent@example.org',
        telephone: '+243000000000',
        guichetAssigne: 'Guichet 1',
        userId: '   ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
