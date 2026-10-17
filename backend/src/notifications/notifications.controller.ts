import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ADMIN_ROLES,
  Roles,
  SUPERADMIN_ROLES,
} from '../common/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../common/types/auth-request';
import { CreateNotificationDto } from './dto/create-notification.dto';
import {
  NotificationAudience,
  NotificationsService,
} from './notifications.service';

/**
 * Identité de l'appelant (JWT) : id numérique + public de lecture
 * (member = portail membre, agent = guichet).
 */
function requireSelf(req: AuthenticatedRequest): {
  userId: number;
  audience: NotificationAudience;
} {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedException('Session invalide');
  }
  return {
    userId,
    audience: req.user?.role === 'agent' ? 'agent' : 'member',
  };
}

/** Query → entier positif sanitisé (undefined si absent ou invalide). */
function toPositiveInt(value?: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/** Drapeau booléen en query string (?nonLues=true|1). */
function toBooleanFlag(value?: string): boolean {
  return value === 'true' || value === '1';
}

/**
 * Notifications & annonces de la coopérative.
 *
 * Portail membre ET guichet agent — lecture seule + accusés de lecture :
 *   GET   /api/notifications/moi           — ses notifications + diffusions
 *   GET   /api/notifications/moi/non-lues  — compteur (badge de navigation)
 *   PATCH /api/notifications/moi/:id/lire  — accusé de lecture
 *   PATCH /api/notifications/moi/tout-lire — tout marquer comme lu
 *
 * Administration :
 *   GET    /api/notifications              — liste filtrée (membre/agent/type)
 *   POST   /api/notifications              — ciblée (membreId ou agentId)
 *                                            ou diffusion générale
 *   DELETE /api/notifications/:id          — superadmin uniquement
 */
@Roles(...ADMIN_ROLES)
@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // ---------- Membre & agent (lecture seule) ----------

  /** GET /api/notifications/moi — diffusions + notifications propres. */
  @Roles('member', 'agent')
  @Get('moi')
  async findMine(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('nonLues') nonLues?: string,
  ) {
    const { userId, audience } = requireSelf(req);
    return this.notificationsService.findForUser(userId, audience, {
      page: toPositiveInt(page),
      pageSize: toPositiveInt(pageSize),
      nonLuesOnly: toBooleanFlag(nonLues),
    });
  }

  /** GET /api/notifications/moi/non-lues — compteur des non-lues. */
  @Roles('member', 'agent')
  @Get('moi/non-lues')
  async countUnread(@Req() req: AuthenticatedRequest) {
    const { userId, audience } = requireSelf(req);
    return this.notificationsService.countUnreadForUser(userId, audience);
  }

  /**
   * PATCH /api/notifications/moi/tout-lire — marque toutes les
   * notifications du destinataire comme lues.
   */
  @Roles('member', 'agent')
  @Patch('moi/tout-lire')
  async markAllAsRead(@Req() req: AuthenticatedRequest) {
    const { userId, audience } = requireSelf(req);
    return this.notificationsService.markAllAsReadForUser(userId, audience);
  }

  /** PATCH /api/notifications/moi/:id/lire — accusé de lecture unitaire. */
  @Roles('member', 'agent')
  @Patch('moi/:id/lire')
  async markAsRead(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const { userId, audience } = requireSelf(req);
    return this.notificationsService.markAsReadForUser(userId, audience, id);
  }

  // ---------- Administration ----------

  /**
   * GET /api/notifications — liste admin.
   * Filtres : membreId, agentId, type, nonLues=true, page, pageSize.
   */
  @Get()
  async findAll(
    @Query('membreId') membreId?: string,
    @Query('agentId') agentId?: string,
    @Query('type') type?: string,
    @Query('nonLues') nonLues?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.notificationsService.findAllForAdmin({
      membreId: toPositiveInt(membreId),
      agentId: toPositiveInt(agentId),
      type: type || undefined,
      nonLuesOnly: toBooleanFlag(nonLues),
      page: toPositiveInt(page),
      pageSize: toPositiveInt(pageSize),
    });
  }

  /**
   * POST /api/notifications — créer une notification.
   * `membreId` => membre ciblé ; `agentId` => agent ciblé ;
   * aucun des deux => diffusion générale (annonce / assemblée).
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateNotificationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const adminId = req.user?.userId;
    if (!adminId) {
      throw new UnauthorizedException('Session administration invalide');
    }
    return this.notificationsService.create(dto, adminId);
  }

  /** DELETE /api/notifications/:id — superadmin uniquement. */
  @Roles(...SUPERADMIN_ROLES)
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.notificationsService.remove(id);
  }
}
