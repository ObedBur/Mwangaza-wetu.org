import { Module } from '@nestjs/common';
import { SavingsService } from './savings.service';
import { SavingsController } from './savings.controller';
import { ParametresModule } from '../parametres/parametres.module';
import { ZktecoModule } from '../zkteco/zkteco.module';

@Module({
  imports: [ParametresModule, ZktecoModule],
  providers: [SavingsService],
  controllers: [SavingsController],
})
export class SavingsModule {}
