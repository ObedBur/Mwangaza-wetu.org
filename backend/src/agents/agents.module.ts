import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { MembersModule } from '../members/members.module';
import { ComptabiliteModule } from '../comptabilite/comptabilite.module';
import { AuthModule } from '../auth/auth.module';
import { PasswordChangeThrottleGuard } from '../auth/password-change-throttle.guard';

@Module({
  providers: [AgentsService, PasswordChangeThrottleGuard],
  imports: [MembersModule, ComptabiliteModule, AuthModule],
  controllers: [AgentsController],
  exports: [AgentsService],
})
export class AgentsModule {}
