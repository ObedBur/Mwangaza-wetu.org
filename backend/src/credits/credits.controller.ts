import { ADMIN_ROLES, Roles } from '../common/decorators/roles.decorator';
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Query,
  Req,
} from '@nestjs/common';
import { CreditsService } from './credits.service';
import { CreateCreditDto } from './dto/create-credit.dto';
import type { AuthenticatedRequest } from '../common/types/auth-request';
import { assertOwnAccountOrAdmin } from '../common/utils/ownership';

@Roles(...ADMIN_ROLES)
@Controller('api/credits')
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  @Get('stats')
  async getStats() {
    return this.creditsService.getStats();
  }

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize) : 10;

    return this.creditsService.findAllPaginated(pageNum, pageSizeNum);
  }

  @Get('soldes')
  async getSoldes() {
    return this.creditsService.getSoldes();
  }

  @Get('echeances')
  async getUpcomingDueDates(
    @Query('limit') limit?: string,
    @Query('days') days?: string,
  ) {
    const parsedLimit = Math.min(20, Math.max(1, Number(limit) || 5));
    const parsedDays = Math.min(365, Math.max(1, Number(days) || 30));
    return this.creditsService.getUpcomingDueDates(parsedLimit, parsedDays);
  }

  // Guichet (agent) et membre : crédits d'un seul compte (ownership ci-dessous)
  @Roles(...ADMIN_ROLES, 'agent', 'member')
  @Get('membre/:numero')
  async findByMembre(
    @Param('numero') numero: string,
    @Req() req: AuthenticatedRequest,
  ) {
    assertOwnAccountOrAdmin(req, numero);
    return this.creditsService.findByMembre(numero);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.creditsService.findOne(id);
  }

  @Post()
  async create(@Body() createDto: CreateCreditDto) {
    return this.creditsService.create(createDto);
  }
}
