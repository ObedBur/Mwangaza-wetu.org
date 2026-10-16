import { ADMIN_ROLES, Roles } from '../common/decorators/roles.decorator';
import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Roles(...ADMIN_ROLES)
@Controller('api/rapport')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  async getRapport(
    @Query('type') type: string,
    @Query('periode') periode: string,
  ) {
    return this.reportsService.getRapport(type, periode);
  }
}
