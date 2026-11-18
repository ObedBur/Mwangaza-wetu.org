import { AuthAuditService } from './auth-audit.service';

describe('AuthAuditService', () => {
  const prisma = {
    adminLog: { create: jest.fn() },
  };
  let service: AuthAuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.adminLog.create.mockResolvedValue({});
    service = new AuthAuditService(prisma as never);
  });

  it('journalise une connexion réussie sans donnée personnelle', async () => {
    await service.loginSucceeded('member', 12, {
      ip: '203.0.113.9',
      identifier: 'membre@example.org',
    });

    const call = prisma.adminLog.create.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(call[0].data.action).toBe('LOGIN_SUCCESS');
    expect(call[0].data.userId).toBe(12);
    expect(call[0].data.ipAddress).toBe('203.0.113.9');
    expect(String(call[0].data.details)).not.toContain('membre@example.org');
  });

  it('journalise un échec avec une empreinte, jamais l’identifiant brut', async () => {
    await service.loginFailed(null, null, {
      ip: '198.51.100.4',
      identifier: 'Inconnu@Example.org',
    });

    const call = prisma.adminLog.create.mock.calls[0] as [
      { data: { details: string; action: string; success: boolean } },
    ];
    expect(call[0].data.action).toBe('LOGIN_FAILED');
    expect(call[0].data.success).toBe(false);
    expect(call[0].data.details).not.toContain('Inconnu@Example.org');
    expect(call[0].data.details).toMatch(/identifiant [a-f0-9]{16}/);
  });

  it('ne casse pas l’authentification si le journal est indisponible', async () => {
    prisma.adminLog.create.mockRejectedValue(new Error('table absente'));

    await expect(
      service.loginSucceeded('agent', 3, { ip: '10.0.0.1' }),
    ).resolves.toBeUndefined();
  });

  it('ignore une déconnexion sans identité résolue', async () => {
    await service.logout(null, null, { ip: '10.0.0.1' });
    expect(prisma.adminLog.create).not.toHaveBeenCalled();
  });
});
