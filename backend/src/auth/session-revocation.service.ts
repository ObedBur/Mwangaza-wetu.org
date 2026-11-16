import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { RedisClientType } from 'redis';
import { REDIS_CLIENT } from '../redis/redis.module';

const KEY_PREFIX = 'auth:revoked:';

/**
 * Liste de révocation des sessions JWT (déconnexion immédiate).
 *
 * Le JWT est sans état : effacer le cookie ne suffit pas, un jeton copié
 * resterait valable jusqu'à son expiration. On mémorise donc son `jti`
 * jusqu'à son `exp` ; l'entrée expire avec le jeton, la liste ne grossit
 * pas indéfiniment.
 *
 * Sans Redis (développement local), un cache mémoire assure le même rôle.
 */
@Injectable()
export class SessionRevocationService {
  private readonly logger = new Logger(SessionRevocationService.name);
  private readonly memory = new Map<string, number>();

  constructor(
    @Optional()
    @Inject(REDIS_CLIENT)
    private readonly redis: RedisClientType | null,
  ) {}

  async revoke(jti: string, expiresAtSeconds: number): Promise<void> {
    const ttlSeconds = Math.floor(expiresAtSeconds - Date.now() / 1000);
    // Jeton déjà expiré : il est refusé par la stratégie JWT, rien à stocker.
    if (ttlSeconds <= 0) return;

    try {
      if (this.redis?.isOpen) {
        await this.redis.set(`${KEY_PREFIX}${jti}`, '1', { EX: ttlSeconds });
        return;
      }
    } catch {
      this.logger.warn('Redis indisponible; révocation conservée en mémoire.');
    }

    this.memory.set(jti, Date.now() + ttlSeconds * 1000);
  }

  async isRevoked(jti: string | undefined): Promise<boolean> {
    if (!jti) return false;

    try {
      if (this.redis?.isOpen) {
        return (await this.redis.exists(`${KEY_PREFIX}${jti}`)) === 1;
      }
    } catch {
      // Redis indisponible : on ne déconnecte pas toutes les sessions pour
      // autant, la révocation est un mécanisme de défense en profondeur.
      this.logger.warn('Redis indisponible; vérification mémoire utilisée.');
    }

    const expiresAt = this.memory.get(jti);
    if (!expiresAt) return false;
    if (expiresAt <= Date.now()) {
      this.memory.delete(jti);
      return false;
    }
    return true;
  }
}
