import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_PER_IP = 50;
const MAX_PER_IP_AND_IDENTIFIER = 6;

@Injectable()
export class LoginThrottleGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Réinitialise les compteurs après une connexion réussie.
   *
   * On ne purge QUE le bucket (IP, identifiant) de la connexion réussie, et on
   * décrémente le bucket global de l'IP : les échecs essuyés sur d'autres
   * comptes restent comptabilisés. Purger tous les buckets de l'IP permettait
   * à un attaquant disposant d'un compte valide de remettre ses compteurs à
   * zéro à volonté (et donc de contourner la limitation par identifiant).
   */
  async resetAfterSuccessfulLogin(request: Request) {
    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    const identifier = this.getIdentifier(request);

    await this.prisma.$transaction([
      // Le succès efface les échecs du compte concerné pour cette IP.
      ...(identifier
        ? [this.prisma.loginAttempt.deleteMany({ where: { ip, identifier } })]
        : []),
      // Le bucket global compte aussi les succès : on retire uniquement la
      // tentative courante pour que les connexions légitimes en NAT ne
      // consomment pas le quota d'échecs.
      this.prisma.$executeRaw`
        UPDATE "login_attempts"
        SET "count" = GREATEST("count" - 1, 0), "updated_at" = now()
        WHERE "ip" = ${ip} AND "identifier" = ''
      `,
    ]);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    this.assertAllowedOrigin(request);

    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    const identifier = this.getIdentifier(request);

    try {
      // 1. Limite par IP seule
      const ipRetryAfter = await this.consume(ip, null, MAX_PER_IP);
      if (ipRetryAfter) {
        this.setRetryAfter(response, ipRetryAfter);
        throw new HttpException('Trop de tentatives. Réessayez plus tard.', HttpStatus.TOO_MANY_REQUESTS);
      }

      // 2. Limite par IP + identifiant (si identifiant fourni)
      if (identifier) {
        const idRetryAfter = await this.consume(ip, identifier, MAX_PER_IP_AND_IDENTIFIER);
        if (idRetryAfter) {
          this.setRetryAfter(response, idRetryAfter);
          throw new HttpException('Trop de tentatives pour ce compte. Réessayez plus tard.', HttpStatus.TOO_MANY_REQUESTS);
        }
      }

      return true;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Service de connexion temporairement indisponible.', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  private async consume(
    ip: string,
    identifier: string | null,
    limit: number,
  ): Promise<number | undefined> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - WINDOW_MS);
    const bucketIdentifier = identifier ?? '';

    // L'upsert PostgreSQL est atomique : des requêtes simultanées ne peuvent
    // ni créer des compteurs concurrents ni perdre des incréments.
    const [attempt] = await this.prisma.$queryRaw<
      Array<{ count: number; first_attempt: Date }>
    >`
      INSERT INTO "login_attempts" ("ip", "identifier", "count", "first_attempt", "updated_at")
      VALUES (${ip}, ${bucketIdentifier}, 1, ${now}, ${now})
      ON CONFLICT ("ip", "identifier")
      DO UPDATE SET
        "count" = CASE
          WHEN "login_attempts"."first_attempt" < ${windowStart} THEN 1
          ELSE "login_attempts"."count" + 1
        END,
        "first_attempt" = CASE
          WHEN "login_attempts"."first_attempt" < ${windowStart} THEN ${now}
          ELSE "login_attempts"."first_attempt"
        END,
        "updated_at" = ${now}
      RETURNING "count", "first_attempt"
    `;

    if (attempt.count > limit) {
      const retryAfterMs = attempt.first_attempt.getTime() + WINDOW_MS - now.getTime();
      return Math.max(1, Math.ceil(retryAfterMs / 1000));
    }

    return undefined;
  }

  private setRetryAfter(response: Response, seconds: number) {
    response.setHeader('Retry-After', String(Math.max(1, seconds)));
  }

  private getIdentifier(request: Request) {
    const body = request.body as { email?: unknown; accountNumber?: unknown } | undefined;
    const value = body?.email ?? body?.accountNumber;
    const raw =
      typeof value === 'string'
        ? value.trim().toLowerCase().slice(0, 256)
        : '';
    // On hache l'identifiant pour ne pas stocker de donnée personnelle en clair
    return raw ? createHash('sha256').update(raw).digest('hex') : '';
  }

  private assertAllowedOrigin(request: Request) {
    const origin = request.get('origin');
    if (!origin) return;
    const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5000')
      .split(',')
      .map((value) => value.trim().replace(/^['"]|['"]$/g, ''));
    if (
      process.env.NODE_ENV !== 'production' &&
      !allowedOrigins.includes('http://localhost:5000')
    ) {
      allowedOrigins.push('http://localhost:5000');
    }
    if (!allowedOrigins.includes(origin)) throw new ForbiddenException('Origine non autorisée');
  }
}
