import { Module } from '@nestjs/common';
import { ComptabiliteService } from './comptabilite.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ComptabiliteReportingService } from './comptabilite-reporting.service';
import { ComptabiliteController } from './comptabilite.controller';

@Module({
  imports: [PrismaModule],
  providers: [ComptabiliteService, ComptabiliteReportingService],
  controllers: [ComptabiliteController],
  exports: [ComptabiliteService],
})
export class ComptabiliteModule {}
