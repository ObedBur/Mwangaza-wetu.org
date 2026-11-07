import { Module } from '@nestjs/common';
import { SavingsService } from './savings.service';
import { SavingsController } from './savings.controller';
import { ParametresModule } from '../parametres/parametres.module';
import { ZktecoModule } from '../zkteco/zkteco.module';
import { ComptabiliteModule } from '../comptabilite/comptabilite.module';

@Module({
  imports: [ParametresModule, ZktecoModule, ComptabiliteModule],
  providers: [SavingsService],
  controllers: [SavingsController],
})
export class SavingsModule {}
