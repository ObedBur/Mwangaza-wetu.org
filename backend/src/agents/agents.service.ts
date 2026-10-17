import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { ChangeAgentPasswordDto } from './dto/change-agent-password.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { CloudinaryService } from '../members/cloudinary.service';

const AGENT_SELECT = {
  id: true,
  nom: true,
  email: true,
  telephone: true,
  guichetAssigne: true,
  soldeInitial: true,
  devise: true,
  actif: true,
  userId: true,
  dateNaissance: true,
  numeroCarteElecteur: true,
  imageCarteElecteur: true,
  createdAt: true,
} as const;

@Injectable()
export class AgentsService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  async create(dto: CreateAgentDto) {
    const emailExists = await this.prisma.agent.findUnique({
      where: { email: dto.email },
    });
    if (emailExists) {
      throw new BadRequestException('Un agent avec cet email existe déjà');
    }

    if (dto.userId) {
      const userIdTaken = await this.checkUserId(dto.userId);
      if (userIdTaken.exists) {
        throw new BadRequestException(
          `Cette empreinte est déjà enregistrée pour un autre ${userIdTaken.where || 'compte'}`,
        );
      }
    }

    if (dto.numeroCarteElecteur) {
      const cardExists = await this.prisma.agent.findUnique({
        where: { numeroCarteElecteur: dto.numeroCarteElecteur },
        select: { id: true },
      });
      if (cardExists) throw new BadRequestException('Ce numéro de carte d’électeur est déjà attribué à un agent.');
    }

    const cardImage = dto.imageCarteElecteur
      ? await this.cloudinary.uploadBase64Image(dto.imageCarteElecteur, 'mwangaza/agents/cartes-electeur')
      : null;
    if (dto.imageCarteElecteur && !cardImage) {
      throw new BadRequestException('L’image de la carte d’électeur doit être au format JPG, PNG ou WebP.');
    }

