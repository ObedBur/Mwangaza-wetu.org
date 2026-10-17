import { ADMIN_ROLES, Roles, SUPERADMIN_ROLES } from '../common/decorators/roles.decorator';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { DatService } from './dat.service';
import {
  AnnulerDatDto,
  CloturerDatDto,
  CreateDatDto,
} from './dto/create-dat.dto';
import type { AuthenticatedRequest } from '../common/types/auth-request';

/**
 * DÉPÔT À TERME — dossier fonctionnel §3.2
 *
 * Règles arrêtées par la direction (16/10/2026) :
 *  - 1 seul DAT actif par membre
 *  - retrait anticipé INTERDIT (E1)
 *  - à l'échéance, le membre se présente au guichet (option B)
 *  - taux de période : 15 % (1/3/6 mois), 30 % (12 mois) — lus en base
 */
@Roles(...ADMIN_ROLES, 'agent')
@Controller('api/dat')
export class DatController {
  constructor(private readonly datService: DatService) {}

  /** Barème actuel (taux + minimums) — lu en base, modifiable sans redéploiement. */
  @Get('bareme')
  getBareme() {
    return this.datService.getBareme();
  }

  /** Placements DAT du seul membre authentifié. */
  @Roles('member')
  @Get('moi')
  findMine(@Req() req: AuthenticatedRequest) {
    const numeroCompte = req.user?.accountNumber;
    if (!numeroCompte) throw new UnauthorizedException('Session membre invalide');
    return this.datService.findAll(numeroCompte);
  }

  /** DAT arrivés à échéance, en attente de passage au guichet. */
  @Get('echeances')
  getEcheances() {
    return this.datService.findEcheances();
  }

  /** Synthèse pour le tableau de bord. */
  @Get('stats')
  getStats() {
    return this.datService.getStats();
  }

  /** Liste des DAT, éventuellement filtrée par numéro de compte. */
  @Get()
  findAll(@Query('numeroCompte') numeroCompte?: string) {
    return this.datService.findAll(numeroCompte);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.datService.findOne(id);
  }

  /** Ouverture d'un DAT : contrôle minimum, solde et unicité du DAT actif. */
  @Post()
  ouvrir(@Body() dto: CreateDatDto, @Req() req: AuthenticatedRequest) {
    return this.datService.ouvrir(dto, req.user?.userId);
  }

  /** Clôture à l'échéance : capital + gain versés sur le Principal. */
  @Post(':id/cloturer')
  @HttpCode(HttpStatus.OK)
  cloturer(
    @Param('id', ParseIntPipe) id: number,
    @Body() _dto: CloturerDatDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.datService.cloturer(id, req.user?.userId);
  }

  /**
   * Annulation avec contrepassation (§8.3) — réservée au superadmin,
   * motif obligatoire, jamais de suppression de l'historique.
   */
  @Post(':id/annuler')
  @HttpCode(HttpStatus.OK)
  @Roles(...SUPERADMIN_ROLES)
  annuler(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AnnulerDatDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.datService.annuler(id, dto.motif, req.user?.userId);
  }
}
