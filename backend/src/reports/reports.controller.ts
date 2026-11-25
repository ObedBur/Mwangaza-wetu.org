import { ADMIN_ROLES, Roles } from '../common/decorators/roles.decorator';
import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Roles(...ADMIN_ROLES)
@Controller()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('api/rapport')
  async getRapport(
    @Query('type') type: string,
    @Query('periode') periode: string,
  ) {
    return this.reportsService.getRapport(type, periode);
  }

  @Get('api/rapports/synthese')
  async getSynthese(
    @Query('debut') debut: string,
    @Query('fin') fin: string,
    @Query('granularite') granularite?: string,
  ) {
    return this.reportsService.getSynthese({ debut, fin, granularite });
  }

  @Get('api/rapports/epargne')
  epargne(@Query('debut') debut: string, @Query('fin') fin: string) {
    return this.reportsService.getEpargneProduit({ debut, fin });
  }

  @Get('api/rapports/credits')
  credits(
    @Query('debut') debut: string,
    @Query('fin') fin: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.reportsService.getCreditPortfolio({ debut, fin, page, pageSize });
  }

  @Get('api/rapports/evaluation')
  evaluation(@Query('debut') debut: string, @Query('fin') fin: string) {
    return this.reportsService.getEvaluation({ debut, fin });
  }
}