    const temporaryPassword = crypto.randomBytes(12).toString('base64url');
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    const deviseInitiale = dto.devise ?? 'USD';
    const soldeInitial = dto.soldeInitial ?? 0;
    const agent = await this.prisma.$transaction(async (tx) => {
      const created = await tx.agent.create({
        data: {
          nom: dto.nom,
          dateNaissance: dto.dateNaissance ? new Date(`${dto.dateNaissance}T00:00:00.000Z`) : null,
          numeroCarteElecteur: dto.numeroCarteElecteur?.trim() || null,
          imageCarteElecteur: cardImage?.url ?? null,
          imageCarteElecteurPublicId: cardImage?.publicId ?? null,
          email: dto.email,
          telephone: dto.telephone,
          guichetAssigne: dto.guichetAssigne,
          soldeInitial,
          devise: deviseInitiale,
          userId: dto.userId ?? null,
          motDePasse: hashedPassword,
        },
        select: AGENT_SELECT,
      });

      for (const devise of ['USD', 'FC'] as const) {
        const ouverture = devise === deviseInitiale ? soldeInitial : 0;
        const caisse = await tx.caisseAgent.create({
          data: { agentId: created.id, devise, solde: ouverture },
        });
        if (ouverture > 0) {
          await tx.mouvementCaisseAgent.create({
            data: {
              caisseId: caisse.id,
              type: 'OUVERTURE',
              devise,
              montant: ouverture,
              soldeAvant: 0,
              soldeApres: ouverture,
              motif: 'Fonds initiaux saisis à la création de l’agent',
            },
          });
        }
      }
      return created;
    });
    // Renvoyé uniquement sur la réponse de création protégée admin, jamais stocké en clair.
    return { ...agent, motDePasseTemporaire: temporaryPassword };
  }

  async findAll(page = 1, pageSize = 10, search?: string) {
    const where = search
      ? {
          OR: [
            { nom: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            {
              guichetAssigne: {
                contains: search,
                mode: 'insensitive' as const,
              },
            },
            { telephone: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [total, rows] = await Promise.all([
      this.prisma.agent.count({ where }),
      this.prisma.agent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: AGENT_SELECT,
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);
    return {
      data: rows,
      meta: {
        total,
        page,
        pageSize,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async findOne(id: number) {
    const agent = await this.prisma.agent.findUnique({
      where: { id },
      select: AGENT_SELECT,
    });
    if (!agent) throw new NotFoundException(`Agent #${id} non trouvé`);
    return agent;
  }

  async checkUserId(userId: string) {
    const [agent, member, delegate] = await Promise.all([
      this.prisma.agent.findFirst({ where: { userId }, select: { id: true } }),
      this.prisma.membre.findFirst({ where: { userId }, select: { id: true } }),
      this.prisma.delegue.findFirst({ where: { userId }, select: { id: true } }),
    ]);
    if (agent) return { exists: true, where: 'agent' };
    if (member) return { exists: true, where: 'membre' };
    if (delegate) return { exists: true, where: 'délégué' };
    return { exists: false, where: null };
  }

  async changeOwnPassword(agentId: number, dto: ChangeAgentPasswordDto) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent?.actif || !agent.motDePasse) {
      throw new NotFoundException('Compte agent non disponible');
    }
    const matches = await bcrypt.compare(dto.currentPassword, agent.motDePasse);
    if (!matches) throw new BadRequestException('Mot de passe actuel incorrect');
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Le nouveau mot de passe doit être différent');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.agent.update({
        where: { id: agentId },
        data: {
          motDePasse: await bcrypt.hash(dto.newPassword, 12),
          authVersion: { increment: 1 },
        },
      });
      await tx.adminLog.create({
        data: {
          action: 'AGENT_PASSWORD_CHANGED',
          details: `L’agent #${agentId} a modifié son mot de passe. Ses sessions existantes ont été révoquées.`,
          success: true,
          userId: agentId,
        },
      });
    });
    return { success: true, message: 'Mot de passe modifié; reconnectez-vous.' };
  }

  async update(id: number, dto: UpdateAgentDto) {
    const existing = await this.prisma.agent.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Agent #${id} non trouvé`);

    if (
      (dto.soldeInitial !== undefined &&
        Number(existing.soldeInitial) !== dto.soldeInitial) ||
      (dto.devise !== undefined && dto.devise !== existing.devise)
    ) {
      throw new BadRequestException(
        'Le solde initial ne peut pas être modifié après création. Utilisez l’approvisionnement tracé de la caisse.',
      );
    }

    if (dto.email && dto.email !== existing.email) {
      const emailTaken = await this.prisma.agent.findUnique({
        where: { email: dto.email },
      });
      if (emailTaken) {
        throw new BadRequestException('Un agent avec cet email existe déjà');
      }
    }

    if (dto.userId && dto.userId !== existing.userId) {
      const userIdTaken = await this.checkUserId(dto.userId);
      if (userIdTaken.exists) {
        throw new BadRequestException(
          `Cette empreinte est déjà enregistrée pour un autre ${userIdTaken.where || 'compte'}`,
        );
      }
    }

    const numeroCarteElecteur = dto.numeroCarteElecteur?.trim();
    if (numeroCarteElecteur && numeroCarteElecteur !== existing.numeroCarteElecteur) {
      const cardExists = await this.prisma.agent.findUnique({
        where: { numeroCarteElecteur },
        select: { id: true },
      });
      if (cardExists) throw new BadRequestException('Ce numéro de carte d’électeur est déjà attribué à un agent.');
    }

    const newCardImage = dto.imageCarteElecteur && dto.imageCarteElecteur.startsWith('data:image/')
      ? await this.cloudinary.uploadBase64Image(dto.imageCarteElecteur, 'mwangaza/agents/cartes-electeur')
      : null;
    if (dto.imageCarteElecteur?.startsWith('data:') && !newCardImage) {
      throw new BadRequestException('L’image de la carte d’électeur doit être au format JPG, PNG ou WebP.');
    }
    const clearCardImage = dto.imageCarteElecteur === '';

    const updated = await this.prisma.agent.update({
      where: { id },
      select: AGENT_SELECT,
      data: {
        ...(dto.nom !== undefined && { nom: dto.nom }),
        ...(dto.dateNaissance !== undefined && { dateNaissance: dto.dateNaissance ? new Date(`${dto.dateNaissance}T00:00:00.000Z`) : null }),
        ...(dto.numeroCarteElecteur !== undefined && { numeroCarteElecteur: numeroCarteElecteur || null }),
        ...(newCardImage && { imageCarteElecteur: newCardImage.url, imageCarteElecteurPublicId: newCardImage.publicId }),
        ...(clearCardImage && { imageCarteElecteur: null, imageCarteElecteurPublicId: null }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.telephone !== undefined && { telephone: dto.telephone }),
        ...(dto.guichetAssigne !== undefined && {
          guichetAssigne: dto.guichetAssigne,
        }),
        ...(dto.actif !== undefined && { actif: dto.actif }),
        ...(dto.userId !== undefined && { userId: dto.userId }),
        ...(dto.motDePasse !== undefined && {
          motDePasse: await bcrypt.hash(dto.motDePasse, 10),
          authVersion: { increment: 1 },
        }),
      },
    });
    if ((newCardImage || clearCardImage) && existing.imageCarteElecteurPublicId) {
      await this.cloudinary.deleteImage(existing.imageCarteElecteurPublicId);
    }
    return updated;
  }

  async remove(id: number) {
    const existing = await this.prisma.agent.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Agent #${id} non trouvé`);
    const cashMovements = await this.prisma.mouvementCaisseAgent.count({
      where: { caisse: { agentId: id } },
    });
    if (cashMovements > 0) {
      return this.prisma.agent.update({
        where: { id },
        data: { actif: false },
        select: AGENT_SELECT,
      });
    }
    await this.prisma.caisseAgent.deleteMany({ where: { agentId: id } });
    return this.prisma.agent.delete({ where: { id }, select: AGENT_SELECT });
  }
}
