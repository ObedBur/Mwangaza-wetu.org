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

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_IP = 30;
const MAX_PER_IP_AND_IDENTIFIER = 6;

@Injectable()
export class LoginThrottleGuard implements CanActivate {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();
  private checksSinceCleanup = 0;

  resetIdentifier(request: Request) {
    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    const body = request.body as { email?: unknown; accountNumber?: unknown } | undefined;
    const identifier = String(body?.email ?? body?.accountNumber ?? '').trim().toLowerCase().slice(0, 256);
    const key = createHash('sha256').update(`identity:${ip}:${identifier}`).digest('hex');
    this.buckets.delete(key);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    this.assertAllowedOrigin(request);

    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    const body = request.body as { email?: unknown; accountNumber?: unknown } | undefined;
    const identifier = String(body?.email ?? body?.accountNumber ?? '').trim().toLowerCase().slice(0, 256);
    const now = Date.now();
    const retryAt = this.consume(`ip:${ip}`, MAX_PER_IP, now)
      ?? this.consume(`identity:${ip}:${identifier}`, MAX_PER_IP_AND_IDENTIFIER, now);

    if (retryAt) {
      response.setHeader('Retry-After', String(Math.max(1, Math.ceil((retryAt - now) / 1000))));
      throw new HttpException('Trop de tentatives. Réessayez plus tard.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }

  private consume(rawKey: string, limit: number, now: number): number | undefined {
    const key = createHash('sha256').update(rawKey).digest('hex');
    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
      this.cleanupIfNeeded(now);
      return undefined;
    }
    if (current.count >= limit) return current.resetAt;
    current.count += 1;
    this.cleanupIfNeeded(now);
    return undefined;
  }

  private cleanupIfNeeded(now: number) {
    this.checksSinceCleanup += 1;
    if (this.checksSinceCleanup < 256 && this.buckets.size < 10_000) return;
    this.checksSinceCleanup = 0;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
    while (this.buckets.size >= 10_000) {
      const oldestKey = this.buckets.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.buckets.delete(oldestKey);
    }
  }

  private assertAllowedOrigin(request: Request) {
    const origin = request.get('origin');
    if (!origin) return;
    const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5000')
      .split(',')
      .map((value) => value.trim().replace(/^['"]|['"]$/g, ''));
    if (!allowedOrigins.includes('http://localhost:5000')) {
      allowedOrigins.push('http://localhost:5000');
    }
    if (!allowedOrigins.includes(origin)) throw new ForbiddenException('Origine non autorisée');
  }
}
