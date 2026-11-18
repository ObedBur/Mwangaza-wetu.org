import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Response } from 'express';
import { RateLimitService } from '../redis/rate-limit.service';
import type { AuthenticatedRequest } from '../common/types/auth-request';

/** Fenêtre de limitation des changements de mot de passe. */
const WINDOW_MS = 15 * 60 * 1000;
/**
 * Un utilisateur légitime change rarement de mot de passe deux fois de suite.
 * La limite protège surtout contre l'utilisation d'un jeton volé pour deviner
 * le mot de passe actuel par force brute (le seul contrôle restant une fois
 * la session ouverte).
 */
const MAX_ATTEMPTS = 5;

/**
 * Limite les tentatives de changement de mot de passe par utilisateur.
 *
 * La clé est `pwd-change:<role>:<userId>` : un compteur par compte, quel que
 * soit l'endpoint emprunté (`/api/auth/me/change-password` ou l'alias
 * `/api/agents/me/change-password`). Le garde s'exécute après `JwtAuthGuard`
 * (garde global), donc `request.user` est déjà renseigné.
 */
@Injectable()
export class PasswordChangeThrottleGuard implements CanActivate {
  constructor(private readonly rateLimit: RateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest & { ip?: string }>();
    const response = context.switchToHttp().getResponse<Response>();

    const user = request.user;
    // Sans utilisateur identifié, `JwtAuthGuard` rejettera la requête : rien
    // à compter ici (sinon on créerait un compteur partagé « undefined »).
    if (!user?.userId) return true;

    const key = `pwd-change:${user.role ?? 'unknown'}:${user.userId}`;
    const retryAfter = await this.rateLimit.consume(
      key,
      MAX_ATTEMPTS,
      WINDOW_MS,
    );

    if (retryAfter) {
      response.setHeader('Retry-After', String(retryAfter));
      throw new HttpException(
        'Trop de tentatives de changement de mot de passe. Réessayez plus tard.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
