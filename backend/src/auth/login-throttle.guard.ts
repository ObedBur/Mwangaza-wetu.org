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
const MAX_PER_IP = 30;
const MAX_PER_IP_AND_IDENTIFIER = 6;

@Injectable()
export class LoginThrottleGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async resetIdentifier(request: Request) {
    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    const identifier = this.getIdentifier(request);
    if (!identifier) return;
    await this.prisma.loginAttempt.deleteMany({
      where: { ip, identifier },
    });
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

    // Cherche une tentative existante dans la fenêtre
    let attempt = await this.prisma.loginAttempt.findFirst({
      where: {
        ip,
        ...(identifier ? { identifier } : {}),
        firstAttempt: { gte: windowStart },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!attempt) {
      // Première tentative dans la fenêtre
      await this.prisma.loginAttempt.create({
        data: { ip, identifier: identifier ?? '', count: 1 },
      });
      return undefined;
    }

    if (attempt.count >= limit) {
      const retryAfterMs = attempt.firstAttempt.getTime() + WINDOW_MS - now.getTime();
      return Math.max(1, Math.ceil(retryAfterMs / 1000));
    }

    // Incrémente le compteur
    await this.prisma.loginAttempt.update({
      where: { id: attempt.id },
      data: { count: attempt.count + 1, updatedAt: now },
    });

    return undefined;
  }

  private setRetryAfter(response: Response, seconds: number) {
    response.setHeader('Retry-After', String(Math.max(1, seconds)));
  }

  private getIdentifier(request: Request) {
    const body = request.body as { email?: unknown; accountNumber?: unknown } | undefined;
    const raw = String(body?.email ?? body?.accountNumber ?? '').trim().toLowerCase().slice(0, 256);
    // On hache l'identifiant pour ne pas stocker de donnée personnelle en clair
    return raw ? createHash('sha256').update(raw).digest('hex') : '';
  }

  private assertAllowedOrigin(request: Request) {
    const origin = request.get('origin');
    if (!origin) return;
    const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5000')
      .split(',')
      .map((value) => value.trim().replace(/^['"]|['"]$/g, ''));
    if (!allowedOrigins.includes('http://localhost:5000')) allowedOrigins.push('http://localhost:5000');
    if (!allowedOrigins.includes(origin)) throw new ForbiddenException('Origine non autorisée');
  }
}
