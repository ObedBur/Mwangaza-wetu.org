import { LoginAttemptsCleanupService } from './login-attempts-cleanup.service';

describe('LoginAttemptsCleanupService', () => {
  const prisma = {
    loginAttempt: { deleteMany: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('supprime les tentatives plus vieilles de 24 h', async () => {
    prisma.loginAttempt.deleteMany.mockResolvedValue({ count: 4 });
    const service = new LoginAttemptsCleanupService(prisma as never);
    const now = new Date('2026-11-18T12:00:00.000Z');

    const count = await service.purge(now);

    expect(count).toBe(4);
    const call = prisma.loginAttempt.deleteMany.mock.calls[0] as [
      { where: { updatedAt: { lt: Date } } },
    ];
    expect(call[0].where.updatedAt.lt.toISOString()).toBe(
      '2026-11-17T12:00:00.000Z',
    );
  });

  it('ne fait pas tomber le processus si la purge échoue', async () => {
    prisma.loginAttempt.deleteMany.mockRejectedValue(new Error('base absente'));
    const service = new LoginAttemptsCleanupService(prisma as never);

    await expect(service.purge()).resolves.toBe(0);
  });

  it('planifie une purge horaire non bloquante pour l’arrêt', () => {
    const service = new LoginAttemptsCleanupService(prisma as never);
    expect(() => service.onModuleInit()).not.toThrow();
    expect(() => service.onModuleDestroy()).not.toThrow();
  });
});
