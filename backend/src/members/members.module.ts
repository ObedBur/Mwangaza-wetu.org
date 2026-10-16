import { Module } from '@nestjs/common';
import { MembersService } from './members.service';
import { MembersController } from './members.controller';
import { DeleguesController } from './delegues.controller';
import { MemberMailService } from './member-mail.service';
import { CloudinaryService } from './cloudinary.service';

@Module({
  providers: [MembersService, MemberMailService, CloudinaryService],
  controllers: [MembersController, DeleguesController],
  exports: [CloudinaryService],
})
export class MembersModule {}
