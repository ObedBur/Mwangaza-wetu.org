import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SupportTicketStatus } from '@prisma/client';
import type { AuthUser } from '../common/types/auth-request';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';

const ticketInclude = {
  messages: { orderBy: { createdAt: 'asc' as const } },
  membre: { select: { id: true, nomComplet: true, numeroCompte: true, email: true, telephone: true } },
};

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async create(memberId: number, dto: CreateTicketDto) {
    const sujet = dto.sujet.trim();
    const message = dto.message.trim();
    if (!sujet || !message) throw new BadRequestException('Sujet et message obligatoires');
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.create({
        data: {
          membreId: memberId,
          sujet,
          categorie: dto.categorie,
          messages: { create: { auteurId: memberId, auteurRole: 'member', message } },
        },
        include: ticketInclude,
      });
      await tx.adminLog.create({
        data: {
          action: 'SUPPORT_TICKET_CREATED',
          details: `Demande de support ${ticket.reference} créée par le membre #${memberId}.`,
          success: true,
          userId: memberId,
        },
      });
      return ticket;
    });
  }

  async findMine(memberId: number, page = 1, pageSize = 20) {
    const where: Prisma.SupportTicketWhereInput = { membreId: memberId };
    const [data, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where, include: ticketInclude, orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize, take: pageSize,
      }),
      this.prisma.supportTicket.count({ where }),
    ]);
    return { data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
  }

  async findForStaff(page = 1, pageSize = 20, statut?: SupportTicketStatus) {
    const where: Prisma.SupportTicketWhereInput = statut ? { statut } : {};
    const [data, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where, include: ticketInclude, orderBy: { updatedAt: 'asc' },
        skip: (page - 1) * pageSize, take: pageSize,
      }),
      this.prisma.supportTicket.count({ where }),
    ]);
    return { data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
  }

  async findOne(id: number, actor: AuthUser) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id }, include: ticketInclude });
    if (!ticket) throw new NotFoundException('Demande introuvable');
    if (actor.role === 'member' && ticket.membreId !== actor.userId) {
      throw new ForbiddenException('Vous ne pouvez consulter que vos demandes');
    }
    return ticket;
  }

  async addMessage(id: number, dto: { message: string }, actor: AuthUser) {
    const message = dto.message.trim();
    if (!message) throw new BadRequestException('Le message ne peut pas être vide');
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.findUnique({ where: { id } });
      if (!ticket) throw new NotFoundException('Demande introuvable');
      const isMember = actor.role === 'member';
      if (isMember && ticket.membreId !== actor.userId) {
        throw new ForbiddenException('Vous ne pouvez répondre qu’à vos propres demandes');
      }
      if (ticket.statut === SupportTicketStatus.FERME || ticket.statut === SupportTicketStatus.RESOLU) {
        throw new BadRequestException('Cette demande est terminée et ne peut plus recevoir de réponse');
      }
      await tx.supportTicketMessage.create({
        data: { ticketId: id, auteurId: actor.userId!, auteurRole: actor.role!, message },
      });
      const statut = isMember ? SupportTicketStatus.EN_COURS : SupportTicketStatus.ATTENTE_MEMBRE;
      await tx.supportTicket.update({ where: { id }, data: { statut } });
      if (!isMember) {
        await tx.notifications.create({
          data: {
            membre_id: ticket.membreId,
            titre: `Réponse à votre demande ${ticket.reference}`,
            message: `Un membre de l’équipe a répondu à votre demande « ${ticket.sujet} ». Consultez votre espace assistance.`,
            type: 'support',
          },
        });
      }
      await tx.adminLog.create({
        data: {
          action: 'SUPPORT_TICKET_MESSAGE_ADDED',
          details: `Réponse ajoutée à la demande ${ticket.reference} par ${actor.role} #${actor.userId}.`,
          success: true,
          userId: actor.userId ?? null,
        },
      });
      return tx.supportTicket.findUnique({ where: { id }, include: ticketInclude });
    });
  }

  async updateStatus(id: number, statut: SupportTicketStatus, actor: AuthUser) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Demande introuvable');
    if (ticket.statut === SupportTicketStatus.FERME && statut !== SupportTicketStatus.FERME) {
      throw new BadRequestException('Une demande fermée ne peut pas être rouverte');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.supportTicket.update({
        where: { id }, data: { statut }, include: ticketInclude,
      });
      await tx.adminLog.create({
        data: {
          action: 'SUPPORT_TICKET_STATUS_UPDATED',
          details: `Demande ${ticket.reference} passée au statut ${statut} par ${actor.role} #${actor.userId}.`,
          success: true,
          userId: actor.userId ?? null,
        },
      });
      return result;
    });
    return updated;
  }
}
