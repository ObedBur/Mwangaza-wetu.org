import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
  HttpException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MemberMailService } from './member-mail.service';
import { CloudinaryService } from './cloudinary.service';
import { CreateMemberDto, Sexe } from './dto/create-member.dto';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';
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

  async updateOwnProfile(id: number, dto: UpdateOwnProfileDto) {
    const telephone = dto.telephone?.trim();
    const email = dto.email === undefined ? undefined : dto.email?.trim().toLowerCase() || null;
    const adresse = dto.adresse === undefined ? undefined : dto.adresse?.trim() || null;
    if (telephone === undefined && email === undefined && adresse === undefined) {
      throw new BadRequestException('Aucune information à modifier');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const member = await tx.membre.update({
          where: { id },
          data: { telephone, email, adresse },
          select: {
            id: true,
            nomComplet: true,
            numeroCompte: true,
            telephone: true,
            email: true,
            adresse: true,
            typeCompte: true,
            statut: true,
            dateAdhesion: true,
            photoProfil: true,
          },
        });
        await tx.adminLog.create({
          data: {
            action: 'MEMBER_PROFILE_UPDATED',
            details: `Le membre #${id} a mis à jour ses coordonnées de contact.`,
            success: true,
            userId: id,
          },
        });
        return member;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Cet e-mail ou numéro de téléphone est déjà utilisé');
      }
      throw error;
    }
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

      const creation = await this.prisma.$transaction(async (tx) => {
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

      const { motDePasse: _passwordHash, activationToken: _token, ...safeMembre } = membre;
      return safeMembre;
      });

      // ── Envoi des identifiants : APRÈS le commit, jamais dedans ──────────
      // Avant, cet envoi était dans la transaction Prisma. Or une transaction
      // expire au bout de 5 s (par défaut) alors que l'envoi vers Brevo peut
      // en prendre 18 : la transaction expirait, tout était annulé, et
      // l'API répondait 500 SANS créer le membre. Une panne de SMTP ne doit
      // pas empêcher de créer un membre → on renvoie credentialsSent: false.
      let credentialsSent = false;
      try {
        await this.memberMail.sendTemporaryPassword({
          email,
          fullName: creation.nomComplet,
          accountNumber: creation.numeroCompte,
          password: temporaryPassword,
        });
        credentialsSent = true;
      } catch (error) {
        this.logger.warn(
          `⚠ Membre ${creation.numeroCompte} créé, mais l'e-mail d'identifiants non envoyé : ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Laisser une trace visible dans le portail membre. Cette écriture est
      // volontairement après la création : une panne de notifications ne doit
      // jamais annuler l'inscription ni l'envoi des identifiants.
      try {
        await this.prisma.notifications.create({
          data: {
            membre_id: creation.id,
            titre: 'Bienvenue dans votre espace membre',
            message: credentialsSent
              ? 'Votre compte est prêt. Vos identifiants temporaires ont été envoyés à votre adresse e-mail. Après votre première connexion, modifiez votre mot de passe depuis votre profil.'
              : 'Votre compte est créé, mais l’envoi des identifiants par e-mail n’a pas pu être confirmé. Contactez votre agence pour obtenir de l’aide avant votre première connexion.',
            type: 'compte',
          },
        });
      } catch (error) {
        this.logger.warn(
          `Notification de bienvenue non créée pour ${creation.numeroCompte} : ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      this.logger.log(
        `✅ Membre créé avec succès : ${creation.numeroCompte} - ${creation.nomComplet}`,
      );
      // Mot de passe temporaire renvoyé uniquement à l'appelant autorisé
      // lors de cette création, afin qu'il puisse le remettre au membre.
      return { ...creation, credentialsSent, motDePasseTemporaire: temporaryPassword };
    } catch (error) {
      await this.deletePhotoAssets([
        { url: memberPhoto?.url, publicId: memberPhoto?.publicId },
        { url: delegatePhoto?.url, publicId: delegatePhoto?.publicId },
      ]);
      throw this.traduireErreurCreation(error);
    }
  }

  /**
   * Traduit une erreur brute en message réellement exploitable.
   *
   * Sans cela NestJS renvoie « Internal server error » sans aucun détail :
   * ni l'agent au guichet ni le développeur suivant ne peuvent comprendre ce
   * qui s'est passé. On conserve la stack complète côté serveur et on ne
   * renvoie côté client que ce qui aide à agir — jamais de détails internes
   * (SQL, chemins de fichiers, mots de passe).
   */
  private traduireErreurCreation(error: unknown): unknown {
    // Une exception déjà formulée (champ vide, format invalide, ...) est
    // renvoyée telle quelle : son message est déjà lisible par l'utilisateur.
    if (error instanceof HttpException) {
      return error;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2002': {
          // Contrainte d'unicité violée : on dit quel champ est déjà pris.
          const cibles = Array.isArray(error.meta?.target)
            ? (error.meta.target as string[])
            : typeof error.meta?.target === 'string'
              ? [error.meta.target]
              : [];
          const champ = cibles.map((c) => this.traduireColonne(c)).join(', ');
          return new BadRequestException(
            champ
              ? `Ce ${champ} est déjà utilisé par un autre membre.`
              : 'Ces informations sont déjà utilisées par un autre membre.',
          );
        }
        case 'P2003':
          return new BadRequestException(
            `Opération impossible : une donnée de référence manque en base (table « ${
              String(error.meta?.table ?? 'inconnue')
            } »). Aucun membre n'a été créé. Prévenez le responsable technique.`,
          );
        case 'P2025':
          return new NotFoundException('Enregistrement introuvable.');
        case 'P2028':
          return new InternalServerErrorException(
            "La base de données n'a pas répondu à temps : l'opération a été annulée et rien n'a été enregistré. Réessayez.",
          );
      }
    }

    // Erreur inconnue : tout est journalisé (stack comprise) sous une
    // référence que l'opérateur peut transmettre, sans rien exposer d'autre.
    const reference = crypto.randomBytes(3).toString('hex');
    this.logger.error(
      `Création de membre impossible (réf. ${reference}) : ${
        error instanceof Error ? error.stack : String(error)
      }`,
    );
    return new InternalServerErrorException(
      "Erreur interne lors de la création du membre — rien n'a été enregistré. " +
        `Référence à transmettre au responsable technique : ${reference}`,
    );
  }

  /** Noms de colonnes de la base → libellés compréhensibles à l'écran. */
  private traduireColonne(colonne: string): string {
    const libelles: Record<string, string> = {
      numero_compte: 'numéro de compte',
      telephone: 'numéro de téléphone',
      email: 'adresse e-mail',
      id_nationale: 'identifiant national',
      user_id: 'identifiant agent',
    };
    return libelles[colonne] ?? colonne;
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
      ...membre.epargnes
        .filter((e) => !e.remboursementId)
        .map((e) => {
          const retraitAssocie = e.typeOperation === 'retrait'
            ? membre.retraits.find((r) => r.devise === e.devise && Number(r.montant) === Number(e.montant) && new Date(r.dateOperation).getTime() === new Date(e.dateOperation).getTime())
            : undefined;
          return {
            type: e.typeOperation,
            devise: e.devise,
            montant: Number(e.montant),
            date: e.dateOperation,
            description: e.description,
            compteType: e.typeCompte,
            statut: retraitAssocie?.statut ?? 'COMPLETED',
          };
        }),
      ...membre.retraits
        .filter((r) => !membre.epargnes.some((e) => e.typeOperation === 'retrait' && e.devise === r.devise && Number(e.montant) === Number(r.montant) && new Date(e.dateOperation).getTime() === new Date(r.dateOperation).getTime()))
        .map((r) => ({
          type: 'retrait',
          devise: r.devise,
          montant: Number(r.montant),
          date: r.dateOperation,
          description: r.description,
          compteType: 'PRINCIPAL',
          statut: r.statut,
        })),
      ...membre.credits.flatMap((c) =>
        c.remboursements.filter((r) => !r.deletedAt).map((r) => ({
          type: 'remboursement',
          devise: r.devise,
          montant: Number(r.montant),
          date: r.dateRemboursement,
          description: r.description,
          compteType: 'CREDIT',
          statut: 'COMPLETED',
        })),
      ),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Calculs de l'épargne (dépôts - retraits)
    const balanceFor = (devise: Devise) => membre.epargnes
      .filter((e) => e.devise === devise && e.typeCompte !== 'DAT')
      .reduce((sum, e) => sum + Number(e.montant) * (e.typeOperation === 'retrait' ? -1 : 1), 0);
    const epargneUSD = balanceFor(Devise.USD);
    const epargneFC = balanceFor(Devise.FC);
    const now = new Date();
    const monthlyActivity = Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      return { monthKey, month: monthDate.toLocaleDateString('fr-FR', { month: 'short' }), USD: { deposits: 0, withdrawals: 0 }, FC: { deposits: 0, withdrawals: 0 } };
    });
    const activityByMonth = new Map(monthlyActivity.map((item) => [item.monthKey, item]));
    for (const transaction of allTransactions) {
      if (transaction.statut !== 'COMPLETED') continue;
      const date = new Date(transaction.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const bucket = activityByMonth.get(key);
      if (!bucket || (transaction.devise !== Devise.USD && transaction.devise !== Devise.FC)) continue;
      if (transaction.type === 'depot') bucket[transaction.devise].deposits += transaction.montant;
      if (transaction.type === 'retrait') bucket[transaction.devise].withdrawals += transaction.montant;
    }

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
        dateEcheance: c.dateEcheance,
        statut: c.statut,
        progression: montantTotal > 0 ? (rembourse / montantTotal) * 100 : 0,
      };
    });

    return {
      profile: {
        id: membre.id,
        numeroCompte: membre.numeroCompte,
        nomComplet: membre.nomComplet,
        telephone: membre.telephone,
        email: membre.email,
        adresse: membre.adresse,
        sexe: membre.sexe,
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
      monthlyActivity,
      recentTransactions: allTransactions.slice(0, 15), // Only last 15 for dashboard performance
    };
  }

  async getMemberTransactions(numeroCompte: string, page: number, pageSize: number) {
    const membre = await this.prisma.membre.findUnique({
      where: { numeroCompte },
      select: { id: true },
    });
    if (!membre) throw new NotFoundException('Membre non trouvé');

    const take = page * pageSize;
    const [depots, retraits, credits, depotsCount, retraitsCount, remboursementsCount] = await Promise.all([
      this.prisma.epargne.findMany({
        where: { compte: numeroCompte, typeOperation: 'depot', remboursementId: null },
        orderBy: { dateOperation: 'desc' },
        take,
      }),
      this.prisma.retrait.findMany({
        where: { compte: numeroCompte },
        orderBy: { dateOperation: 'desc' },
        take,
      }),
      this.prisma.credit.findMany({
        where: { numeroCompte },
        select: {
          id: true,
          remboursements: {
            where: { deletedAt: null },
            orderBy: { dateRemboursement: 'desc' },
            take,
          },
        },
      }),
      this.prisma.epargne.count({
        where: { compte: numeroCompte, typeOperation: 'depot', remboursementId: null },
      }),
      this.prisma.retrait.count({ where: { compte: numeroCompte } }),
      this.prisma.remboursement.count({
        where: { credit: { numeroCompte }, deletedAt: null },
      }),
    ]);

    const transactions = [
      ...depots.map((row) => ({
        id: `epargne-${row.id}`,
        date: row.dateOperation,
        description: row.description ?? 'Opération d’épargne',
        type: row.typeOperation,
        devise: row.devise,
        montant: Number(row.montant),
        statut: 'COMPLETED',
      })),
      ...retraits.map((row) => ({
        id: `retrait-${row.id}`,
        date: row.dateOperation,
        description: row.description ?? 'Retrait au guichet',
        type: 'retrait',
        devise: row.devise,
        montant: Number(row.montant),
        statut: row.statut,
      })),
      ...credits.flatMap((credit) => credit.remboursements.map((row) => ({
        id: `remboursement-${row.id}`,
        date: row.dateRemboursement,
        description: row.description ?? 'Remboursement de crédit',
        type: 'remboursement',
        devise: row.devise,
        montant: Number(row.montant),
        statut: 'COMPLETED',
      }))),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const total = depotsCount + retraitsCount + remboursementsCount;
    const data = transactions.slice((page - 1) * pageSize, page * pageSize);
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
