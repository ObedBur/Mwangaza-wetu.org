import { Module } from '@nestjs/common';
import { ParametresService } from './parametres.service';
import { ParametresController } from './parametres.controller';

@Module({
  providers: [ParametresService],
  controllers: [ParametresController],
  exports: [ParametresService],
})
export class ParametresModule {}
