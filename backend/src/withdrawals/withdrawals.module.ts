import { Module } from '@nestjs/common';
import { WithdrawalsService } from './withdrawals.service';
import { WithdrawalsController } from './withdrawals.controller';
import { ParametresModule } from '../parametres/parametres.module';
import { BalancesModule } from '../balances/balances.module';

@Module({
  imports: [ParametresModule, BalancesModule],
  providers: [WithdrawalsService],
  controllers: [WithdrawalsController],
})
export class WithdrawalsModule {}
