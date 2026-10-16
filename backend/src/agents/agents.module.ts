import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { MembersModule } from '../members/members.module';

@Module({
  providers: [AgentsService],
  imports: [MembersModule],
  controllers: [AgentsController],
  exports: [AgentsService],
})
export class AgentsModule {}
