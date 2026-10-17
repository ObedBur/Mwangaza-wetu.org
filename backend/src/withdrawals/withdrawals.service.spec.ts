import { BadRequestException, ForbiddenException } from '@nestjs/common';
import 'reflect-metadata';
import { ADMIN_ROLES, ROLES_KEY } from '../common/decorators/roles.decorator';
import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalsService } from './withdrawals.service';

describe('WithdrawalsModule production rules', () => {
  const params = {
    montant_min_retrait_fc: 1000,
    montant_min_retrait_usd: 1,
    montant_max_par_retrait_fc: 500000,
    montant_max_par_retrait_usd: 500,
    solde_min_fc: 10000,
    solde_min_usd: 5,
    limite_retrait_jour_fc: 50000000,
    limite_retrait_jour_usd: 500,
    retraits: {
      frais_retrait: {
        FC: [{ max: 500000, taux: 0.02 }],
        USD: [
          { max: 50, taux: 0.03 },
          { max: 500, taux: 0.02 },
        ],
      },
    },
  };

  function createService(overrides: Record<string, unknown> = {}) {
    const prisma = {
      retrait: { aggregate: jest.fn().mockResolvedValue({ _sum: { montant: 0 } }) },
      ...overrides,
    } as any;
    const parameterService = {
      getGeneralParameters: jest.fn().mockResolvedValue(params),
    } as any;
    const balancesService = {
      getSoldeDisponibleMembre: jest.fn().mockResolvedValue({
        usd: { soldeBrut: 120, soldeDisponible: 120, garantieGelee: 0 },
        fc: { soldeBrut: 100000, soldeDisponible: 100000, garantieGelee: 0 },
      }),
    } as any;
    const zktecoService = { captureFingerprint: jest.fn() } as any;
    return {
      service: new WithdrawalsService(
        prisma,
        parameterService,
        balancesService,
        zktecoService,
      ),
      prisma,
      zktecoService,
    };
  }

  it('includes fees when checking the member minimum balance', async () => {
    const { service } = createService();

    await expect(
      service.verifyLimites('MW-P-100', 113, 'USD'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks a withdrawal that crosses the daily limit', async () => {
    const { service, prisma } = createService();
    prisma.retrait.aggregate.mockResolvedValue({ _sum: { montant: 499 } });

    await expect(
      service.verifyLimites('MW-P-100', 2, 'USD'),
    ).rejects.toThrow(/Limite de retrait quotidienne/);
  });

  it('rejects an invalid or non-positive amount before querying balances', async () => {
    const { service } = createService();

    await expect(
      service.verifyLimites('MW-P-100', Number.NaN, 'USD'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not let an administrator execute a teller withdrawal', async () => {
    const { service, prisma, zktecoService } = createService({
      retrait: { findUnique: jest.fn() },
    });

    await expect(
      service.create(
        {
          compte: 'MW-P-100',
          devise: 'USD',
          montant: 10,
          idempotencyKey: '00000000-0000-4000-8000-000000000001',
        } as any,
        { userId: 2, role: 'admin' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.retrait.findUnique).not.toHaveBeenCalled();
    expect(zktecoService.captureFingerprint).not.toHaveBeenCalled();
  });

  it('returns an agent-owned idempotent replay without requesting a second biometric scan', async () => {
    const existing = {
      id: 7,
      executeParId: 12,
      compte: 'MW-P-100',
      devise: 'USD',
      montant: 10,
      description: 'Retrait au guichet',
      membre: { nomComplet: 'Membre Test' },
    };
    const { service, prisma, zktecoService } = createService({
      retrait: { findUnique: jest.fn().mockResolvedValue(existing) },
    });

    await expect(
      service.create(
        {
          compte: 'MW-P-100',
          devise: 'USD',
          montant: 10,
          idempotencyKey: '00000000-0000-4000-8000-000000000001',
        } as any,
        { userId: 12, role: 'agent' },
      ),
    ).resolves.toBe(existing);
    expect(zktecoService.captureFingerprint).not.toHaveBeenCalled();
  });

  it('rejects an idempotency key reused for a different withdrawal', async () => {
    const existing = {
      id: 7,
      executeParId: 12,
      compte: 'MW-P-100',
      devise: 'USD',
      montant: 20,
      description: 'Retrait au guichet',
      membre: { nomComplet: 'Membre Test' },
    };
    const { service } = createService({
      retrait: { findUnique: jest.fn().mockResolvedValue(existing) },
    });

    await expect(
      service.create(
        {
          compte: 'MW-P-100',
          devise: 'USD',
          montant: 10,
          idempotencyKey: '00000000-0000-4000-8000-000000000001',
        } as any,
        { userId: 12, role: 'agent' },
      ),
    ).rejects.toThrow(/utilisée pour un autre retrait/);
  });

  it('requires the live ZKTeco user to be the account holder or an authorized delegate', async () => {
    const { service, prisma, zktecoService } = createService({
      retrait: { findUnique: jest.fn().mockResolvedValue(null) },
      membre: {
        findUnique: jest.fn().mockResolvedValue({
          numeroCompte: 'MW-P-100',
          nomComplet: 'Membre Test',
          typeCompte: 'PRINCIPAL',
          statut: 'actif',
          userId: 'member-zk-id',
          delegues: [{ userId: 'delegate-zk-id' }],
        }),
      },
    });
    zktecoService.captureFingerprint.mockResolvedValue('unrelated-zk-id');

    await expect(
      service.create(
        {
          compte: 'MW-P-100',
          devise: 'USD',
          montant: 10,
          idempotencyKey: '00000000-0000-4000-8000-000000000001',
        } as any,
        { userId: 12, role: 'agent' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).toBeUndefined();
  });

  it('runs the balance and cash debit under member and cashbox row locks', async () => {
    const record = {
      id: 9,
      reference: 'R-9',
      dateOperation: new Date(),
      compte: 'MW-P-100',
      membre: { nomComplet: 'Membre Test' },
      montant: 10,
      devise: 'USD',
      description: 'Retrait au guichet',
      statut: 'COMPLETED',
      frais: 0.2,
      soldeAvant: 120,
      soldeApres: 109.8,
      executeParId: 12,
      executeParRole: 'agent',
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      membre: {
        findUnique: jest.fn().mockResolvedValue({
          typeCompte: 'PRINCIPAL',
          statut: 'actif',
          userId: 'member-zk-id',
          delegues: [],
        }),
      },
      retrait: {
        findUnique: jest.fn().mockResolvedValue(null),
        aggregate: jest.fn().mockResolvedValue({ _sum: { montant: 0 } }),
        create: jest.fn().mockResolvedValue(record),
      },
      caisseAgent: {
        findUnique: jest.fn().mockResolvedValue({ id: 3, solde: 100 }),
        update: jest.fn(),
      },
      revenuType: { findFirst: jest.fn().mockResolvedValue({ id: 1 }) },
      epargne: { create: jest.fn() },
      revenu: { create: jest.fn() },
      mouvementCaisseAgent: { create: jest.fn() },
      adminLog: { create: jest.fn() },
    };
    const { service, prisma, zktecoService } = createService({
      retrait: {
        findUnique: jest.fn().mockResolvedValue(null),
        aggregate: jest.fn().mockResolvedValue({ _sum: { montant: 0 } }),
      },
      membre: {
        findUnique: jest.fn().mockResolvedValue({
          id: 42,
          numeroCompte: 'MW-P-100',
          nomComplet: 'Membre Test',
          typeCompte: 'PRINCIPAL',
          statut: 'actif',
          userId: 'member-zk-id',
          delegues: [],
        }),
      },
      caisseAgent: { findUnique: jest.fn() },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    });
    zktecoService.captureFingerprint.mockResolvedValue('member-zk-id');

    await expect(
      service.create(
        {
          compte: 'MW-P-100',
          devise: 'USD',
          montant: 10,
          idempotencyKey: '00000000-0000-4000-8000-000000000009',
        } as any,
        { userId: 12, role: 'agent' },
      ),
    ).resolves.toBe(record);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(3);
    expect(tx.caisseAgent.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { solde: { decrement: 10 } },
    });
    expect(tx.mouvementCaisseAgent.create).toHaveBeenCalled();
  });

  it('does not allow an already cancelled withdrawal to be cancelled again', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      retrait: {
        findUnique: jest.fn().mockResolvedValue({
          id: 4,
          statut: 'CANCELLED',
          mouvementsCaisse: [],
        }),
      },
    };
    const { service } = createService({
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    });

    await expect(
      service.cancel(4, { motif: 'Correction', cashRecupere: true }, { userId: 1, role: 'admin' }),
    ).rejects.toThrow(/Seul un retrait payé/);
  });

  it('requires a positive confirmation that cash was returned before cancellation', async () => {
    const { service, prisma } = createService({
      $transaction: jest.fn(),
    });
    await expect(
      service.cancel(4, { motif: 'Erreur de saisie', cashRecupere: false }, { userId: 1, role: 'admin' }),
    ).rejects.toThrow(/physiquement rendu/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('restricts creation to agents and cancellation to administrators', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, WithdrawalsController.prototype.create),
    ).toEqual(['agent']);
    expect(
      Reflect.getMetadata(ROLES_KEY, WithdrawalsController.prototype.cancel),
    ).toEqual([...ADMIN_ROLES]);
  });
});
