import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, notifications } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  // Mocks Prisma typés (args/retours réels du client généré).
  const prisma = {
    notifications: {
      findMany: jest.fn<
        Promise<notifications[]>,
        [Prisma.notificationsFindManyArgs]
      >(),
      findFirst: jest.fn<
        Promise<notifications | null>,
        [Prisma.notificationsFindFirstArgs]
      >(),
      findUnique: jest.fn<
        Promise<notifications | null>,
        [Prisma.notificationsFindUniqueArgs]
      >(),
      count: jest.fn<Promise<number>, [Prisma.notificationsCountArgs]>(),
      create: jest.fn<
        Promise<notifications>,
        [Prisma.notificationsCreateArgs]
      >(),
      update: jest.fn<
        Promise<notifications>,
        [Prisma.notificationsUpdateArgs]
      >(),
      updateMany: jest.fn<
        Promise<{ count: number }>,
        [Prisma.notificationsUpdateManyArgs]
      >(),
      delete: jest.fn<
        Promise<notifications>,
        [Prisma.notificationsDeleteArgs]
      >(),
    },
    membre: {
      findUnique: jest.fn<
        Promise<{ id: number } | null>,
        [Prisma.MembreFindUniqueArgs]
      >(),
    },
    agent: {
      findUnique: jest.fn<
        Promise<{ id: number } | null>,
        [Prisma.AgentFindUniqueArgs]
      >(),
    },
  };

  const notificationRecord: notifications = {
    id: 7,
    membre_id: 42,
    admin_id: 1,
    agent_id: null,
    titre: 'Assemblée générale',
    message: 'Rendez-vous le 15 novembre.',
    type: 'assemblée',
    is_read: false,
    created_at: new Date('2026-10-02T10:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findForUser (membre)', () => {
    it('inclut les diffusions générales et sérialise en camelCase', async () => {
      prisma.notifications.findMany.mockResolvedValue([notificationRecord]);
      // 1er count = total, 2e count = non-lues
      prisma.notifications.count
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(1);

      const result = await service.findForUser(42, 'member', {
        page: 1,
        pageSize: 10,
      });

      // Périmètre membre : ses notifications + diffusions (les deux NULL)
      const { where } = prisma.notifications.findMany.mock.calls[0][0];
      expect(where?.OR).toEqual([
        { membre_id: 42 },
        { membre_id: null, agent_id: null },
      ]);

      expect(result.total).toBe(3);
      expect(result.nonLues).toBe(1);
      expect(result.data).toEqual([
        {
          id: 7,
          titre: 'Assemblée générale',
          message: 'Rendez-vous le 15 novembre.',
          type: 'assemblée',
          isRead: false,
          createdAt: notificationRecord.created_at,
          membreId: 42,
          agentId: null,
        },
      ]);
    });

    it('n inclut que les non-lues quand nonLuesOnly est demandé', async () => {
      prisma.notifications.findMany.mockResolvedValue([]);
      prisma.notifications.count.mockResolvedValue(0);

      await service.findForUser(42, 'member', { nonLuesOnly: true });

      const { where } = prisma.notifications.findMany.mock.calls[0][0];
      expect(where?.is_read).toBe(false);
    });

    it('ne voit PAS les notifications ciblant un agent', async () => {
      prisma.notifications.findMany.mockResolvedValue([]);
      prisma.notifications.count.mockResolvedValue(0);

      await service.findForUser(42, 'member');

      const { where } = prisma.notifications.findMany.mock.calls[0][0];
      // Aucune clause ne correspond à une cible agent chiffrée : les
      // notifications d'agent ne peuvent jamais entrer dans le périmètre membre.
      const clauses = where?.OR ?? [];
      expect(
        clauses.some((clause) => typeof clause.agent_id === 'number'),
      ).toBe(false);
    });
  });

  describe('findForUser (agent)', () => {
    it('voit ses notifications ciblées ET les diffusions générales', async () => {
      prisma.notifications.findMany.mockResolvedValue([
        { ...notificationRecord, membre_id: null, agent_id: 7 },
      ]);
      prisma.notifications.count.mockResolvedValue(2);

      const result = await service.findForUser(7, 'agent');

      const { where } = prisma.notifications.findMany.mock.calls[0][0];
      expect(where?.OR).toEqual([
        { agent_id: 7 },
        { membre_id: null, agent_id: null },
      ]);
      expect(result.data[0]?.agentId).toBe(7);
      expect(result.data[0]?.membreId).toBeNull();
    });

    it('ne voit PAS les notifications ciblant un membre', async () => {
      prisma.notifications.findMany.mockResolvedValue([]);
      prisma.notifications.count.mockResolvedValue(0);

      await service.findForUser(7, 'agent');

      const { where } = prisma.notifications.findMany.mock.calls[0][0];
      const clauses = where?.OR ?? [];
      expect(
        clauses.some((clause) => typeof clause.membre_id === 'number'),
      ).toBe(false);
    });
  });

  describe('countUnreadForUser', () => {
    it('compte les non-lues du périmètre agent', async () => {
      prisma.notifications.count.mockResolvedValue(4);

      await expect(service.countUnreadForUser(7, 'agent')).resolves.toEqual({
        count: 4,
      });

      const { where } = prisma.notifications.count.mock.calls[0][0];
      expect(where?.is_read).toBe(false);
      expect(where?.OR).toEqual([
        { agent_id: 7 },
        { membre_id: null, agent_id: null },
      ]);
    });
  });

  describe('markAsReadForUser', () => {
    it('marque comme lu une notification du membre', async () => {
      prisma.notifications.findFirst.mockResolvedValue(notificationRecord);
      prisma.notifications.update.mockResolvedValue({
        ...notificationRecord,
        is_read: true,
      });

      const result = await service.markAsReadForUser(42, 'member', 7);

      expect(result.isRead).toBe(true);
      expect(prisma.notifications.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { is_read: true },
      });
    });

    it("renvoie 404 à un agent qui lit la notification d'un membre", async () => {
      // findFirst filtre sur le périmètre agent => rien ne remonte
      prisma.notifications.findFirst.mockResolvedValue(null);

      await expect(service.markAsReadForUser(7, 'agent', 404)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.notifications.findFirst.mock.calls[0][0].where?.OR).toEqual(
        [{ agent_id: 7 }, { membre_id: null, agent_id: null }],
      );
    });

    it('est idempotent sur une notification déjà lue', async () => {
      prisma.notifications.findFirst.mockResolvedValue({
        ...notificationRecord,
        is_read: true,
      });

      await service.markAsReadForUser(42, 'member', 7);

      expect(prisma.notifications.update).not.toHaveBeenCalled();
    });
  });

  describe('markAllAsReadForUser', () => {
    it("marque toutes les non-lues de l'agent comme lues", async () => {
      prisma.notifications.updateMany.mockResolvedValue({ count: 5 });

      await expect(service.markAllAsReadForUser(7, 'agent')).resolves.toEqual({
        updated: 5,
      });

      const args = prisma.notifications.updateMany.mock.calls[0][0];
      expect(args.where?.is_read).toBe(false);
      expect(args.data).toEqual({ is_read: true });
    });
  });

  describe('create', () => {
    it('crée une diffusion générale quand aucune cible (annonce)', async () => {
      prisma.notifications.create.mockResolvedValue({
        ...notificationRecord,
        membre_id: null,
      });

      const result = await service.create(
        { titre: 'Assemblée', message: 'Convocation', type: 'assemblée' },
        1,
      );

      expect(prisma.membre.findUnique).not.toHaveBeenCalled();
      expect(prisma.agent.findUnique).not.toHaveBeenCalled();
      expect(prisma.notifications.create).toHaveBeenCalledWith({
        data: {
          titre: 'Assemblée',
          message: 'Convocation',
          type: 'assemblée',
          membre_id: null,
          agent_id: null,
          admin_id: 1,
        },
      });
      expect(result.membreId).toBeNull();
      expect(result.agentId).toBeNull();
    });

    it('vérifie que le membre ciblé existe', async () => {
      prisma.membre.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ membreId: 42, titre: 'Info', message: 'Message' }, 1),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.notifications.create).not.toHaveBeenCalled();
    });

    it('cible un agent de guichet (et vérifie son existence)', async () => {
      prisma.agent.findUnique.mockResolvedValue({ id: 7 });
      prisma.notifications.create.mockResolvedValue({
        ...notificationRecord,
        membre_id: null,
        agent_id: 7,
      });

      const result = await service.create(
        { agentId: 7, titre: 'Guichet', message: 'Caisse à approvisionner' },
        1,
      );

      expect(prisma.agent.findUnique).toHaveBeenCalledWith({
        where: { id: 7 },
        select: { id: true },
      });
      const { data } = prisma.notifications.create.mock.calls[0][0];
      expect(data.agent_id).toBe(7);
      expect(data.membre_id).toBeNull();
      expect(result.agentId).toBe(7);
    });

    it("renvoie 404 si l'agent ciblé nexiste pas", async () => {
      prisma.agent.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ agentId: 999, titre: 'Info', message: 'X' }, 1),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.notifications.create).not.toHaveBeenCalled();
    });

    it('refuse la cible ambiguë membreId + agentId', async () => {
      await expect(
        service.create(
          { membreId: 42, agentId: 7, titre: 'Info', message: 'X' },
          1,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.notifications.create).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('supprime une notification existante', async () => {
      prisma.notifications.findUnique.mockResolvedValue({
        ...notificationRecord,
        id: 7,
      });
      prisma.notifications.delete.mockResolvedValue(notificationRecord);

      await expect(service.remove(7)).resolves.toEqual({
        deleted: true,
        id: 7,
      });
    });

    it("renvoie 404 si la notification n'existe pas", async () => {
      prisma.notifications.findUnique.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
