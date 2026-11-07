import { BadRequestException } from '@nestjs/common';
import { SavingsService } from './savings.service';

describe('SavingsService deposits', () => {
  const member = {
    id: 12,
    numeroCompte: 'MW-PRI-001',
    typeCompte: 'PRINCIPAL',
    statut: 'actif',
    userId: null,
    delegues: [],
  };
  const operation = { id: 45, compte: member.numeroCompte };

  function createService() {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      membre: { findUnique: jest.fn().mockResolvedValue(member) },
      epargne: { create: jest.fn().mockResolvedValue(operation) },
      adminLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      membre: { findUnique: jest.fn().mockResolvedValue(member) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
      notifications: { create: jest.fn().mockResolvedValue({}) },
    };
    const parametresService = {
      getGeneralParameters: jest.fn().mockResolvedValue({
        montant_min_depot_usd: 1,
        montant_min_depot_fc: 1000,
      }),
    };
    const zktecoService = { captureFingerprint: jest.fn() };
    const comptabiliteService = { enregistrerDepotEpargne: jest.fn().mockResolvedValue({}), enregistrerRetraitEpargne: jest.fn().mockResolvedValue({}), contrepasser: jest.fn().mockResolvedValue(null) };
    const service = new SavingsService(
      prisma as never,
      parametresService as never,
      zktecoService as never,
      comptabiliteService as never,
    );
    return { service, prisma, tx, parametresService, zktecoService, comptabiliteService };
  }

  it('allows an administrator to deposit using the required account number without a fingerprint', async () => {
    const { service, prisma, tx, zktecoService } = createService();

    await expect(
      service.create(
        {
          compte: member.numeroCompte,
          typeOperation: 'depot',
          devise: 'USD',
          montant: 10,
          dateOperation: '2026-11-06T15:00:00.000Z',
        },
        { userId: 7, role: 'admin' },
      ),
    ).resolves.toBe(operation);

    expect(prisma.membre.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { numeroCompte: member.numeroCompte } }),
    );
    expect(tx.epargne.create).toHaveBeenCalled();
    expect(tx.adminLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          details: expect.stringContaining(
            'dépôt enregistré sans vérification biométrique',
          ),
        }),
      }),
    );
    expect(zktecoService.captureFingerprint).not.toHaveBeenCalled();
  });

  it('rejects a supplied but expired or invalid fingerprint token', async () => {
    const { service, tx } = createService();

    await expect(
      service.create(
        {
          compte: member.numeroCompte,
          typeOperation: 'depot',
          devise: 'USD',
          montant: 10,
          dateOperation: '2026-11-06T15:00:00.000Z',
          biometricVerificationToken: 'invalid-token',
        },
        { userId: 7, role: 'admin' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.epargne.create).not.toHaveBeenCalled();
  });
});
