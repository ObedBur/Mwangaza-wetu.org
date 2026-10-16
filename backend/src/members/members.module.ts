import { Module } from '@nestjs/common';
import { MembersService } from './members.service';
import { MembersController } from './members.controller';
import { DeleguesController } from './delegues.controller';
import { MemberMailService } from './member-mail.service';

@Module({
  providers: [MembersService, MemberMailService],
  controllers: [MembersController, DeleguesController],
})
export class MembersModule {}
