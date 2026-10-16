import { Module } from '@nestjs/common';
import { SavingsService } from './savings.service';
import { SavingsController } from './savings.controller';
import { ParametresModule } from '../parametres/parametres.module';

@Module({
  imports: [ParametresModule],
  providers: [SavingsService],
  controllers: [SavingsController],
})
export class SavingsModule {}
