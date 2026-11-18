import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ADMIN_ROLES,
  Roles,
  SUPERADMIN_ROLES,
} from '../common/decorators/roles.decorator';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { ChangeAgentPasswordDto } from './dto/change-agent-password.dto';
import type { AuthenticatedRequest } from '../common/types/auth-request';
import { AuthService } from '../auth/auth.service';
import { PasswordChangeThrottleGuard } from '../auth/password-change-throttle.guard';

@Roles(...ADMIN_ROLES)
@Controller('api/agents')
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  findAll(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '10',
    @Query('search') search?: string,
  ) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 10));
    return this.agentsService.findAll(p, ps, search || undefined);
  }

  @Get('check-userid/:userId')
  checkUserId(@Param('userId') userId: string) {
    return this.agentsService.checkUserId(userId);
  }

  /**
   * Alias historique du changement de mot de passe agent.
   *
   * La logique vit dans `AuthService.changeOwnPassword` : cet endpoint ne
   * sert plus que les agents et ne duplique aucune règle. Il est conservé
   * pour ne pas casser les clients déjà déployés qui l'appellent.
   */
  @Roles('agent')
  @UseGuards(PasswordChangeThrottleGuard)
  @Post('me/change-password')
  changeOwnPassword(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangeAgentPasswordDto,
  ) {
    return this.authService.changeOwnPassword(
      req.user!,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.agentsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateAgentDto) {
    return this.agentsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAgentDto) {
    return this.agentsService.update(id, dto);
  }

  @Roles(...SUPERADMIN_ROLES)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.agentsService.remove(id);
  }
}
