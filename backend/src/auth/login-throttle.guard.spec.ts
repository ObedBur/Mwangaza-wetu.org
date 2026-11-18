import { createHash } from 'node:crypto';
import { LoginThrottleGuard } from './login-throttle.guard';
import type { RateLimitService } from '../redis/rate-limit.service';

describe('LoginThrottleGuard', () => {
  function makeGuard() {
    const rateLimit = {
      consume: jest.fn().mockResolvedValue(undefined),
      reset: jest.fn().mockResolvedValue(undefined),
      decrement: jest.fn().mockResolvedValue(undefined),
    };
    return {
      rateLimit,
      guard: new LoginThrottleGuard(rateLimit as unknown as RateLimitService),
    };
  }

  it('ne supprime que le bucket de l’identifiant connecté', async () => {
    const { rateLimit, guard } = makeGuard();
    const request = {
      ip: '203.0.113.9',
      socket: {},
      body: { email: 'Membre@Example.org' },
    };
    const expectedIdentifier = createHash('sha256')
      .update('membre@example.org')
      .digest('hex');

    await guard.resetAfterSuccessfulLogin(request as never);

    // Seul le couple (IP, identifiant) de la connexion réussie est supprimé :
    // les échecs visant d'autres comptes depuis la même IP restent comptés.
    expect(rateLimit.reset).toHaveBeenCalledWith(
      `login:id:203.0.113.9:${expectedIdentifier}`,
    );
    // Le quota global de l'IP ne perd que la tentative courante.
    expect(rateLimit.decrement).toHaveBeenCalledWith('login:ip:203.0.113.9');
  });

  it('applique les deux limites dans l’ordre IP puis IP+identifiant', async () => {
    const { rateLimit, guard } = makeGuard();
    const request = {
      ip: '198.51.100.4',
      gets: () => [],
      get: () => undefined,
      socket: {},
      body: { accountNumber: 'MW-001' },
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({ setHeader: jest.fn() }),
      }),
    };

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(rateLimit.consume).toHaveBeenNthCalledWith(
      1,
      'login:ip:198.51.100.4',
      50,
      15 * 60 * 1000,
    );
    expect(rateLimit.consume).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/^login:id:198\.51\.100\.4:/),
      6,
      15 * 60 * 1000,
    );
  });
});
