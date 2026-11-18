import { RateLimitService } from './rate-limit.service';
import type { RedisClientType } from 'redis';

describe('RateLimitService', () => {
  it('limite les tentatives avec le compteur mémoire quand Redis est absent', async () => {
    const service = new RateLimitService(null);

    await expect(service.consume('k', 2, 60_000)).resolves.toBeUndefined();
    await expect(service.consume('k', 2, 60_000)).resolves.toBeUndefined();
    const retryAfter = await service.consume('k', 2, 60_000);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  it('reset supprime le compteur', async () => {
    const service = new RateLimitService(null);
    await service.consume('k', 1, 60_000);
    await service.consume('k', 1, 60_000);

    await service.reset('k');

    await expect(service.consume('k', 1, 60_000)).resolves.toBeUndefined();
  });

  it('decrement ne fait pas passer le compteur sous zéro', async () => {
    const service = new RateLimitService(null);
    await service.consume('k', 1, 60_000);

    await service.decrement('k');
    await service.decrement('k');

    // Le bucket est vide : la tentative suivante repart à 1 et passe.
    await expect(service.consume('k', 1, 60_000)).resolves.toBeUndefined();
  });

  it('utilise Redis quand il est prêt', async () => {
    const redis = {
      isReady: true,
      eval: jest.fn().mockResolvedValue([7, 30_000]),
    };
    const service = new RateLimitService(redis as unknown as RedisClientType);

    const retryAfter = await service.consume('k', 5, 60_000);

    expect(redis.eval).toHaveBeenCalledTimes(1);
    expect(retryAfter).toBe(30);
  });

  it('bascule sur la mémoire si Redis échoue', async () => {
    const redis = {
      isReady: true,
      eval: jest.fn().mockRejectedValue(new Error('connection lost')),
    };
    const service = new RateLimitService(redis as unknown as RedisClientType);

    await expect(service.consume('k', 1, 60_000)).resolves.toBeUndefined();
    await expect(service.consume('k', 1, 60_000)).resolves.toBeGreaterThan(0);
  });
});
