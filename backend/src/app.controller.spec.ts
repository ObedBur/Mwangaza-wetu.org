import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { RedisHealthService } from './redis/redis-health.service';

describe('AppController', () => {
  let appController: AppController;
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  };
  const redisHealth = {
    ping: jest.fn().mockResolvedValue(true),
    isConfigured: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    redisHealth.ping.mockResolvedValue(true);
    redisHealth.isConfigured.mockReturnValue(true);

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: { getHello: () => 'Hello World!' },
        },
        { provide: PrismaService, useValue: prisma },
        { provide: RedisHealthService, useValue: redisHealth },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('GET /api/health', () => {
    function response() {
      return { status: jest.fn() } as never;
    }

    it('renvoie ok quand la base et Redis répondent', async () => {
      await expect(appController.health(response())).resolves.toMatchObject({
        status: 'ok',
        checks: { database: 'up', redis: 'up' },
      });
    });

    it('renvoie degraded (200) quand Redis est indisponible', async () => {
      redisHealth.ping.mockResolvedValue(false);
      const res = response();

      await expect(appController.health(res)).resolves.toMatchObject({
        status: 'degraded',
        checks: { database: 'up', redis: 'down' },
      });
      expect((res as { status: jest.Mock }).status).not.toHaveBeenCalled();
    });

    it('renvoie 503 quand la base est injoignable', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('down'));
      const res = response();

      await expect(appController.health(res)).resolves.toMatchObject({
        status: 'error',
        checks: { database: 'down' },
      });
      expect((res as { status: jest.Mock }).status).toHaveBeenCalledWith(503);
    });

    it('ignore Redis quand il n’est pas configuré (développement)', async () => {
      redisHealth.isConfigured.mockReturnValue(false);
      redisHealth.ping.mockResolvedValue(false);

      await expect(appController.health(response())).resolves.toMatchObject({
        status: 'ok',
        checks: { redis: 'not_configured' },
      });
    });
  });
});
