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

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async loginUnified(loginDto: LoginDto) {
    const { email, accountNumber, password } = loginDto;
    const identifier = (email ?? accountNumber)?.trim();

    if (!identifier) {
      throw new BadRequestException('Identifiant requis (email, numéro de compte ou téléphone)');
    }

    // 1. Tenter Administrateur / Superadmin
    const admin = await this.prisma.administrateur.findFirst({
      where: {
        OR: [{ email: identifier }, { numeroCompte: identifier }],
      },
    });

    if (admin && admin.actif) {
      const isValid = await bcrypt.compare(password, admin.motDePasse);
      if (isValid) {
        const payload = {
          id: admin.id,
          email: admin.email,
          accountNumber: admin.numeroCompte,
          role: admin.role,
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
    }

    // 2. Tenter Agent (Guichet)
    const agent = await this.prisma.agent.findFirst({
      where: {
        OR: [{ email: identifier }, { telephone: identifier }],
      },
    });

    if (agent && agent.actif && agent.motDePasse) {
      const isValid = await bcrypt.compare(password, agent.motDePasse);
      if (isValid) {
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
    }

    // 3. Tenter Membre
    const member = await this.prisma.membre.findFirst({
      where: {
        OR: [
          { email: identifier },
          { numeroCompte: identifier },
          { telephone: identifier },
        ],
      },
    });

    if (member && member.motDePasse && member.isActivated) {
      const isValid = await bcrypt.compare(password, member.motDePasse);
      if (isValid) {
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
    }

    throw new UnauthorizedException('Identifiants incorrects ou compte inactif');
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

    if (!admin || !admin.actif) {
      throw new UnauthorizedException('Admin non trouvé ou inactif');
    }

    const isValid = await bcrypt.compare(password, admin.motDePasse);
    if (!isValid) {
      throw new UnauthorizedException('Mot de passe incorrect');
    }

    const payload = {
      id: admin.id,
      email: admin.email,
      accountNumber: admin.numeroCompte,
      role: admin.role,
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

    if (!member) {
      throw new UnauthorizedException('Membre non trouvé');
    }

    if (!member.motDePasse) {
      throw new UnauthorizedException('Compte membre non configuré');
    }

    if (!member.isActivated) {
      throw new UnauthorizedException(
        'Compte membre non activé : veuillez finaliser votre activation',
      );
    }

    const isValid = await bcrypt.compare(password, member.motDePasse);
    if (!isValid) {
      throw new UnauthorizedException('Mot de passe incorrect');
    }

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

  async changeMemberPassword(user: AuthUser, currentPassword: string, newPassword: string) {
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
      throw new BadRequestException('Le nouveau mot de passe doit être différent de l’actuel');
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

  async loginAgent(loginDto: LoginDto) {
    const { email, accountNumber, password } = loginDto;
    const identifier = email ?? accountNumber;

    if (!identifier) {
      throw new BadRequestException('Email ou téléphone requis');
    }

    const agent: Agent | null = await this.prisma.agent.findFirst({
      where: { OR: [{ email: identifier }, { telephone: identifier }] },
    });

    if (!agent) {
      throw new UnauthorizedException('Agent non trouvé');
    }

    if (!agent.actif) {
      throw new UnauthorizedException('Agent inactif');
    }

    if (!agent.motDePasse) {
      throw new UnauthorizedException('Compte agent non configuré');
    }

    const isValid = await bcrypt.compare(password, agent.motDePasse);
    if (!isValid) {
      throw new UnauthorizedException('Mot de passe incorrect');
    }

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
