import { Test, TestingModule } from '@nestjs/testing';
import { MembersService } from './members.service';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from './cloudinary.service';
import { MemberMailService } from './member-mail.service';
import { ComptabiliteService } from '../comptabilite/comptabilite.service';
import { CreateMemberDto, Sexe, StatutMembre } from './dto/create-member.dto';
import { BadRequestException } from '@nestjs/common';

describe('MembersService', () => {
  let service: MembersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembersService,
        { provide: PrismaService, useValue: {} },
        { provide: ComptabiliteService, useValue: { enregistrerAdhesion: jest.fn() } },
        { provide: CloudinaryService, useValue: {} },
        { provide: MemberMailService, useValue: { isConfigured: () => false } },
      ],
    }).compile();

    service = module.get<MembersService>(MembersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('allows creating a member without a fingerprint when the reader is unavailable', async () => {
    const member = {
      nomComplet: 'Membre Terrain',
      dateAdhesion: '2026-11-06',
      telephone: '+243000000000',
      email: 'terrain@example.org',
      sexe: Sexe.M,
      typeCompte: 'PRINCIPAL',
      statut: StatutMembre.ACTIF,
    } satisfies CreateMemberDto;

    await expect(service.create(member)).rejects.toThrow(
      "L'envoi d'e-mails n'est pas configuré",
    );
  });
});
