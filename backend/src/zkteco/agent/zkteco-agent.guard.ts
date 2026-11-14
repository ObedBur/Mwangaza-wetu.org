import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';

@Injectable()
export class ZktecoAgentGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('ZKTECO_AGENT_TOKEN');
    if (!expected || expected.length < 32) {
      throw new ServiceUnavailableException(
        'Le relais ZKTeco n’est pas configuré sur le serveur',
      );
    }

    const request = context.switchToHttp().getRequest<{
      get(name: string): string | undefined;
    }>();
    const supplied = request.get('x-zkteco-agent-token') ?? '';
    const expectedBuffer = Buffer.from(expected);
    const suppliedBuffer = Buffer.from(supplied);
    if (
      expectedBuffer.length !== suppliedBuffer.length ||
      !timingSafeEqual(expectedBuffer, suppliedBuffer)
    ) {
      throw new UnauthorizedException('Jeton du relais ZKTeco invalide');
    }
    return true;
  }
}
