import {
  ADMIN_ROLES,
  Roles,
  SUPERADMIN_ROLES,
} from '../common/decorators/roles.decorator';
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  Query,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { RemboursementsService } from './remboursements.service';
import { CreateRemboursementDto } from './dto/create-remboursement.dto';
import { DeleteRemboursementDto } from './dto/delete-remboursement.dto';
import type { AuthenticatedRequest } from '../common/types/auth-request';

@Roles(...ADMIN_ROLES)
@Controller('api/remboursements')
export class RemboursementsController {
  constructor(private readonly remboursementsService: RemboursementsService) {}

  /**
   * GET /api/remboursements
   * Récupérer tous les remboursements avec pagination
   */
  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const pg = page ? parseInt(page, 10) : 1;
    const ps = pageSize ? parseInt(pageSize, 10) : 20;

    if (pg < 1 || ps < 1 || ps > 100) {
      throw new BadRequestException('page ≥ 1, 1 ≤ pageSize ≤ 100');
    }

    return this.remboursementsService.findAll((pg - 1) * ps, ps);
  }

  /**
   * GET /api/remboursements/credit/:creditId
   * Récupérer remboursements d'un crédit spécifique
   */
  @Get('credit/:creditId')
  async findByCredit(
    @Param('creditId', ParseIntPipe) creditId: number,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const pg = page ? parseInt(page, 10) : 1;
    const ps = pageSize ? parseInt(pageSize, 10) : 10;

    return this.remboursementsService.findByCredit(creditId, (pg - 1) * ps, ps);
  }

  /**
   * POST /api/remboursements/add
   * Créer un nouveau remboursement avec validation complète
   */
  // Encaissement d'un remboursement au guichet
  @Roles(...ADMIN_ROLES, 'agent')
  @Post('add')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateRemboursementDto, @Req() req: AuthenticatedRequest) {
    return this.remboursementsService.create(dto, req.user!);
  }

  /**
   * DELETE /api/remboursements/:id
   * Supprimer (soft-delete) un remboursement avec inversion comptable
   */
  @Roles(...SUPERADMIN_ROLES)
  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Body() body?: DeleteRemboursementDto,
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.remboursementsService.remove(
      id,
      body?.reason || 'Suppression manuelle',
      req?.user,
    );
  }
}
