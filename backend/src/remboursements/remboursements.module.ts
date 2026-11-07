import { Module, forwardRef } from '@nestjs/common';
import { RemboursementsService } from './remboursements.service';
import { RemboursementsController } from './remboursements.controller';
import { CreditsModule } from '../credits/credits.module';
import { BalancesModule } from '../balances/balances.module';
import { ComptabiliteModule } from '../comptabilite/comptabilite.module';

@Module({
  imports: [forwardRef(() => CreditsModule), BalancesModule, ComptabiliteModule],
  providers: [RemboursementsService],
  controllers: [RemboursementsController],
  exports: [RemboursementsService],
})
export class RemboursementsModule {}
