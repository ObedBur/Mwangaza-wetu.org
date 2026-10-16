import { Module } from '@nestjs/common';
import { DatController } from './dat.controller';
import { DatService } from './dat.service';
import { ParametresModule } from '../parametres/parametres.module';

@Module({
  imports: [ParametresModule],
  controllers: [DatController],
  providers: [DatService],
  exports: [DatService],
})
export class DatModule {}
