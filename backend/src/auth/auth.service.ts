import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { Administrateur, Membre, Agent } from '@prisma/client';
import type { AuthUser } from '../common/types/auth-request';

const DUMMY_PASSWORD_HASH = '$2b$12$It432ShYcsQ0kRyH7jJnk.Hq88W2iZA1/PjnL4JDTYjRJ3vNoU33e';
const INVALID_LOGIN_MESSAGE = 'Identifiants incorrects';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private async resetLoginFailures(
    role: string,
    id: number,
  ): Promise<void> {
    if (role === 'member') {
      await this.prisma.membre.update({
        where: { id },
        data: { loginFailures: 0, lockedUntil: null },
      });
    } else if (role === 'agent') {
      await this.prisma.agent.update({
        where: { id },
        data: { loginFailures: 0, lockedUntil: null },
      });
    } else if (role === 'admin' || role === 'superadmin') {
      await this.prisma.administrateur.update({
        where: { id },
        data: { loginFailures: 0, lockedUntil: null },
      });
    }
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

    const candidate =
      (admin?.actif && { role: 'admin' as const, passwordHash: admin.motDePasse, id: admin.id }) ||
      (agent?.actif && agent.motDePasse && { role: 'agent' as const, passwordHash: agent.motDePasse, id: agent.id }) ||
      (member?.isActivated && member.motDePasse && { role: 'member' as const, passwordHash: member.motDePasse, id: member.id }) ||
      null;
    const passwordValid = await bcrypt.compare(password, candidate?.passwordHash ?? DUMMY_PASSWORD_HASH);

    if (!candidate || !passwordValid) {
      throw new UnauthorizedException(INVALID_LOGIN_MESSAGE);
    }

    // Réinitialise les échecs en cas de succès
    await this.resetLoginFailures(candidate.role, candidate.id);

    if (candidate.role === 'admin' && admin) {
      const user = {
        id: admin.id, email: admin.email, accountNumber: admin.numeroCompte,
        role: admin.role, authVersion: admin.authVersion, lastName: admin.nom,
        firstName: admin.prenom, fullName: `${admin.prenom} ${admin.nom}`,
        profilePhoto: admin.photoProfil,
      };
      return { success: true, message: 'Connexion réussie', token: this.jwtService.sign(user), user };
    }
    if (candidate.role === 'agent' && agent) {
      const user = {
        id: agent.id, email: agent.email, accountNumber: null, role: 'agent',
        fullName: agent.nom, guichet: agent.guichetAssigne, authVersion: agent.authVersion,
      };
      return { success: true, message: 'Connexion réussie', token: this.jwtService.sign(user), user };
    }
    if (candidate.role === 'member' && member) {
      const user = {
        id: member.id, email: member.email, accountNumber: member.numeroCompte,
        role: 'member', authVersion: member.authVersion, fullName: member.nomComplet,
        section: member.typeCompte, profilePhoto: member.photoProfil,
      };
      return { success: true, message: 'Connexion réussie', token: this.jwtService.sign(user), user };
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
    if (!admin || !admin.actif || !isValid) {
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
      token: this.jwtService.sign(payload),
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
    if (!member || !member.motDePasse || !member.isActivated || !isValid) {
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
      token: this.jwtService.sign(payload),
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
        data: { motDePasse: passwordHash, authVersion: { increment: 1 } },
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
        data: { motDePasse: passwordHash, authVersion: { increment: 1 } },
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
    if (!agent || !agent.actif || !agent.motDePasse || !isValid) {
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
      token: this.jwtService.sign(payload),
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
