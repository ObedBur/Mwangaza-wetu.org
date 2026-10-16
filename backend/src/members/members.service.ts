import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MemberMailService } from './member-mail.service';
import { CloudinaryService } from './cloudinary.service';
import { CreateMemberDto, Sexe } from './dto/create-member.dto';
import {
  normalizeSectionName,
  getSectionTrigram,
} from '../common/constants/sections';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  Prisma,
  StatutMembre as PrismaStatutMembre,
  Devise,
} from '@prisma/client';

type CloudinaryPhoto = { url: string; publicId: string };

@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);
  constructor(
    private prisma: PrismaService,
    private memberMail: MemberMailService,
    private cloudinary: CloudinaryService,
  ) {}

  private readonly uploadsDir = path.join(process.cwd(), 'uploads');

  private async deletePhotoAssets(
    photos: Array<{
      url: string | null | undefined;
      publicId: string | null | undefined;
    }>,
  ) {
    await Promise.all(
      photos.map(async ({ url, publicId }) => {
        try {
          if (publicId) {
            await this.cloudinary.deleteImage(publicId);
          } else if (
            url &&
            !/^https?:\/\//i.test(url) &&
            path.basename(url) === url
          ) {
            const legacyPath = path.join(this.uploadsDir, url);
            if (fs.existsSync(legacyPath)) fs.unlinkSync(legacyPath);
          }
        } catch (error) {
          this.logger.warn(
            `Unable to delete photo asset: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }),
    );
  }

  async findAll(
    params: { page?: number; pageSize?: number; userId?: string } = {},
  ) {
    const { page = 1, pageSize = 10, userId } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.MembreWhereInput = {
      NOT: [
        { numeroCompte: { contains: 'SECTION-0000' } },
        { numeroCompte: { contains: 'REVENUS' } },
        { numeroCompte: { contains: 'CREDITS' } },
        { numeroCompte: { contains: 'TRESORERIE' } },
      ],
    };

    if (userId) {
      where.userId = userId;
    }

    const [total, data] = await Promise.all([
      this.prisma.membre.count({ where }),
      this.prisma.membre.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { dateAdhesion: 'desc' },
        include: { delegues: true, comptesEpargne: true },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        hasNextPage: page * pageSize < total,
        hasPrevPage: page > 1,
      },
    };
  }

  async findOne(id: number) {
    const membre = await this.prisma.membre.findUnique({
      where: { id },
      include: { delegues: true },
    });
    if (!membre) throw new NotFoundException('Membre non trouvé');
    return membre;
  }

  async search(term: string, limit = 20) {
    const trimmed = term.trim();
    if (!trimmed) return { data: [], meta: { total: 0 } };

    const where = {
      AND: [
        {
          NOT: [
            { numeroCompte: { contains: 'SECTION-0000' } },
            { numeroCompte: { contains: 'REVENUS' } },
            { numeroCompte: { contains: 'CREDITS' } },
            { numeroCompte: { contains: 'TRESORERIE' } },
          ],
        },
        {
          OR: [
            { nomComplet: { contains: trimmed, mode: 'insensitive' as const } },
            {
              numeroCompte: { contains: trimmed, mode: 'insensitive' as const },
            },
            { telephone: { contains: trimmed, mode: 'insensitive' as const } },
            { email: { contains: trimmed, mode: 'insensitive' as const } },
          ],
        },
      ],
    };

    const [total, data] = await Promise.all([
      this.prisma.membre.count({ where }),
      this.prisma.membre.findMany({
        where,
        take: limit,
        orderBy: { dateAdhesion: 'desc' },
        include: { delegues: true },
      }),
    ]);

    return { data, meta: { total } };
  }

  async findByNumero(numeroCompte: string) {
    const membre = await this.prisma.membre.findUnique({
      where: { numeroCompte },
      include: { delegues: true },
    });
    return membre
      ? { exists: true, membre }
      : { exists: false, message: 'Aucun membre trouvé' };
  }

  /**
   * Trouve un membre à partir d'un ID ZKTeco.
   * On cherche d'abord si l'ID appartient au membre lui-même,
   * sinon on cherche si l'ID appartient à l'un de ses délégués.
   */
  async findByZkId(zkId: string) {
    // 1. Chercher si c'est un membre directement
    const membre = await this.prisma.membre.findFirst({
      where: { userId: zkId },
      include: { delegues: true },
    });

    if (membre) return membre;

    // 2. Sinon, chercher si c'est un délégué
    const delegue = await this.prisma.delegue.findFirst({
      where: { userId: zkId },
      include: {
        membre: {
          include: { delegues: true },
        },
      },
    });

    if (delegue?.membre) {
      return delegue.membre;
    }

    throw new NotFoundException(
      `Aucun membre ou délégué trouvé avec l'identifiant biométrique ${zkId}`,
    );
  }

  async create(createMemberDto: CreateMemberDto) {
    const { numeroCompte, typeCompte, dateAdhesion, delegue } =
      createMemberDto;

    const email = createMemberDto.email?.trim().toLowerCase();
    if (!email) throw new BadRequestException("L'adresse e-mail est requise");
    if (!this.memberMail.isConfigured()) {
      throw new BadRequestException(
        "L'envoi d'e-mails n'est pas configuré. Configurez le serveur SMTP avant de créer un membre.",
      );
    }

    // Sexe obligatoire à la création (optionnel dans le DTO pour les updates partielles)
    if (!createMemberDto.sexe) {
      throw new BadRequestException('Le sexe est requis');
    }

    // Unicité téléphone/email (contraintes @unique en base → vérifier proprement, sinon crash Prisma P2002)
    const existingPhone = await this.prisma.membre.findUnique({
      where: { telephone: createMemberDto.telephone },
      select: { numeroCompte: true },
    });
    if (existingPhone) {
      throw new BadRequestException('Ce numéro de téléphone est déjà utilisé');
    }

    if (email) {
      const existingEmail = await this.prisma.membre.findUnique({
        where: { email },
        select: { numeroCompte: true },
      });
      if (existingEmail) {
        throw new BadRequestException('Cet email est déjà utilisé');
      }
    }

    // Normaliser le type de compte pour la cohérence des stats
    const typeNormalise = normalizeSectionName(typeCompte);
    const dateAdh = new Date(dateAdhesion);
    const yearAdh = isNaN(dateAdh.getTime())
      ? new Date().getFullYear()
      : dateAdh.getFullYear();

    // Générer le numéro de compte s'il n'est pas fourni
    let finalNumeroCompte = numeroCompte;
    if (!finalNumeroCompte) {
      const sectionTrigram = getSectionTrigram(typeNormalise);
      finalNumeroCompte = await this.generateNumero(yearAdh, sectionTrigram);
    } else {
      // Vérifier l'unicité seulement s'il est fourni
      const existingNum = await this.prisma.membre.findUnique({
        where: { numeroCompte: finalNumeroCompte },
      });
      if (existingNum)
        throw new BadRequestException('Ce numéro de compte existe déjà');
    }

    // Vérifier l'unicité du userId (empreinte) pour le membre
    if (createMemberDto.userId) {
      const check = await this.checkUserId(createMemberDto.userId);
      if (check.exists) {
        throw new BadRequestException(
          `Cette empreinte est déjà enregistrée pour un autre ${check.where}`,
        );
      }
    }

    // Vérifier l'unicité du userId (empreinte) pour le délégué
    if (delegue?.userId) {
      const checkDelegue = await this.checkUserId(delegue.userId);
      if (checkDelegue.exists) {
        throw new BadRequestException(
          `L'empreinte du délégué est déjà enregistrée pour un autre ${checkDelegue.where}`,
        );
      }
    }

    const temporaryPassword = crypto.randomBytes(12).toString('base64url');
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    const activationToken = crypto.randomBytes(32).toString('hex');
    const activationExpires = new Date();
    activationExpires.setHours(activationExpires.getHours() + 24);

    let memberPhoto: CloudinaryPhoto | null = null;
    let delegatePhoto: CloudinaryPhoto | null = null;

    try {
      memberPhoto = await this.cloudinary.uploadBase64Image(
        createMemberDto.photoProfil || '',
        'mwangaza/membres',
      );
      if (delegue) {
        delegatePhoto = await this.cloudinary.uploadBase64Image(
          delegue.photoProfil || '',
          'mwangaza/delegues',
        );
      }

      return await this.prisma.$transaction(async (tx) => {
      const membre = await tx.membre.create({
        data: {
          numeroCompte: finalNumeroCompte,
          nomComplet: createMemberDto.nomComplet,
          telephone: createMemberDto.telephone,
          email,
          adresse: createMemberDto.adresse,
          sexe: createMemberDto.sexe as Sexe,
          typeCompte: typeNormalise, // Utiliser la valeur normalisée
          activite: createMemberDto.activite?.trim() || null,
          statut: createMemberDto.statut,
          photoProfil: memberPhoto?.url ?? null,
          photoProfilPublicId: memberPhoto?.publicId ?? null,
          userId: createMemberDto.userId || null,
          dateAdhesion: new Date(dateAdhesion),
          motDePasse: hashedPassword,
          dateNaissance: createMemberDto.dateNaissance
            ? new Date(createMemberDto.dateNaissance)
            : null,
          idNationale: createMemberDto.idNationale,
          activationToken,
          activationExpires,
          isActivated: true,
        },
      });

      // Enregistrer le revenu d'Adhésion (2000 FC) dans la table Revenu
      const revType = await tx.revenuType.findFirst({
        where: { nom: 'Système Membre' },
      });

      if (revType) {
        // 1. Enregistrement dans la table Revenu (Nouvelle architecture)
        await tx.revenu.create({
          data: {
            typeCompte: typeNormalise,
            typeRevenuId: revType.id,
            montant: 2000,
            devise: Devise.FC,
            dateOperation: new Date(dateAdhesion),
            sourceCompte: finalNumeroCompte,
          },
        });

        // 2. Enregistrement sur le compte de REVENUS de la section
        const sectionTrigram = getSectionTrigram(typeNormalise);
        const revenueAccount = `MW-${sectionTrigram}-REVENUS`;

        await tx.epargne.create({
          data: {
            compte: revenueAccount,
            typeOperation: 'depot',
            devise: Devise.FC,
            montant: 2000,
            dateOperation: new Date(dateAdhesion),
            description: `Frais d'adhésion membre ${finalNumeroCompte}`,
          },
        });

        // 3. Enregistrement sur le compte REVENUS GLOBAL
        await tx.epargne.create({
          data: {
            compte: 'MW-REVENUS-GLOBAL',
            typeOperation: 'depot',
            devise: Devise.FC,
            montant: 2000,
            dateOperation: new Date(dateAdhesion),
            description: `Frais d'adhésion membre ${finalNumeroCompte} (via ${typeNormalise})`,
          },
        });
      }

      // 2. Gérer le délégué
      if (delegue) {
        await tx.delegue.create({
          data: {
            membreId: membre.id,
            nom: delegue.nom,
            telephone: delegue.telephone,
            relation: delegue.relation,
            pieceIdentite: delegue.pieceIdentite,
            userId: delegue.userId,
            photoProfil: delegatePhoto?.url ?? null,
            photoProfilPublicId: delegatePhoto?.publicId ?? null,
          },
        });
      }

      await this.memberMail.sendTemporaryPassword({
        email,
        fullName: membre.nomComplet,
        accountNumber: membre.numeroCompte,
        password: temporaryPassword,
      });

      this.logger.log(
        `✅ Membre créé avec succès : ${membre.numeroCompte} - ${membre.nomComplet}`,
      );
      const { motDePasse: _passwordHash, activationToken: _token, ...safeMembre } = membre;
      return { ...safeMembre, credentialsSent: true };
      });
    } catch (error) {
      await this.deletePhotoAssets([
        { url: memberPhoto?.url, publicId: memberPhoto?.publicId },
        { url: delegatePhoto?.url, publicId: delegatePhoto?.publicId },
      ]);
      throw error;
    }
  }

  async generateNumero(year: number, section?: string) {
    const sectionTrigram = section || 'PRI';

    // Format final sans année avec 6 caractères aléatoires : MW-TRI-RANDOM6
    let finalNumero: string;
    let isUnique = false;

    while (!isUnique) {
      // Générer 6 caractères alphanumériques aléatoires
      const randomPart = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()
        .padEnd(6, '0');

      finalNumero = `MW-${sectionTrigram}-${randomPart}`;

      // Vérifier l'unicité
      const existing = await this.prisma.membre.findUnique({
        where: { numeroCompte: finalNumero },
      });

      if (!existing) {
        isUnique = true;
      }
    }

    return finalNumero!;
  }

  /** Dernier numéro attribué pour une section (+ compteur informatif). */
  async getLastNumero(sectionTrigram?: string, year?: number) {
    const trigram = sectionTrigram || 'PRI';
    const yearClause: Prisma.MembreWhereInput = year
      ? {
          dateAdhesion: {
            gte: new Date(Date.UTC(year, 0, 1)),
            lt: new Date(Date.UTC(year + 1, 0, 1)),
          },
        }
      : {};

    const where: Prisma.MembreWhereInput = {
      AND: [
        { numeroCompte: { startsWith: `MW-${trigram}-` } },
        {
          NOT: [
            { numeroCompte: { contains: 'SECTION-0000' } },
            { numeroCompte: { contains: 'REVENUS' } },
            { numeroCompte: { contains: 'CREDITS' } },
            { numeroCompte: { contains: 'TRESORERIE' } },
          ],
        },
        yearClause,
      ],
    };

    const [latest, count] = await Promise.all([
      this.prisma.membre.findFirst({
        where,
        orderBy: { dateAdhesion: 'desc' },
        select: { numeroCompte: true },
      }),
      this.prisma.membre.count({ where }),
    ]);

    return { lastNumero: latest?.numeroCompte ?? null, nextNumber: count + 1 };
  }

  async findDelegueByUserId(userId: string) {
    const delegue = await this.prisma.delegue.findFirst({
      where: { userId },
      include: { membre: true },
    });

    if (!delegue) {
      return { success: false, message: 'Délégué non trouvé' };
    }

    return {
      success: true,
      delegue: {
        id: delegue.id,
        nom: delegue.nom,
        telephone: delegue.telephone,
        relation: delegue.relation,
        userId: delegue.userId,
      },
      membre: {
        numero_compte: delegue.membre.numeroCompte,
        nom_complet: delegue.membre.nomComplet,
        type_compte: delegue.membre.typeCompte,
        statut: delegue.membre.statut,
      },
    };
  }

  async update(id: number, updateDto: Partial<CreateMemberDto>) {
    const membre = await this.prisma.membre.findUnique({
      where: { id },
      include: { delegues: true },
    });
    if (!membre) throw new NotFoundException('Membre non trouvé');

    // Unicité téléphone/email si modifiés (contraintes @unique en base)
    if (updateDto.telephone && updateDto.telephone !== membre.telephone) {
      const existingPhone = await this.prisma.membre.findUnique({
        where: { telephone: updateDto.telephone },
        select: { numeroCompte: true },
      });
      if (existingPhone) {
        throw new BadRequestException(
          'Ce numéro de téléphone est déjà utilisé',
        );
      }
    }

    if (updateDto.email && updateDto.email !== membre.email) {
      const existingEmail = await this.prisma.membre.findUnique({
        where: { email: updateDto.email },
        select: { numeroCompte: true },
      });
      if (existingEmail) {
        throw new BadRequestException('Cet email est déjà utilisé');
      }
    }

    // Vérifier l'unicité du userId pour le membre si modifié
    if (updateDto.userId && updateDto.userId !== membre.userId) {
      const check = await this.checkUserId(updateDto.userId, id);
      if (check.exists) {
        throw new BadRequestException(
          `Cette empreinte est déjà enregistrée pour un autre ${check.where}`,
        );
      }
    }

    // Vérifier l'unicité du userId pour le délégué si fourni
    if (updateDto.delegue?.userId) {
      const currentDelegueId = membre.delegues[0]?.userId;
      if (updateDto.delegue.userId !== currentDelegueId) {
        const check = await this.checkUserId(updateDto.delegue.userId, id);
        if (check.exists) {
          throw new BadRequestException(
            `L'empreinte du délégué est déjà enregistrée pour un autre ${check.where}`,
          );
        }
      }
    }

    const data: Prisma.MembreUpdateInput = {};

    if (updateDto.motDePasse) {
      if (!updateDto.motDePasse.startsWith('$2')) {
        data.motDePasse = await bcrypt.hash(updateDto.motDePasse, 10);
      } else {
        data.motDePasse = updateDto.motDePasse;
      }
    }

    if (updateDto.nomComplet) data.nomComplet = updateDto.nomComplet;
    if (updateDto.telephone) data.telephone = updateDto.telephone;
    if (updateDto.email !== undefined) data.email = updateDto.email;
    if (updateDto.adresse !== undefined) data.adresse = updateDto.adresse;
    if (updateDto.sexe) data.sexe = updateDto.sexe;
    if (updateDto.statut) data.statut = updateDto.statut;
    if (updateDto.typeCompte) data.typeCompte = updateDto.typeCompte;
    if (updateDto.activite !== undefined)
      data.activite = updateDto.activite.trim() || null;
    if (updateDto.dateAdhesion)
      data.dateAdhesion = new Date(updateDto.dateAdhesion);
    if (updateDto.dateNaissance !== undefined)
      data.dateNaissance = updateDto.dateNaissance
        ? new Date(updateDto.dateNaissance)
        : null;
    if (updateDto.idNationale !== undefined)
      data.idNationale = updateDto.idNationale;

    let memberPhoto: CloudinaryPhoto | null = null;
    let delegatePhoto: CloudinaryPhoto | null = null;

    // Gérer la photo du membre si fournie en base64
    if (
      updateDto.photoProfil &&
      updateDto.photoProfil.startsWith('data:image')
    ) {
      memberPhoto = await this.cloudinary.uploadBase64Image(
        updateDto.photoProfil,
        'mwangaza/membres',
      );
      if (memberPhoto) {
        data.photoProfil = memberPhoto.url;
        data.photoProfilPublicId = memberPhoto.publicId;
      }
    } else if (updateDto.photoProfil === null || updateDto.photoProfil === '') {
      data.photoProfil = null;
      data.photoProfilPublicId = null;
    }

    if (updateDto.delegue) {
      try {
        delegatePhoto = await this.cloudinary.uploadBase64Image(
          updateDto.delegue.photoProfil || '',
          'mwangaza/delegues',
        );
      } catch (error) {
        await this.deletePhotoAssets([
          { url: memberPhoto?.url, publicId: memberPhoto?.publicId },
        ]);
        throw error;
      }
    }

    let updatedMembre;
    try {
      updatedMembre = await this.prisma.$transaction(async (tx) => {
      const updatedMembre = await tx.membre.update({
        where: { id },
        data,
      });

      // Gérer le délégué
      if (updateDto.delegue) {
        const existingDelegue = membre.delegues[0];
        if (existingDelegue) {
          await tx.delegue.update({
            where: { id: existingDelegue.id },
            data: {
              nom: updateDto.delegue.nom,
              telephone: updateDto.delegue.telephone,
              relation: updateDto.delegue.relation,
              pieceIdentite: updateDto.delegue.pieceIdentite,
              userId: updateDto.delegue.userId,
              photoProfil: delegatePhoto?.url || existingDelegue.photoProfil,
              photoProfilPublicId:
                delegatePhoto?.publicId || existingDelegue.photoProfilPublicId,
            },
          });
        } else {
          await tx.delegue.create({
            data: {
              membreId: updatedMembre.id,
              nom: updateDto.delegue.nom,
              telephone: updateDto.delegue.telephone,
              relation: updateDto.delegue.relation,
              pieceIdentite: updateDto.delegue.pieceIdentite,
              userId: updateDto.delegue.userId,
              photoProfil: delegatePhoto?.url ?? null,
              photoProfilPublicId: delegatePhoto?.publicId ?? null,
            },
          });
        }
      }

      return updatedMembre;
      });
    } catch (error) {
      await this.deletePhotoAssets([
        { url: memberPhoto?.url, publicId: memberPhoto?.publicId },
        { url: delegatePhoto?.url, publicId: delegatePhoto?.publicId },
      ]);
      throw error;
    }

    const existingDelegue = membre.delegues[0];
    await this.deletePhotoAssets([
      ...(memberPhoto || updateDto.photoProfil === null || updateDto.photoProfil === ''
        ? [
            {
              url: membre.photoProfil,
              publicId: membre.photoProfilPublicId,
            },
          ]
        : []),
      ...(delegatePhoto && existingDelegue
        ? [
            {
              url: existingDelegue.photoProfil,
              publicId: existingDelegue.photoProfilPublicId,
            },
          ]
        : []),
    ]);
    return updatedMembre;
  }

  async remove(id: number) {
    const membre = await this.prisma.membre.findUnique({
      where: { id },
      include: {
        epargnes: { take: 1 },
        retraits: { take: 1 },
        credits: { take: 1 },
        delegues: true,
      },
    });

    if (!membre) throw new NotFoundException('Membre non trouvé');

    // Empêcher la suppression des comptes système
    if (
      membre.numeroCompte === 'MW-REVENUS-GLOBAL' ||
      membre.numeroCompte.includes('SECTION-0000') ||
      membre.numeroCompte.includes('-REVENUS') ||
      membre.typeCompte === 'SYSTEME'
    ) {
      throw new BadRequestException(
        'Impossible de supprimer un compte système.',
      );
    }

    // Empêcher la suppression si le membre a des transactions
    if (
      membre.epargnes.length > 0 ||
      membre.retraits.length > 0 ||
      membre.credits.length > 0
    ) {
      throw new BadRequestException(
        'Ce membre a des transactions enregistrées. Veuillez le désactiver plutôt que de le supprimer.',
      );
    }

    // Supprimer les délégués associés (pris en charge par cascade si configuré, mais on le fait pour être sûr)
    await this.prisma.delegue.deleteMany({ where: { membreId: id } });

    const deletedMembre = await this.prisma.membre.delete({ where: { id } });
    await this.deletePhotoAssets([
      {
        url: membre.photoProfil,
        publicId: membre.photoProfilPublicId,
      },
      ...membre.delegues.map((delegue) => ({
        url: delegue.photoProfil,
        publicId: delegue.photoProfilPublicId,
      })),
    ]);
    return deletedMembre;
  }

  async getStats() {
    const filter = {
      NOT: [
        { numeroCompte: { contains: 'SECTION-0000' } },
        { numeroCompte: { contains: 'REVENUS' } },
        { numeroCompte: { contains: 'CREDITS' } },
        { numeroCompte: { contains: 'TRESORERIE' } },
      ],
    };

    const total = await this.prisma.membre.count({ where: filter });
    const actifs = await this.prisma.membre.count({
      where: { ...filter, statut: PrismaStatutMembre.actif },
    });
    const inactifs = total - actifs;
    const hommes = await this.prisma.membre.count({
      where: { ...filter, sexe: 'M' },
    });
    const femmes = await this.prisma.membre.count({
      where: { ...filter, sexe: 'F' },
    });

    const typeComptes = await this.prisma.membre.groupBy({
      by: ['typeCompte'],
      where: filter,
      _count: { _all: true },
    });

    const activites = await this.prisma.membre.groupBy({
      by: ['activite'],
      where: filter,
      _count: { _all: true },
    });

    return { total, actifs, inactifs, hommes, femmes, typeComptes, activites };
  }

  async checkUserId(userId: string, excludeId?: number) {
    const membre = await this.prisma.membre.findFirst({
      where: {
        userId,
        id: excludeId ? { not: excludeId } : undefined,
      },
    });
    if (membre) return { exists: true, where: 'membre' };

    const delegue = await this.prisma.delegue.findFirst({
      where: {
        userId,
        membreId: excludeId ? { not: excludeId } : undefined,
      },
    });
    if (delegue) return { exists: true, where: 'délégué' };

    return { exists: false, where: null };
  }

  async getMemberDashboard(identifier: string) {
    // Identifier can be an ID (number) or Account Number (string)
    const isId = !isNaN(Number(identifier));

    const whereClause = isId
      ? { id: Number(identifier) }
      : { numeroCompte: identifier };

    const membre = await this.prisma.membre.findUnique({
      where: whereClause,
      include: {
        delegues: true,
        epargnes: {
          orderBy: { dateOperation: 'desc' },
        },
        retraits: {
          orderBy: { dateOperation: 'desc' },
        },
        credits: {
          include: {
            remboursements: {
              orderBy: { dateRemboursement: 'desc' },
            },
          },
          orderBy: { dateDebut: 'desc' },
        },
      },
    });

    if (!membre) throw new NotFoundException('Membre non trouvé');

    // Mettre à plat et trier les transactions récentes interactives
    const allTransactions = [
      ...membre.epargnes.map((e) => ({
        type: 'depot',
        devise: e.devise,
        montant: Number(e.montant),
        date: e.dateOperation,
        description: e.description,
      })),
      ...membre.retraits.map((r) => ({
        type: 'retrait',
        devise: r.devise,
        montant: Number(r.montant),
        date: r.dateOperation,
        description: r.description,
      })),
      ...membre.credits.flatMap((c) =>
        c.remboursements.map((r) => ({
          type: 'remboursement',
          devise: r.devise,
          montant: Number(r.montant),
          date: r.dateRemboursement,
          description: r.description,
        })),
      ),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Calculs de l'épargne (dépôts - retraits)
    const epargneUSD =
      membre.epargnes
        .filter((e) => e.devise === Devise.USD)
        .reduce((sum, e) => sum + Number(e.montant), 0) -
      membre.retraits
        .filter((r) => r.devise === Devise.USD)
        .reduce((sum, r) => sum + Number(r.montant), 0);

    const epargneFC =
      membre.epargnes
        .filter((e) => e.devise === Devise.FC)
        .reduce((sum, e) => sum + Number(e.montant), 0) -
      membre.retraits
        .filter((r) => r.devise === Devise.FC)
        .reduce((sum, r) => sum + Number(r.montant), 0);

    // Filter active credits
    const activeCredits = membre.credits.filter(
      (c) => c.statut === PrismaStatutMembre.actif || c.statut === 'en_retard',
    );

    const unpaidCreditsUSD = activeCredits
      .filter((c) => c.devise === Devise.USD)
      .reduce(
        (sum, c) =>
          sum +
          (Number(c.montant) * (1 + Number(c.tauxInteret) / 100) -
            Number(c.montantRembourse)),
        0,
      );

    const unpaidCreditsFC = activeCredits
      .filter((c) => c.devise === Devise.FC)
      .reduce(
        (sum, c) =>
          sum +
          (Number(c.montant) * (1 + Number(c.tauxInteret) / 100) -
            Number(c.montantRembourse)),
        0,
      );

    // Format Credits Details for the UI
    const creditsDetails = activeCredits.map((c) => {
      const montantTotal =
        Number(c.montant) * (1 + Number(c.tauxInteret) / 100);
      const rembourse = Number(c.montantRembourse);
      return {
        id: c.id,
        montantInitial: Number(c.montant),
        montantTotal: montantTotal,
        montantRembourse: rembourse,
        restant: Math.max(0, montantTotal - rembourse),
        tauxInteret: Number(c.tauxInteret),
        devise: c.devise,
        dateDebut: c.dateDebut,
        statut: c.statut,
        progression: montantTotal > 0 ? (rembourse / montantTotal) * 100 : 0,
      };
    });

    return {
      profile: {
        id: membre.id,
        numeroCompte: membre.numeroCompte,
        nomComplet: membre.nomComplet,
        typeCompte: membre.typeCompte,
        statut: membre.statut,
        dateAdhesion: membre.dateAdhesion,
        photoProfil: membre.photoProfil,
      },
      balances: {
        savings: {
          USD: epargneUSD,
          FC: epargneFC,
        },
        activeCredits: {
          USD: unpaidCreditsUSD,
          FC: unpaidCreditsFC,
        },
      },
      activeCreditsDetails: creditsDetails,
      recentTransactions: allTransactions.slice(0, 15), // Only last 15 for dashboard performance
    };
  }

  async activate(token: string, password: string) {
    const membre = await this.prisma.membre.findFirst({
      where: {
        activationToken: token,
        activationExpires: { gt: new Date() },
      },
    });

    if (!membre) {
      throw new BadRequestException("Lien d'activation invalide ou expiré");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    return this.prisma.membre.update({
      where: { id: membre.id },
      data: {
        motDePasse: hashedPassword,
        isActivated: true,
        activationToken: null,
        activationExpires: null,
      },
    });
  }
}
