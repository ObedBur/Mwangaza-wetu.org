import { createHash } from 'node:crypto';
import { LoginThrottleGuard } from './login-throttle.guard';

describe('LoginThrottleGuard — reset après succès', () => {
  function makeGuard() {
    const prisma = {
      loginAttempt: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn((operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
    };
    return { prisma, guard: new LoginThrottleGuard(prisma as never) };
  }

  it('ne supprime que le bucket de l’identifiant connecté', async () => {
    const { prisma, guard } = makeGuard();
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
    expect(prisma.loginAttempt.deleteMany).toHaveBeenCalledWith({
      where: {
        ip: '203.0.113.9',
        identifier: expectedIdentifier,
      },
    });
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
