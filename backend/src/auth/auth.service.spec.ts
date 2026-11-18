import { AuthService } from './auth.service';

describe('AuthService — verrouillage de compte', () => {
  let prisma: {
    $executeRawUnsafe: jest.Mock;
    $queryRawUnsafe: jest.Mock;
    adminLog: { create: jest.Mock };
    membre: { update: jest.Mock };
    agent: { update: jest.Mock };
    administrateur: { update: jest.Mock };
  };
  let service: AuthService;

  const audit = {
    loginSucceeded: jest.fn(),
    loginFailed: jest.fn(),
    accountLocked: jest.fn(),
    logout: jest.fn(),
  };

  const registerFailure = (role: 'member' | 'agent' | 'admin', id = 7) =>
    (
      service as unknown as {
        registerLoginFailure: (role: string, id: number) => Promise<boolean>;
      }
    ).registerLoginFailure(role, id);

  beforeEach(() => {
    prisma = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      $queryRawUnsafe: jest.fn(),
      adminLog: { create: jest.fn().mockResolvedValue({}) },
      membre: { update: jest.fn() },
      agent: { update: jest.fn() },
      administrateur: { update: jest.fn() },
    };
    jest.clearAllMocks();
    service = new AuthService(
      prisma as never,
      {} as never,
      {} as never,
      audit as never,
    );
  });

  it('remet le compteur à zéro hors fenêtre puis incrémente', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([{ login_failures: 1 }]);

    const locked = await registerFailure('member');

    expect(locked).toBe(false);

    // Deux remises à zéro conditionnelles (verrou expiré + hors fenêtre),
    // puis aucun verrouillage sous le seuil.
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(2);
    expect(prisma.$executeRawUnsafe).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('"login_failures_since" < $3'),
      7,
      expect.any(Date),
      expect.any(Date),
    );
    expect(prisma.$queryRawUnsafe).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('"login_failures" + 1'),
      7,
    );
  });

  it('verrouille le compte au dixième échec et remet le compteur à zéro', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([{ login_failures: 10 }]);

    const locked = await registerFailure('admin');

    expect(locked).toBe(true);

    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(3);
    expect(prisma.$executeRawUnsafe).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('"locked_until" = $2'),
      7,
      expect.any(Date),
    );
    expect(prisma.$executeRawUnsafe).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('"login_failures" = 0'),
      7,
      expect.any(Date),
    );
  });

  it('utilise la table de la super-administration pour les deux rôles admin', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([{ login_failures: 1 }]);

    await registerFailure('admin', 1);
    await registerFailure('admin', 2);

    expect(prisma.$executeRawUnsafe).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('UPDATE "administrateurs"'),
      1,
      expect.any(Date),
    );
  });

  it('déverrouille un compte et journalise l’action', async () => {
    prisma.$executeRawUnsafe.mockResolvedValue(1);

    await service.unlockAccount('member', 3);

    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('"locked_until" = NULL'),
      3,
    );
    const auditCall = prisma.adminLog.create.mock.calls[0] as [
      { data: { action: string; userId: number } },
    ];
    expect(auditCall[0].data.action).toBe('ACCOUNT_UNLOCKED');
    expect(auditCall[0].data.userId).toBe(3);
  });

  it('refuse de déverrouiller un compte inexistant', async () => {
    prisma.$executeRawUnsafe.mockResolvedValue(0);

    await expect(service.unlockAccount('agent', 999)).rejects.toThrow(
      'Compte introuvable',
    );
    expect(prisma.adminLog.create).not.toHaveBeenCalled();
  });
});
