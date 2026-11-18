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
import { RateLimitService } from '../redis/rate-limit.service';
import { getAllowedOrigins } from '../common/config/allowed-origins';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_PER_IP = 50;
const MAX_PER_IP_AND_IDENTIFIER = 6;

/**
 * Limitation des tentatives de connexion.
 *
 * Les compteurs vivent dans Redis (partagés entre instances) avec un repli
 * mémoire, et non plus dans PostgreSQL : plus aucune écriture base de données
 * n'est déclenchée par une tentative non authentifiée.
 */
@Injectable()
export class LoginThrottleGuard implements CanActivate {
  constructor(private readonly rateLimit: RateLimitService) {}

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
    const ip = this.getIp(request);
    const identifier = this.getIdentifier(request);

    await Promise.all([
      identifier
        ? this.rateLimit.reset(this.identifierKey(ip, identifier))
        : Promise.resolve(),
      // Le bucket global compte aussi les succès : on retire uniquement la
      // tentative courante pour que les connexions légitimes en NAT ne
      // consomment pas le quota d'échecs.
      this.rateLimit.decrement(this.ipKey(ip)),
    ]);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    this.assertAllowedOrigin(request);

    const ip = this.getIp(request);
    const identifier = this.getIdentifier(request);

    try {
      // 1. Limite par IP seule
      const ipRetryAfter = await this.rateLimit.consume(
        this.ipKey(ip),
        MAX_PER_IP,
        WINDOW_MS,
      );
      if (ipRetryAfter) {
        this.setRetryAfter(response, ipRetryAfter);
        throw new HttpException(
          'Trop de tentatives. Réessayez plus tard.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // 2. Limite par IP + identifiant (si identifiant fourni)
      if (identifier) {
        const idRetryAfter = await this.rateLimit.consume(
          this.identifierKey(ip, identifier),
          MAX_PER_IP_AND_IDENTIFIER,
          WINDOW_MS,
        );
        if (idRetryAfter) {
          this.setRetryAfter(response, idRetryAfter);
          throw new HttpException(
            'Trop de tentatives pour ce compte. Réessayez plus tard.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }

      return true;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        'Service de connexion temporairement indisponible.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private ipKey(ip: string) {
    return `login:ip:${ip}`;
  }

  private identifierKey(ip: string, identifier: string) {
    return `login:id:${ip}:${identifier}`;
  }

  private getIp(request: Request) {
    return request.ip || request.socket.remoteAddress || 'unknown';
  }

  private setRetryAfter(response: Response, seconds: number) {
    response.setHeader('Retry-After', String(Math.max(1, seconds)));
  }

  private getIdentifier(request: Request) {
    const body = request.body as
      | { email?: unknown; accountNumber?: unknown }
      | undefined;
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
    if (!getAllowedOrigins().includes(origin)) {
      throw new ForbiddenException('Origine non autorisée');
    }
  }
}
