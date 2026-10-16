import {
  ADMIN_ROLES,
  Roles,
  SUPERADMIN_ROLES,
} from '../common/decorators/roles.decorator';
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { SavingsService } from './savings.service';
import { CreateSavingsDto, TypeOperation } from './dto/create-savings.dto';
import type { AuthenticatedRequest } from '../common/types/auth-request';
import { assertOwnAccountOrAdmin } from '../common/utils/ownership';

@Roles(...ADMIN_ROLES)
@Controller('api/epargnes')
export class SavingsController {
  constructor(private readonly savingsService: SavingsService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('type') type?: TypeOperation,
  ) {
    return this.savingsService.findAll({
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 10,
      type,
    });
  }

  @Get('depots')
  async getDepots(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.savingsService.findAll({
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 10,
      type: TypeOperation.depot,
    });
  }

  @Get('retraits')
  async getRetraits(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.savingsService.findAll({
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 10,
      type: TypeOperation.retrait,
    });
  }

  // Guichet (agent) et membre : historique d'un seul compte (ownership ci-dessous)
  @Roles(...ADMIN_ROLES, 'agent', 'member')
  @Get('compte/:compte')
  async findByCompte(
    @Param('compte') compte: string,
    @Req() req: AuthenticatedRequest,
  ) {
    assertOwnAccountOrAdmin(req, compte);
    return this.savingsService.findByCompte(compte);
  }

  @Roles(...ADMIN_ROLES, 'agent')
  @Get('soldes/:numero')
  async getSoldes(@Param('numero') numero: string) {
    return this.savingsService.getSoldes(numero);
  }

  @Get('totals-all')
  async getTotalsAll() {
    return this.savingsService.getTotalsAll();
  }

  @Get('by-type/:type')
  async getByType(@Param('type') type: string) {
    return this.savingsService.getSoldeByTypeCompte(type);
  }

  // Encaissement / décaissement au guichet
  @Roles(...ADMIN_ROLES, 'agent')
  @Post()
  async create(@Body() createDto: CreateSavingsDto) {
    return this.savingsService.create(createDto);
  }

  @Roles(...SUPERADMIN_ROLES)
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.savingsService.remove(id);
  }
}
