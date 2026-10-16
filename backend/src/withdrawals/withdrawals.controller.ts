import { ADMIN_ROLES, Roles } from '../common/decorators/roles.decorator';
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ValidationPipe,
  Query,
  Req,
} from '@nestjs/common';
import { WithdrawalsService } from './withdrawals.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import type { AuthenticatedRequest } from '../common/types/auth-request';
import { assertOwnAccountOrAdmin } from '../common/utils/ownership';

/** Row returned by WithdrawalsService (Prisma Retrait ± membre) */
interface RetraitRow {
  id: number;
  dateOperation: Date;
  compte: string;
  membre?: { nomComplet?: string | null } | null;
  montant: unknown;
  devise: string;
  description?: string | null;
  statut?: string;
  frais: unknown;
  soldeAvant: unknown;
  soldeApres: unknown;
}

@Roles(...ADMIN_ROLES)
@Controller('api/withdrawals')
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize) : 10;
    const retraits = await this.withdrawalsService.findAll();

    // Appliquer la pagination manuellement côté contrôleur
    const skip = (pageNum - 1) * pageSizeNum;
    const paginatedData = retraits.slice(skip, skip + pageSizeNum);

    return {
      data: this.mapRetraitsToResponse(paginatedData),
      meta: {
        total: retraits.length,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages: Math.ceil(retraits.length / pageSizeNum),
        hasNextPage: pageNum * pageSizeNum < retraits.length,
        hasPrevPage: pageNum > 1,
      },
    };
  }

  // Guichet (agent) et membre : retraits d'un seul compte (ownership ci-dessous)
  @Roles(...ADMIN_ROLES, 'agent', 'member')
  @Get('compte/:compte')
  async findByCompte(
    @Param('compte') compte: string,
    @Req() req: AuthenticatedRequest,
  ) {
    assertOwnAccountOrAdmin(req, compte);
    const retraits = await this.withdrawalsService.findByCompte(compte);
    return this.mapRetraitsToResponse(retraits);
  }

  // Contrôle de limites avant encaissement au guichet
  @Roles(...ADMIN_ROLES, 'agent')
  @Post('verify-limites')
  async verify(
    @Body(new ValidationPipe({ whitelist: true }))
    body: {
      compte: string;
      montant: number;
      devise: string;
    },
  ) {
    return this.withdrawalsService.verifyLimites(
      body.compte,
      body.montant,
      body.devise,
    );
  }

  // Décaissement au guichet
  @Roles(...ADMIN_ROLES, 'agent')
  @Post()
  async create(
    @Body(new ValidationPipe({ whitelist: true })) dto: CreateWithdrawalDto,
  ) {
    const retrait = await this.withdrawalsService.create(dto);
    return this.mapRetraitToResponse(retrait);
  }

  // ─── Mappage privé pour transformer les données ─────────────────
  private mapRetraitToResponse(retrait: RetraitRow | null | undefined) {
    if (!retrait) return null;

    return {
      id: retrait.id,
      dateISO: new Date(retrait.dateOperation).toISOString().split('T')[0],
      time: new Date(retrait.dateOperation).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      accountNumber: retrait.compte,
      memberName: retrait.membre?.nomComplet || 'N/A',
      amount: Number(retrait.montant),
      currency: retrait.devise,
      reason: retrait.description || '-',
      status: retrait.statut?.toLowerCase() || 'completed',
      frais: Number(retrait.frais),
      soldeAvant: Number(retrait.soldeAvant),
      soldeApres: Number(retrait.soldeApres),
    };
  }

  private mapRetraitsToResponse(retraits: RetraitRow[]) {
    if (!Array.isArray(retraits)) return [];
    return retraits.map((r) => this.mapRetraitToResponse(r));
  }
}
