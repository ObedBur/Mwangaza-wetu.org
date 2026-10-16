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

@Roles(...ADMIN_ROLES)
@Controller('api/agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

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

  @Roles('agent')
  @Post('me/change-password')
  changeOwnPassword(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangeAgentPasswordDto,
  ) {
    return this.agentsService.changeOwnPassword(req.user!.userId!, dto);
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
