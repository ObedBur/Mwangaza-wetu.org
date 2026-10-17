import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { SupportTicketStatus } from '@prisma/client';
import { ADMIN_ROLES, Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../common/types/auth-request';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { SupportService } from './support.service';

function pagination(page?: string, pageSize?: string) {
  const parsedPage = page === undefined ? 1 : Number(page);
  const parsedSize = pageSize === undefined ? 20 : Number(pageSize);
  if (!Number.isInteger(parsedPage) || parsedPage < 1 || !Number.isInteger(parsedSize) || parsedSize < 1 || parsedSize > 100) {
    throw new BadRequestException('Pagination invalide (page ≥ 1, pageSize entre 1 et 100)');
  }
  return { page: parsedPage, pageSize: parsedSize };
}

@Roles(...ADMIN_ROLES, 'agent')
@Controller('api/support/tickets')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Roles('member')
  @Post()
  create(@Body() dto: CreateTicketDto, @Req() req: AuthenticatedRequest) {
    return this.supportService.create(req.user!.userId!, dto);
  }

  @Roles('member')
  @Get('mine')
  findMine(@Req() req: AuthenticatedRequest, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    const paging = pagination(page, pageSize);
    return this.supportService.findMine(req.user!.userId!, paging.page, paging.pageSize);
  }

  @Get()
  findForStaff(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('statut') statut?: string,
  ) {
    const paging = pagination(page, pageSize);
    if (statut && !Object.values(SupportTicketStatus).includes(statut as SupportTicketStatus)) {
      throw new BadRequestException('Statut de demande invalide');
    }
    return this.supportService.findForStaff(paging.page, paging.pageSize, statut as SupportTicketStatus | undefined);
  }

  @Roles(...ADMIN_ROLES, 'agent', 'member')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: AuthenticatedRequest) {
    return this.supportService.findOne(id, req.user!);
  }

  @Roles(...ADMIN_ROLES, 'agent', 'member')
  @Post(':id/messages')
  addMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateTicketMessageDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.supportService.addMessage(id, dto, req.user!);
  }

  @Roles(...ADMIN_ROLES, 'agent')
  @Patch(':id/statut')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTicketStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.supportService.updateStatus(id, dto.statut, req.user!);
  }
}
