import { Module } from '@nestjs/common';
import { ZktecoService } from './zkteco.service';
import { SyncService } from './sync/sync.service';
import { PrismaService } from '../prisma/prisma.service';
import { ZktecoController } from './zkteco.controller';

@Module({
  providers: [ZktecoService, SyncService, PrismaService],
  controllers: [ZktecoController],
  exports: [ZktecoService, SyncService],
})
export class ZktecoModule {}
