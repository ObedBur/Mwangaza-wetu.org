import { Module } from '@nestjs/common';
import { WithdrawalsService } from './withdrawals.service';
import { WithdrawalsController } from './withdrawals.controller';
import { ParametresModule } from '../parametres/parametres.module';
import { BalancesModule } from '../balances/balances.module';
import { ZktecoModule } from '../zkteco/zkteco.module';

@Module({
  imports: [ParametresModule, BalancesModule, ZktecoModule],
  providers: [WithdrawalsService],
  controllers: [WithdrawalsController],
})
export class WithdrawalsModule {}
