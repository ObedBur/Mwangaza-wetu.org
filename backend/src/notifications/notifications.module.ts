import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

/**
 * Notifications & annonces de la coopérative.
 * Exporté pour que d'autres modules (ex. remboursements) puissent
 * émettre une notification quand un événement concerne un membre.
 */
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
