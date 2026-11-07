import { Module } from '@nestjs/common';
import { CreditsService } from './credits.service';
import { CreditsController } from './credits.controller';
import { BalancesModule } from '../balances/balances.module';
import { ComptabiliteModule } from '../comptabilite/comptabilite.module';

@Module({
  imports: [BalancesModule, ComptabiliteModule],
  providers: [CreditsService],
  controllers: [CreditsController],
  exports: [CreditsService],
})
export class CreditsModule {}
