import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, notifications } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

/** Destinataire de la lecture : membre du portail ou agent de guichet. */
export type NotificationAudience = 'member' | 'agent';

export interface NotificationListOptions {
  page?: number;
  pageSize?: number;
  /** N'inclure que les notifications non lues. */
  nonLuesOnly?: boolean;
}

export interface AdminNotificationListOptions extends NotificationListOptions {
  membreId?: number;
  agentId?: number;
  type?: string;
}

/** Notification sérialisée pour l'API (les champs Prisma sont en snake_case). */
export interface NotificationResponse {
  id: number;
  titre: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: Date;
  /** null = notification non ciblée sur un membre précis. */
  membreId: number | null;
  /** null = notification non ciblée sur un agent précis. */
  agentId: number | null;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function toResponse(record: notifications): NotificationResponse {
  return {
    id: record.id,
    titre: record.titre,
    message: record.message,
    type: record.type,
    isRead: record.is_read,
    createdAt: record.created_at,
    membreId: record.membre_id,
    agentId: record.agent_id,
  };
}

function normalizePage(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value as number) >= 1
    ? Math.floor(value as number)
    : fallback;
}

function normalizePageSize(
  value: number | undefined,
  fallback: number,
): number {
  if (!Number.isFinite(value) || (value as number) < 1) {
    return fallback;
  }
  return Math.min(MAX_PAGE_SIZE, Math.floor(value as number));
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Périmètre de lecture selon l'appelant :
   *
   *  - membre : ses notifications ciblées + les diffusions générales ;
   *  - agent  : ses notifications ciblées  + les diffusions générales ;
   *  - diffusion générale = membre_id NULL ET agent_id NULL (visible par
   *    les deux publics), tandis qu'une notification ciblée n'appartient
   *    qu'à son destinataire.
   */
  private scopeFor(
    audience: NotificationAudience,
    userId: number,
  ): Prisma.notificationsWhereInput {
    const broadcast: Prisma.notificationsWhereInput = {
      membre_id: null,
      agent_id: null,
    };
    return audience === 'agent'
      ? { OR: [{ agent_id: userId }, broadcast] }
      : { OR: [{ membre_id: userId }, broadcast] };
  }

  /**
   * GET /api/notifications/moi — historique paginé des notifications du
   * destinataire (annonces diffusées incluses) + compteur de non-lues.
   */
  async findForUser(
    userId: number,
    audience: NotificationAudience,
    options: NotificationListOptions = {},
  ) {
    const page = normalizePage(options.page, 1);
    const pageSize = normalizePageSize(options.pageSize, DEFAULT_PAGE_SIZE);
    const scope = this.scopeFor(audience, userId);
    const where: Prisma.notificationsWhereInput = {
      ...scope,
      ...(options.nonLuesOnly ? { is_read: false } : {}),
    };

    const [data, total, nonLues] = await Promise.all([
      this.prisma.notifications.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notifications.count({ where }),
      this.prisma.notifications.count({
        where: { ...scope, is_read: false },
      }),
    ]);

    return {
      data: data.map(toResponse),
      total,
      page,
      pageSize,
      nonLues,
    };
  }

  /** GET /api/notifications/moi/non-lues — badge de la navigation. */
  async countUnreadForUser(userId: number, audience: NotificationAudience) {
    const count = await this.prisma.notifications.count({
      where: { ...this.scopeFor(audience, userId), is_read: false },
    });
    return { count };
  }

  /**
   * PATCH /api/notifications/moi/:id/lire — accusé de lecture.
   * Idempotent : marquer une notification déjà lue ne change rien.
   */
  async markAsReadForUser(
    userId: number,
    audience: NotificationAudience,
    id: number,
  ) {
    const notification = await this.prisma.notifications.findFirst({
      where: { id, ...this.scopeFor(audience, userId) },
    });
    if (!notification) {
      throw new NotFoundException('Notification introuvable');
    }
    if (notification.is_read) {
      return toResponse(notification);
    }
    const updated = await this.prisma.notifications.update({
      where: { id: notification.id },
      data: { is_read: true },
    });
    return toResponse(updated);
  }

  /** PATCH /api/notifications/moi/tout-lire — marque tout comme lu. */
  async markAllAsReadForUser(userId: number, audience: NotificationAudience) {
    const { count } = await this.prisma.notifications.updateMany({
      where: { ...this.scopeFor(audience, userId), is_read: false },
      data: { is_read: true },
    });
    return { updated: count };
  }

  /** GET /api/notifications — liste admin avec filtres (cible, type, lu). */
  async findAllForAdmin(options: AdminNotificationListOptions = {}) {
    const page = normalizePage(options.page, 1);
    const pageSize = normalizePageSize(options.pageSize, DEFAULT_PAGE_SIZE);
    const where: Prisma.notificationsWhereInput = {
      ...(options.membreId ? { membre_id: options.membreId } : {}),
      ...(options.agentId ? { agent_id: options.agentId } : {}),
      ...(options.type ? { type: options.type } : {}),
      ...(options.nonLuesOnly ? { is_read: false } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.notifications.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notifications.count({ where }),
    ]);

    return { data: data.map(toResponse), total, page, pageSize };
  }

  /**
   * POST /api/notifications — notification ciblée (membreId OU agentId)
   * ou diffusion générale (aucun des deux : annonce / assemblée).
   */
  async create(dto: CreateNotificationDto, adminId: number) {
    if (dto.membreId && dto.agentId) {
      throw new BadRequestException(
        'Cible ambiguë : renseignez membreId OU agentId, pas les deux',
      );
    }

    if (dto.membreId) {
      const member = await this.prisma.membre.findUnique({
        where: { id: dto.membreId },
        select: { id: true },
      });
      if (!member) {
        throw new NotFoundException('Membre introuvable');
      }
    }

    if (dto.agentId) {
      const agent = await this.prisma.agent.findUnique({
        where: { id: dto.agentId },
        select: { id: true },
      });
      if (!agent) {
        throw new NotFoundException('Agent introuvable');
      }
    }

    const created = await this.prisma.notifications.create({
      data: {
        titre: dto.titre,
        message: dto.message,
        type: dto.type ?? 'info',
        membre_id: dto.membreId ?? null,
        agent_id: dto.agentId ?? null,
        admin_id: adminId,
      },
    });
    return toResponse(created);
  }

  /** DELETE /api/notifications/:id — superadmin uniquement. */
  async remove(id: number) {
    const existing = await this.prisma.notifications.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Notification introuvable');
    }
    await this.prisma.notifications.delete({ where: { id } });
    return { deleted: true, id };
  }
}
