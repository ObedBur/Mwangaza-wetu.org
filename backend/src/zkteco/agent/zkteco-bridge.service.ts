import {
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ZktecoBridgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  get enabled(): boolean {
    return this.config.get<string>('ZKTECO_MODE') === 'bridge';
  }

  async execute<T>(action: string, payload?: unknown): Promise<T> {
    const timeoutMs = Number(
      this.config.get<string>('ZKTECO_COMMAND_TIMEOUT') ?? 45000,
    );
    await this.prisma.zktecoCommand.deleteMany({
      where: {
        status: { in: ['COMPLETED', 'FAILED'] },
        completedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    });
    const command = await this.prisma.zktecoCommand.create({
      data: { action, payload: payload as object | undefined },
    });
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const current = await this.prisma.zktecoCommand.findUnique({
        where: { id: command.id },
      });
      if (!current) throw new ServiceUnavailableException('Commande ZKTeco introuvable');
      if (current.status === 'COMPLETED') return current.result as T;
      if (current.status === 'FAILED') {
        throw new ServiceUnavailableException(
          current.error || 'Le relais ZKTeco a échoué',
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    await this.prisma.zktecoCommand.updateMany({
      where: { id: command.id, status: { in: ['PENDING', 'RUNNING'] } },
      data: { status: 'FAILED', error: 'Délai de réponse du relais dépassé', completedAt: new Date() },
    });
    throw new GatewayTimeoutException(
      'Le relais ZKTeco ne répond pas. Vérifiez que le PC du bureau est allumé et connecté.',
    );
  }
}
