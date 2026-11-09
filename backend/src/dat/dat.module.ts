import { Module } from '@nestjs/common';
import { DatController } from './dat.controller';
import { DatService } from './dat.service';
import { ParametresModule } from '../parametres/parametres.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ParametresModule, NotificationsModule],
  controllers: [DatController],
  providers: [DatService],
  exports: [DatService],
})
export class DatModule {}
