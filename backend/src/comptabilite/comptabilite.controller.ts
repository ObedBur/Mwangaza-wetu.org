import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ADMIN_ROLES, Roles } from '../common/decorators/roles.decorator';
import { ComptabiliteReportingService } from './comptabilite-reporting.service';

@Roles(...ADMIN_ROLES)
@Controller('api/comptabilite')
export class ComptabiliteController {
  constructor(private readonly reporting: ComptabiliteReportingService) {}

  @Get('journal')
  journal(
    @Query('debut') debut?: string,
    @Query('fin') fin?: string,
    @Query('section') section?: string,
    @Query('type') type?: string,
    @Query('compteId') compteId?: string,
    @Query('devise') devise?: string,
    @Query('statut') statut?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.reporting.journal({ debut, fin, section, type, compteId, devise, statut, page, pageSize });
  }

  @Get('rapprochement-caisse')
  rapprochementCaisse(
    @Query('debut') debut?: string,
    @Query('fin') fin?: string,
    @Query('devise') devise?: string,
    @Query('agentId') agentId?: string,
    @Query('guichet') guichet?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.reporting.rapprochementCaisse({ debut, fin, devise, agentId, guichet, page, pageSize });
  }

  @Get('grand-livre/:compteId')
  grandLivre(
    @Param('compteId', ParseIntPipe) compteId: number,
    @Query('debut') debut?: string,
    @Query('fin') fin?: string,
  ) {
    return this.reporting.grandLivre(compteId, { debut, fin });
  }

  @Get('balance')
  balance(
    @Query('debut') debut?: string,
    @Query('fin') fin?: string,
    @Query('section') section?: string,
  ) {
    return this.reporting.balance({ debut, fin, section });
  }

  @Get('compte-resultat')
  compteResultat(
    @Query('debut') debut?: string,
    @Query('fin') fin?: string,
    @Query('section') section?: string,
  ) {
    return this.reporting.compteResultat({ debut, fin, section });
  }
}
