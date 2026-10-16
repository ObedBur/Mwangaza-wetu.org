import { ADMIN_ROLES, Roles } from '../common/decorators/roles.decorator';
import { Controller, Get, Param } from '@nestjs/common';
import { MembersService } from './members.service';

@Roles(...ADMIN_ROLES)
@Controller('api/delegues')
export class DeleguesController {
  constructor(private readonly membersService: MembersService) {}

  @Get('by-userid/:userId')
  async findByUserId(@Param('userId') userId: string) {
    return this.membersService.findDelegueByUserId(userId);
  }
}
