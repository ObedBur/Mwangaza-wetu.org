import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AppService } from './app.service';
import { Public } from './auth/jwt-auth.guard';
import { PrismaService } from './prisma/prisma.service';
import { RedisHealthService } from './redis/redis-health.service';

@Public()
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
    private readonly redisHealth: RedisHealthService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('api/public/stats')
  async getPublicStats() {
    return this.appService.getPublicStats();
  }

  /**
   * Sonde de santé pour le superviseur (Render, UptimeRobot…).
   *
   * - base de données injoignable → 503 : l'application ne peut pas servir ;
   * - Redis injoignable → 200 « degraded » : la limitation de débit et la
   *   révocation basculent sur leurs mécanismes locaux, le service reste
   *   disponible.
   */
  @Get('api/health')
  async health(@Res({ passthrough: true }) response: Response) {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.redisHealth.ping(),
    ]);
    const redisConfigured = this.redisHealth.isConfigured();

    const status = !database
      ? 'error'
      : redisConfigured && !redis
        ? 'degraded'
        : 'ok';

    if (!database) {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      checks: {
        database: database ? 'up' : 'down',
        redis: !redisConfigured ? 'not_configured' : redis ? 'up' : 'down',
      },
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
