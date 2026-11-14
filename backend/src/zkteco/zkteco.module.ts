import { Module } from '@nestjs/common';
import { ZktecoService } from './zkteco.service';
import { SyncService } from './sync/sync.service';
import { PrismaService } from '../prisma/prisma.service';
import { ZktecoController } from './zkteco.controller';
import { ZktecoAgentController } from './agent/zkteco-agent.controller';
import { ZktecoAgentGuard } from './agent/zkteco-agent.guard';
import { ZktecoBridgeService } from './agent/zkteco-bridge.service';

@Module({
  providers: [ZktecoService, SyncService, PrismaService, ZktecoAgentGuard, ZktecoBridgeService],
  controllers: [ZktecoController, ZktecoAgentController],
  exports: [ZktecoService, SyncService, ZktecoBridgeService],
})
export class ZktecoModule {}
