import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { Administrateur, Membre, Agent } from '@prisma/client';
import type { AuthUser } from '../common/types/auth-request';
import { SessionRevocationService } from './session-revocation.service';

const DUMMY_PASSWORD_HASH = '$2b$12$It432ShYcsQ0kRyH7jJnk.Hq88W2iZA1/PjnL4JDTYjRJ3vNoU33e';
const INVALID_LOGIN_MESSAGE = 'Identifiants incorrects';

/** Nombre d'échecs avant verrouillage temporaire du compte. */
const MAX_LOGIN_FAILURES = 10;
/** Fenêtre glissante dans laquelle les échecs sont comptés. */
const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
/** Durée du verrouillage : 15 minutes. */
const LOCK_DURATION_MS = 15 * 60 * 1000;

type LoginRole = 'admin' | 'superadmin' | 'agent' | 'member';

/**
 * Tables porteuses du verrouillage. Ce sont des constantes internes (jamais
 * une entrée utilisateur) : l'interpolation du nom de table est donc sûre.
 */
const LOCK_TABLES: Record<LoginRole, string> = {
  admin: 'administrateurs',
  superadmin: 'administrateurs',
  agent: 'agents',
  member: 'membres',
};

interface LoginCandidate {
  role: LoginRole;
  id: number;
  passwordHash: string;
  lockedUntil: Date | null;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private readonly sessionRevocation: SessionRevocationService,
  ) {}

  /**
   * Signe un JWT avec un identifiant unique (`jti`) qui permet de le
   * révoquer explicitement lors de la déconnexion.
   */
  private signToken(payload: object): string {
    return this.jwtService.sign(payload, { jwtid: randomUUID() });
  }

  /**
   * Révoque la session portée par le jeton fourni (logout).
   * Un jeton expiré ou invalide n'a rien à révoquer.
   */
  async revokeSession(token: string | null | undefined): Promise<void> {
    if (!token) return;

    try {
      const payload = this.jwtService.verify<{ jti?: string; exp?: number }>(
        token,
      );
      if (!payload.jti) return;

      const expiresAt =
        payload.exp ?? Math.floor(Date.now() / 1000) + 24 * 60 * 60;
      await this.sessionRevocation.revoke(payload.jti, expiresAt);
    } catch {
      // Jeton absent, expiré ou invalide : rien à révoquer.
    }
  }

  private async resetLoginFailures(
    role: string,
    id: number,
  ): Promise<void> {
    if (role === 'member') {
      await this.prisma.membre.update({
        where: { id },
        data: { loginFailures: 0, loginFailuresSince: null, lockedUntil: null },
      });
    } else if (role === 'agent') {
      await this.prisma.agent.update({
        where: { id },
        data: { loginFailures: 0, loginFailuresSince: null, lockedUntil: null },
      });
    } else if (role === 'admin' || role === 'superadmin') {
      await this.prisma.administrateur.update({
        where: { id },
        data: { loginFailures: 0, loginFailuresSince: null, lockedUntil: null },
      });
    }
  }

  /** Le compte est-il temporairement verrouillé ? */
  private isLocked(lockedUntil: Date | null): boolean {
    return Boolean(lockedUntil && lockedUntil.getTime() > Date.now());
  }

  /**
   * Enregistre un échec de connexion et verrouille le compte au seuil.
   * Le compteur est porté par le compte (et non par l'IP) : il protège donc
   * aussi contre le brute-force distribué sur plusieurs adresses IP.
   *
   * Les échecs sont comptés sur une fenêtre glissante : hors fenêtre le
   * compteur repart de zéro, et un verrou expiré ne rallonge jamais le
   * suivant. Sans cela, un compte verrouillé une première fois le restait
   * à chaque nouvel échec (verrouillage permanent de fait).
   */
  private async registerLoginFailure(
    role: LoginRole,
    id: number,
  ): Promise<void> {
    const table = LOCK_TABLES[role];
    const now = new Date();
    const windowStart = new Date(now.getTime() - LOGIN_FAILURE_WINDOW_MS);
    const lockUntil = new Date(now.getTime() + LOCK_DURATION_MS);

    // 1. Verrou expiré : on repart d'un compteur neuf.
    await this.prisma.$executeRawUnsafe(
      `UPDATE "${table}"
       SET "login_failures" = 0, "login_failures_since" = NULL, "locked_until" = NULL
       WHERE "id" = $1 AND "locked_until" IS NOT NULL AND "locked_until" <= $2`,
      id,
      now,
    );

    // 2. Hors fenêtre : même remise à zéro.
    await this.prisma.$executeRawUnsafe(
      `UPDATE "${table}"
       SET "login_failures" = 0, "login_failures_since" = $2
       WHERE "id" = $1
         AND ("login_failures_since" IS NULL OR "login_failures_since" < $3)`,
      id,
      now,
      windowStart,
    );

    // 3. Incrément atomique (plusieurs échecs concurrents ne se perdent pas).
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ login_failures: number }>
    >(
      `UPDATE "${table}"
       SET "login_failures" = "login_failures" + 1
       WHERE "id" = $1
       RETURNING "login_failures"`,
      id,
    );

    const failures = rows[0]?.login_failures ?? 0;
    if (failures < MAX_LOGIN_FAILURES) return;

    // 4. Seuil atteint : verrou temporaire. Le compteur est remis à zéro pour
    // qu'après expiration l'utilisateur retrouve une fenêtre complète.
    await this.prisma.$executeRawUnsafe(
      `UPDATE "${table}"
       SET "locked_until" = $2, "login_failures" = 0, "login_failures_since" = NULL
       WHERE "id" = $1`,
      id,
      lockUntil,
    );
  }

  /**
   * Déverrouille un compte (déverrouillage manuel par un administrateur).
   * À utiliser notamment quand un membre a épuisé ses tentatives et ne peut
   * pas attendre la fin du verrou.
   */
  async unlockAccount(role: LoginRole, id: number) {
    const table = LOCK_TABLES[role];
    const updated = await this.prisma.$executeRawUnsafe(
      `UPDATE "${table}"
       SET "login_failures" = 0, "login_failures_since" = NULL, "locked_until" = NULL
       WHERE "id" = $1`,
      id,
    );

    if (updated === 0) {
      throw new NotFoundException('Compte introuvable');
    }

    await this.prisma.adminLog.create({
      data: {
        action: 'ACCOUNT_UNLOCKED',
        details: `Déverrouillage du compte ${role} #${id}.`,
        success: true,
        userId: id,
      },
    });

    return { success: true, message: 'Compte déverrouillé.' };
  }

  async loginUnified(loginDto: LoginDto) {
    const { email, accountNumber, password } = loginDto;
    const identifier = (email ?? accountNumber)?.trim();

    if (!identifier) {
      throw new BadRequestException('Identifiant requis (email, numéro de compte ou téléphone)');
    }

    const [admin, agent, member] = await Promise.all([
      this.prisma.administrateur.findFirst({
        where: { OR: [{ email: identifier }, { numeroCompte: identifier }] },
      }),
      this.prisma.agent.findFirst({
        where: { OR: [{ email: identifier }, { telephone: identifier }] },
      }),
      this.prisma.membre.findFirst({
        where: {
          OR: [
            { email: identifier },
            { numeroCompte: identifier },
            { telephone: identifier },
          ],
        },
      }),
    ]);

    const candidate: LoginCandidate | null =
      (admin?.actif && {
        role: admin.role as LoginRole,
        passwordHash: admin.motDePasse,
        id: admin.id,
        lockedUntil: admin.lockedUntil,
      }) ||
      (agent?.actif && agent.motDePasse && {
        role: 'agent' as const,
        passwordHash: agent.motDePasse,
        id: agent.id,
        lockedUntil: agent.lockedUntil,
      }) ||
      (member?.isActivated && member.motDePasse && {
        role: 'member' as const,
        passwordHash: member.motDePasse,
        id: member.id,
        lockedUntil: member.lockedUntil,
      }) ||
      null;
    // La comparaison bcrypt est faite même pour un compte verrouillé (avec le
    // hash factice si besoin) afin de ne pas introduire d'oracle temporel.
    const passwordValid = await bcrypt.compare(password, candidate?.passwordHash ?? DUMMY_PASSWORD_HASH);

    if (!candidate) {
      throw new UnauthorizedException(INVALID_LOGIN_MESSAGE);
    }

    if (this.isLocked(candidate.lockedUntil)) {
      throw new UnauthorizedException(INVALID_LOGIN_MESSAGE);
    }

    if (!passwordValid) {
      await this.registerLoginFailure(candidate.role, candidate.id);
      throw new UnauthorizedException(INVALID_LOGIN_MESSAGE);
    }

    // Réinitialise les échecs en cas de succès
    await this.resetLoginFailures(candidate.role, candidate.id);

    if ((candidate.role === 'admin' || candidate.role === 'superadmin') && admin) {
      const user = {
        id: admin.id, email: admin.email, accountNumber: admin.numeroCompte,
        role: admin.role, authVersion: admin.authVersion, lastName: admin.nom,
        firstName: admin.prenom, fullName: `${admin.prenom} ${admin.nom}`,
        profilePhoto: admin.photoProfil,
      };
      return { success: true, message: 'Connexion réussie', token: this.signToken(user), user };
    }
    if (candidate.role === 'agent' && agent) {
      const user = {
        id: agent.id, email: agent.email, accountNumber: null, role: 'agent',
        fullName: agent.nom, guichet: agent.guichetAssigne, authVersion: agent.authVersion,
      };
      return { success: true, message: 'Connexion réussie', token: this.signToken(user), user };
    }
    if (candidate.role === 'member' && member) {
      const user = {
        id: member.id, email: member.email, accountNumber: member.numeroCompte,
        role: 'member', authVersion: member.authVersion, fullName: member.nomComplet,
        section: member.typeCompte, profilePhoto: member.photoProfil,
      };
      return { success: true, message: 'Connexion réussie', token: this.signToken(user), user };
    }
    throw new UnauthorizedException(INVALID_LOGIN_MESSAGE);
  }

  async loginAdmin(loginDto: LoginDto) {
    const { email, accountNumber, password } = loginDto;
    let admin: Administrateur | null = null;

    if (email) {
      admin = await this.prisma.administrateur.findUnique({ where: { email } });
    } else if (accountNumber) {
      admin = await this.prisma.administrateur.findUnique({
        where: { numeroCompte: accountNumber },
      });
    } else {
      throw new BadRequestException('Email ou numéro de compte requis');
    }

    const isValid = await bcrypt.compare(password, admin?.motDePasse ?? DUMMY_PASSWORD_HASH);
    if (!admin) {
      throw new UnauthorizedException(INVALID_LOGIN_MESSAGE);
    }
    if (this.isLocked(admin.lockedUntil)) {
      throw new UnauthorizedException(INVALID_LOGIN_MESSAGE);
    }
    if (!admin.actif || !isValid) {
      await this.registerLoginFailure(admin.role, admin.id);
      throw new UnauthorizedException(INVALID_LOGIN_MESSAGE);
    }

    // Réinitialise les échecs en cas de succès
    await this.resetLoginFailures(admin.role, admin.id);

    const payload = {
      id: admin.id,
      email: admin.email,
      accountNumber: admin.numeroCompte,
      role: admin.role,
      authVersion: admin.authVersion,
      lastName: admin.nom,
      firstName: admin.prenom,
      fullName: `${admin.prenom} ${admin.nom}`,
      profilePhoto: admin.photoProfil,
    };

    return {
      success: true,
      message: 'Connexion réussie',
      token: this.signToken(payload),
      user: payload,
    };
  }

  async loginMember(loginDto: LoginDto) {
    const { email, accountNumber, password } = loginDto;
    let member: Membre | null = null;

    if (email) {
      member = await this.prisma.membre.findFirst({ where: { email } });
    } else if (accountNumber) {
      member = await this.prisma.membre.findUnique({
        where: { numeroCompte: accountNumber },
      });
    } else {
      throw new BadRequestException('Email ou numéro de compte requis');
    }

    const isValid = await bcrypt.compare(password, member?.motDePasse ?? DUMMY_PASSWORD_HASH);
    if (!member) {
      throw new UnauthorizedException(INVALID_LOGIN_MESSAGE);
    }
    if (this.isLocked(member.lockedUntil)) {
      throw new UnauthorizedException(INVALID_LOGIN_MESSAGE);
    }
    if (!member.motDePasse || !member.isActivated || !isValid) {
      await this.registerLoginFailure('member', member.id);
      throw new UnauthorizedException(INVALID_LOGIN_MESSAGE);
    }

    // Réinitialise les échecs en cas de succès
    await this.resetLoginFailures('member', member.id);

    const payload = {
      id: member.id,
      email: member.email,
      accountNumber: member.numeroCompte,
      role: 'member',
      authVersion: member.authVersion,
    };

    return {
      success: true,
      message: 'Connexion membre réussie',
      token: this.signToken(payload),
      user: {
        ...payload,
        fullName: member.nomComplet,
        section: member.typeCompte,
        profilePhoto: member.photoProfil,
      },
    };
  }

  async changeMemberPassword(
    user: AuthUser,
    currentPassword: string,
    newPassword: string,
  ) {
    if (user.role !== 'member' || !user.userId) {
      throw new UnauthorizedException('Session membre invalide');
    }
    const member = await this.prisma.membre.findUnique({
      where: { id: user.userId },
      select: { id: true, motDePasse: true, isActivated: true },
    });
    if (!member?.isActivated || !member.motDePasse) {
      throw new UnauthorizedException('Compte membre non activé ou invalide');
    }
    if (!(await bcrypt.compare(currentPassword, member.motDePasse))) {
      throw new UnauthorizedException('Le mot de passe actuel est incorrect');
    }
    if (await bcrypt.compare(newPassword, member.motDePasse)) {
      throw new BadRequestException(
        'Le nouveau mot de passe doit être différent de l’actuel',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction(async (tx) => {
      await tx.membre.update({
        where: { id: member.id },
        data: {
          motDePasse: passwordHash,
          authVersion: { increment: 1 },
          loginFailures: 0,
          loginFailuresSince: null,
          lockedUntil: null,
        },
      });
      await tx.adminLog.create({
        data: {
          action: 'MEMBER_PASSWORD_CHANGED',
          details: `Le membre #${member.id} a modifié son mot de passe. Toutes ses sessions existantes ont été révoquées.`,
          success: true,
          userId: member.id,
        },
      });
    });
    return { success: true, sessionRevoked: true };
  }

  async changeAdminPassword(
    user: AuthUser,
    currentPassword: string,
    newPassword: string,
  ) {
    if (!user.userId || !['admin', 'superadmin'].includes(user.role ?? '')) {
      throw new UnauthorizedException('Session administrateur invalide');
    }
    const admin = await this.prisma.administrateur.findUnique({
      where: { id: user.userId },
      select: { id: true, motDePasse: true, actif: true },
    });
    if (!admin?.actif) {
      throw new UnauthorizedException('Compte administrateur non disponible');
    }
    if (!(await bcrypt.compare(currentPassword, admin.motDePasse))) {
      throw new UnauthorizedException('Le mot de passe actuel est incorrect');
    }
    if (await bcrypt.compare(newPassword, admin.motDePasse)) {
      throw new BadRequestException(
        'Le nouveau mot de passe doit être différent de l’actuel',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction(async (tx) => {
      await tx.administrateur.update({
        where: { id: admin.id },
        data: {
          motDePasse: passwordHash,
          authVersion: { increment: 1 },
          loginFailures: 0,
          loginFailuresSince: null,
          lockedUntil: null,
        },
      });
      await tx.adminLog.create({
        data: {
          action: 'ADMIN_PASSWORD_CHANGED',
          details: `L’administrateur #${admin.id} a modifié son mot de passe. Ses sessions existantes ont été révoquées.`,
          success: true,
          userId: admin.id,
        },
      });
    });
    return {
      success: true,
      message: 'Mot de passe modifié; reconnectez-vous.',
    };
  }

  async loginAgent(loginDto: LoginDto) {
    const { email, accountNumber, password } = loginDto;
    const identifier = email ?? accountNumber;

    if (!identifier) {
      throw new BadRequestException('Email ou téléphone requis');
    }

    const agent: Agent | null = await this.prisma.agent.findFirst({
      where: { OR: [{ email: identifier }, { telephone: identifier }] },
    });

    const isValid = await bcrypt.compare(password, agent?.motDePasse ?? DUMMY_PASSWORD_HASH);
    if (!agent) {
      throw new UnauthorizedException(INVALID_LOGIN_MESSAGE);
    }
    if (this.isLocked(agent.lockedUntil)) {
      throw new UnauthorizedException(INVALID_LOGIN_MESSAGE);
    }
    if (!agent.actif || !agent.motDePasse || !isValid) {
      await this.registerLoginFailure('agent', agent.id);
      throw new UnauthorizedException(INVALID_LOGIN_MESSAGE);
    }

    // Réinitialise les échecs en cas de succès
    await this.resetLoginFailures('agent', agent.id);

    const payload = {
      id: agent.id,
      email: agent.email,
      accountNumber: null,
      role: 'agent',
      fullName: agent.nom,
      guichet: agent.guichetAssigne,
      authVersion: agent.authVersion,
    };

    return {
      success: true,
      message: 'Connexion agent réussie',
      token: this.signToken(payload),
      user: payload,
    };
  }

  /** Fresh profile for GET /auth/me — resolved from the DB by JWT role */
  async getProfile(user: AuthUser) {
    if (!user.userId) {
      throw new UnauthorizedException('Session invalide');
    }

    if (user.role === 'member') {
      const member = await this.prisma.membre.findUnique({
        where: { id: user.userId },
      });
      if (!member) throw new UnauthorizedException('Session invalide');
      return {
        id: member.id,
        email: member.email ?? undefined,
        accountNumber: member.numeroCompte,
        role: 'member' as const,
        fullName: member.nomComplet,
        section: member.typeCompte,
        profilePhoto: member.photoProfil ?? undefined,
        isActivated: member.isActivated,
      };
    }

    if (user.role === 'agent') {
      const agent = await this.prisma.agent.findUnique({
        where: { id: user.userId },
      });
      if (!agent) throw new UnauthorizedException('Session invalide');
      return {
        id: agent.id,
        email: agent.email,
        accountNumber: undefined as string | undefined,
        role: 'agent' as const,
        fullName: agent.nom,
        guichet: agent.guichetAssigne,
        actif: agent.actif,
      };
    }

    const admin = await this.prisma.administrateur.findUnique({
      where: { id: user.userId },
    });
    if (!admin) throw new UnauthorizedException('Session invalide');
    return {
      id: admin.id,
      email: admin.email,
      accountNumber: admin.numeroCompte ?? undefined,
      role: admin.role,
      fullName: `${admin.prenom} ${admin.nom}`,
      profilePhoto: admin.photoProfil ?? undefined,
      actif: admin.actif,
    };
  }
}
