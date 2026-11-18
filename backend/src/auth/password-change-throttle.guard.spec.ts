import { HttpException, HttpStatus } from '@nestjs/common';
import { PasswordChangeThrottleGuard } from './password-change-throttle.guard';
import type { RateLimitService } from '../redis/rate-limit.service';

describe('PasswordChangeThrottleGuard', () => {
  function makeGuard(consume: jest.Mock) {
    const rateLimit = { consume };
    const guard = new PasswordChangeThrottleGuard(
      rateLimit as unknown as RateLimitService,
    );
    return guard;
  }

  function context(user: { userId?: number; role?: string } | undefined) {
    const response = { setHeader: jest.fn() };
    return {
      response,
      ctx: {
        switchToHttp: () => ({
          getRequest: () => ({ user }),
          getResponse: () => response,
        }),
      },
    };
  }

  it('compte par rôle et identifiant utilisateur', async () => {
    const consume = jest.fn().mockResolvedValue(undefined);
    const guard = makeGuard(consume);

    await expect(
      guard.canActivate(
        context({ userId: 42, role: 'agent' }).ctx as never,
      ),
    ).resolves.toBe(true);

    expect(consume).toHaveBeenCalledWith(
      'pwd-change:agent:42',
      5,
      15 * 60 * 1000,
    );
  });

  it('ne compte rien sans utilisateur (le garde JWT rejettera)', async () => {
    const consume = jest.fn();
    const guard = makeGuard(consume);

    await expect(
      guard.canActivate(context(undefined).ctx as never),
    ).resolves.toBe(true);
    expect(consume).not.toHaveBeenCalled();
  });

  it('renvoie 429 avec Retry-After au-delà de la limite', async () => {
    const guard = makeGuard(jest.fn().mockResolvedValue(120));
    const { ctx, response } = context({ userId: 7, role: 'member' });

    const error = await guard.canActivate(ctx as never).catch((e) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(
      HttpStatus.TOO_MANY_REQUESTS,
    );
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '120');
  });
});
