import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdminDto, ConfirmAdminDto } from './dto/create-admin.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Role, Prisma } from '@prisma/client';

@Injectable()
export class AdminsService {
  constructor(private prisma: PrismaService) {}

  async getLastAdminNumber() {
    const lastAdmin = await this.prisma.administrateur.findFirst({
      where: { numeroCompte: { startsWith: 'MW-A-' } },
      orderBy: { id: 'desc' },
    });
    const lastSuperAdmin = await this.prisma.administrateur.findFirst({
      where: { numeroCompte: { startsWith: 'MW-SA-' } },
      orderBy: { id: 'desc' },
    });

    return {
      lastAdmin: lastAdmin ? lastAdmin.numeroCompte : null,
      lastSuperAdmin: lastSuperAdmin ? lastSuperAdmin.numeroCompte : null,
    };
  }

  async findAll() {
    return this.prisma.administrateur.findMany({
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        telephone: true,
        role: true,
        actif: true,
        dateCreation: true,
      },
      orderBy: { dateCreation: 'desc' },
    });
  }

  async findOne(id: number) {
    const admin = await this.prisma.administrateur.findUnique({
      where: { id },
    });
    if (!admin) throw new NotFoundException('Administrateur non trouvé');

    return {
      success: true,
      data: {
        ...admin,
        date_creation: admin.dateCreation.toISOString(),
      },
    };
  }

  async create(dto: CreateAdminDto) {
    const {
      nom,
      prenom,
      email,
      telephone,
      motDePasse,
      role,
      numeroCompte,
      userId,
      actif,
    } = dto;

    // Check uniqueness
    const emailExists = await this.prisma.administrateur.findUnique({
      where: { email },
    });
    if (emailExists)
      throw new BadRequestException(
        'Un administrateur avec cet email existe déjà',
      );

    const numeroExists = await this.prisma.administrateur.findUnique({
      where: { numeroCompte },
    });
    if (numeroExists)
      throw new BadRequestException('Ce numéro de compte est déjà utilisé');

    const confirmationCode = crypto
      .randomBytes(3)
      .toString('hex')
      .toUpperCase();
    const hashedPassword = await bcrypt.hash(motDePasse, 10);

    return this.prisma.$transaction(async (tx) => {
      const admin = await tx.administrateur.create({
        data: {
          nom,
          prenom,
          email,
          telephone,
          motDePasse: hashedPassword,
          role: role,
          actif: actif ?? true,
          numeroCompte,
          userId,
        },
      });

      await tx.adminConfirmation.create({
        data: {
          adminId: admin.id,
          confirmationCode,
        },
      });

      return {
        success: true,
        message: 'Administrateur ajouté avec succès',
        adminId: admin.id,
        confirmationCode,
      };
    });
  }

  async confirm(dto: ConfirmAdminDto) {
    const { adminId, confirmationCode } = dto;

    const confirmation = await this.prisma.adminConfirmation.findFirst({
      where: {
        adminId,
        confirmationCode,
        confirmedAt: null,
      },
    });

    if (!confirmation)
      throw new BadRequestException('Code de confirmation invalide');

    await this.prisma.$transaction([
      this.prisma.administrateur.update({
        where: { id: adminId },
        data: { actif: true },
      }),
      this.prisma.adminConfirmation.update({
        where: { id: confirmation.id },
        data: { confirmedAt: new Date() },
      }),
    ]);

    return {
      success: true,
      message: 'Compte administrateur activé avec succès',
    };
  }

  async update(id: number, dto: Partial<CreateAdminDto>) {
    const exists = await this.prisma.administrateur.findUnique({
      where: { id },
    });
    if (!exists) throw new NotFoundException('Administrateur non trouvé');

    if (dto.email && dto.email !== exists.email) {
      const emailExists = await this.prisma.administrateur.findUnique({
        where: { email: dto.email },
      });
      if (emailExists)
        throw new BadRequestException(
          'Un autre administrateur utilise déjà cet email',
        );
    }

    const data: Prisma.AdministrateurUpdateInput = { ...dto };
    if (dto.motDePasse) {
      if (dto.motDePasse.length < 6) {
        throw new BadRequestException(
          'Le mot de passe doit contenir au moins 6 caractères',
        );
      }
      data.motDePasse = await bcrypt.hash(dto.motDePasse, 10);
    } else {
      delete data.motDePasse;
    }

    await this.prisma.administrateur.update({
      where: { id },
      data,
    });

    return { success: true, message: 'Administrateur mis à jour avec succès' };
  }

  async remove(id: number) {
    const admin = await this.prisma.administrateur.findUnique({
      where: { id },
    });
    if (!admin) throw new NotFoundException('Administrateur non trouvé');

    if (admin.role === Role.superadmin) {
      const countSA = await this.prisma.administrateur.count({
        where: { role: Role.superadmin },
      });
      if (countSA <= 1)
        throw new BadRequestException(
          'Impossible de supprimer le dernier super administrateur',
        );
    }

    await this.prisma.administrateur.delete({ where: { id } });
    return { success: true, message: 'Administrateur supprimé avec succès' };
  }
}
