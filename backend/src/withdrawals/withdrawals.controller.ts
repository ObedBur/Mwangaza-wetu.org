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
import { WithdrawalsService } from './withdrawals.service';
import {
  CancelWithdrawalDto,
  CreateWithdrawalDto,
  FundAgentCashboxDto,
  VerifyWithdrawalDto,
} from './dto/create-withdrawal.dto';
import type { AuthenticatedRequest } from '../common/types/auth-request';
import { assertOwnAccountOrAdmin } from '../common/utils/ownership';

/** Row returned by WithdrawalsService (Prisma Retrait ± membre) */
interface RetraitRow {
  id: number;
  reference: string;
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
  executeParId?: number | null;
  executeParRole?: string | null;
  annuleLe?: Date | null;
  annuleParId?: number | null;
  annuleParRole?: string | null;
  motifAnnulation?: string | null;
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
    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize || '10', 10) || 10));
    const result = await this.withdrawalsService.findAll(pageNum, pageSizeNum);
    return { ...result, data: this.mapRetraitsToResponse(result.data) };
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
  @Roles('agent')
  @Post('verify-limites')
  async verify(
    @Body() body: VerifyWithdrawalDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.withdrawalsService.verifyForAgent(
      body.compte,
      body.montant,
      body.devise,
      req.user!.userId!,
    );
  }

  @Roles('agent')
  @Get('caisse/moi')
  getMyCashboxes(@Req() req: AuthenticatedRequest) {
    return this.withdrawalsService.getMyCashboxes(req.user!.userId!);
  }

  @Roles('agent')
  @Get('caisse/moi/mouvements')
  getMyCashboxMovements(
    @Req() req: AuthenticatedRequest,
    @Query('limit') limit?: string,
  ) {
    return this.withdrawalsService.getCashboxMovements(
      req.user!.userId!,
      parseInt(limit || '100', 10) || 100,
    );
  }

  @Roles(...ADMIN_ROLES)
  @Get('caisses')
  getAllCashboxes() {
    return this.withdrawalsService.getAllCashboxes();
  }

  @Roles(...ADMIN_ROLES)
  @Get('caisses/:agentId/mouvements')
  getCashboxMovements(
    @Param('agentId', ParseIntPipe) agentId: number,
    @Query('limit') limit?: string,
  ) {
    return this.withdrawalsService.getCashboxMovements(
      agentId,
      parseInt(limit || '100', 10) || 100,
    );
  }

  @Roles(...ADMIN_ROLES)
  @Post('caisses/:agentId/approvisionnement')
  fundCashbox(
    @Param('agentId', ParseIntPipe) agentId: number,
    @Body() dto: FundAgentCashboxDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.withdrawalsService.fundCashbox(agentId, dto, req.user!);
  }

  // Décaissement au guichet
  @Roles('agent')
  @Post()
  async create(
    @Body() dto: CreateWithdrawalDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const retrait = await this.withdrawalsService.create(dto, req.user!);
    return this.mapRetraitToResponse(retrait);
  }

  @Roles(...ADMIN_ROLES)
  @Post(':id/annuler')
  async cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelWithdrawalDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const retrait = await this.withdrawalsService.cancel(id, dto, req.user!);
    return this.mapRetraitToResponse(retrait);
  }

  // ─── Mappage privé pour transformer les données ─────────────────
  private mapRetraitToResponse(retrait: RetraitRow | null | undefined) {
    if (!retrait) return null;

    return {
      id: retrait.id,
      reference: retrait.reference,
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
      executedBy: retrait.executeParId
        ? { id: retrait.executeParId, role: retrait.executeParRole }
        : null,
      cancelledAt: retrait.annuleLe ?? null,
      cancelledBy: retrait.annuleParId
        ? { id: retrait.annuleParId, role: retrait.annuleParRole }
        : null,
      cancellationReason: retrait.motifAnnulation ?? null,
    };
  }

  private mapRetraitsToResponse(retraits: RetraitRow[]) {
    if (!Array.isArray(retraits)) return [];
    return retraits.map((r) => this.mapRetraitToResponse(r));
  }
}
