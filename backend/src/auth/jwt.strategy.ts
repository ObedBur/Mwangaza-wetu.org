import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-request';

/** Shape of the JWT signed by AuthService */
export interface JwtPayload {
  id?: number;
  email?: string | null;
  accountNumber?: string | null;
  role?: string;
  fullName?: string;
  guichet?: string;
}

const REVOKED_MESSAGE =
  'Session expirée ou compte désactivé : veuillez vous reconnecter';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') ?? '',
    });
  }

  /**
   * Revocation check: a token is only valid while its account still exists
   * and is still active (admin.actif / agent.actif / member.isActivated).
   * Disabling a account invalidates its live tokens on the next request.
   * Whatever is returned here is attached to request.user.
   */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (typeof payload.id !== 'number' || !payload.role) {
      throw new UnauthorizedException('Session invalide');
    }

    if (payload.role === 'member') {
      const member = await this.prisma.membre.findUnique({
        where: { id: payload.id },
        select: { id: true, isActivated: true },
      });
      if (!member || !member.isActivated) {
        throw new UnauthorizedException(REVOKED_MESSAGE);
      }
    } else if (payload.role === 'agent') {
      const agent = await this.prisma.agent.findUnique({
        where: { id: payload.id },
        select: { id: true, actif: true },
      });
      if (!agent || !agent.actif) {
        throw new UnauthorizedException(REVOKED_MESSAGE);
      }
    } else {
      // admin / superadmin
      const admin = await this.prisma.administrateur.findUnique({
        where: { id: payload.id },
        select: { id: true, actif: true },
      });
      if (!admin || !admin.actif) {
        throw new UnauthorizedException(REVOKED_MESSAGE);
      }
    }

    return {
      userId: payload.id,
      email: payload.email ?? undefined,
      accountNumber: payload.accountNumber ?? undefined,
      role: payload.role,
      fullName: payload.fullName,
      guichet: payload.guichet,
    };
  }
}
