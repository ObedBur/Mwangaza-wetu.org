import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { Public } from '../../auth/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { SyncService } from '../sync/sync.service';
import { ZktecoAgentGuard } from './zkteco-agent.guard';

@Public()
@UseGuards(ZktecoAgentGuard)
@Controller('api/zkteco/agent')
export class ZktecoAgentController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sync: SyncService,
  ) {}

  @Post('heartbeat')
  heartbeat() {
    return { online: true, serverTime: new Date().toISOString() };
  }

  @Post('attendances')
  async ingest(@Body() body: { logs?: unknown[] }) {
    if (!Array.isArray(body?.logs)) return { received: 0, stored: 0 };
    const stored = await this.sync.ingestDeviceAttendances(body.logs);
    return { received: body.logs.length, stored };
  }

  @Get('commands/next')
  async nextCommand() {
    const pending = await this.prisma.zktecoCommand.findFirst({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });
    if (!pending) return { command: null };
    const claimed = await this.prisma.zktecoCommand.updateMany({
      where: { id: pending.id, status: 'PENDING' },
      data: { status: 'RUNNING', startedAt: new Date() },
    });
    if (claimed.count !== 1) return { command: null };
    return {
      command: { id: pending.id, action: pending.action, payload: pending.payload },
    };
  }

  @Post('commands/:id/result')
  async complete(
    @Param('id') id: string,
    @Body() body: { success?: boolean; result?: unknown; error?: string },
  ) {
    const updated = await this.prisma.zktecoCommand.updateMany({
      where: { id, status: 'RUNNING' },
      data: {
        status: body?.success ? 'COMPLETED' : 'FAILED',
        result: body?.success ? (body.result as object | undefined) : undefined,
        error: body?.success ? null : String(body?.error || 'Commande échouée').slice(0, 1000),
        completedAt: new Date(),
      },
    });
    if (!updated.count) throw new NotFoundException('Commande ZKTeco expirée ou introuvable');
    return { accepted: true };
  }
}
