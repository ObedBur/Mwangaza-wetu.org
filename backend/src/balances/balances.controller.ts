import { ADMIN_ROLES, Roles } from '../common/decorators/roles.decorator';
import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { BalancesService } from './balances.service';
import { ParseIntPipe } from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/types/auth-request';
import { assertOwnAccountOrAdmin } from '../common/utils/ownership';

@Roles(...ADMIN_ROLES)
@Controller('api/solde')
export class BalancesController {
  constructor(private readonly balancesService: BalancesService) {}

  @Get()
  async findAll(@Query() query: any) {
    return this.balancesService.findAll(query);
  }

  @Get('total')
  async getTotal() {
    return this.balancesService.getTotal();
  }

  @Get('dashboard')
  async getDashboard() {
    return this.balancesService.getDashboardOverview();
  }

  @Get('dashboard/transactions')
  async getDashboardTransactions(@Query('limit') limit?: string) {
    const parsedLimit = Math.min(50, Math.max(1, Number(limit) || 10));
    return this.balancesService.getRecentTransactions(parsedLimit);
  }

  @Get('type/:type_compte')
  async getByType(@Param('type_compte') typeCompte: string) {
    return this.balancesService.getByType(typeCompte);
  }

  @Get('frais-retraits')
  async getFraisRetraits() {
    return this.balancesService.getFraisRetraits();
  }

  @Get('tresorerie')
  async getTresorerieDisponible() {
    return this.balancesService.getTresorerieDisponible();
  }

  // Guichet (agent) et membre : solde d'un seul compte (ownership ci-dessous)
  @Roles(...ADMIN_ROLES, 'agent', 'member')
  @Get('membre/:numero/disponible')
  async getSoldeDisponibleMembre(
    @Param('numero') numero: string,
    @Req() req: AuthenticatedRequest,
  ) {
    assertOwnAccountOrAdmin(req, numero);
    return this.balancesService.getSoldeDisponibleMembre(numero);
  }

  @Get('membre/:membreId/garantie')
  async getGarantieMembre(
    @Param('membreId', ParseIntPipe) membreId: number,
    @Query('taux') tauxGarantie?: string,
  ) {
    // tauxGarantie is optional, default to 0.3
    const taux = tauxGarantie ? Number(tauxGarantie) : 0.3;
    return this.balancesService.rafraichirGarantie(membreId, taux);
  }
}
