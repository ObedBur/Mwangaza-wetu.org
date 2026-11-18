import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { RedisClientType } from 'redis';
import { REDIS_CLIENT } from './redis.constants';

/**
 * État de santé de Redis et alertes de transition.
 *
 * Redis est une défense en profondeur : son indisponibilité ne doit pas
 * empêcher l'application de servir les requêtes, mais elle ne doit pas non
 * plus passer inaperçue. Ce service journalise chaque bascule
 * disponible → indisponible (et le retour à la normale), et alimente
 * `GET /api/health`.
 */
@Injectable()
export class RedisHealthService {
  private readonly logger = new Logger('Redis');
  private available: boolean | null = null;

  constructor(
    @Optional()
    @Inject(REDIS_CLIENT)
    private readonly redis: RedisClientType | null,
  ) {
    if (!this.redis) return;

    this.redis.on('ready', () => this.updateAvailability(true));
    this.redis.on('end', () => this.updateAvailability(false));
    this.redis.on('reconnecting', () => this.updateAvailability(false));
  }

  /** `false` quand `REDIS_URL` n'est pas configuré (mode développement). */
  isConfigured(): boolean {
    return Boolean(this.redis);
  }

  /** Ping réel : un client « ouvert » peut être en cours de reconnexion. */
  async ping(): Promise<boolean> {
    if (!this.redis) return false;
    try {
      return (await this.redis.ping()) === 'PONG';
    } catch {
      this.updateAvailability(false);
      return false;
    }
  }

  private updateAvailability(available: boolean): void {
    if (this.available === available) return;
    this.available = available;
    if (available) {
      this.logger.log('Redis de nouveau disponible.');
    } else {
      this.logger.warn(
        'Redis indisponible : limitation de débit et révocation de sessions ' +
          'basculées sur les mécanismes locaux.',
      );
    }
  }
}
