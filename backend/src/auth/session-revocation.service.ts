import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { RedisClientType } from 'redis';
import { REDIS_CLIENT } from '../redis/redis.constants';

const KEY_PREFIX = 'auth:revoked:';
/** Au-delà, on élague les entrées mémoire expirées. */
const MEMORY_PRUNE_THRESHOLD = 10_000;

/**
 * Liste de révocation des sessions JWT (déconnexion immédiate).
 *
 * Le JWT est sans état : effacer le cookie ne suffit pas, un jeton copié
 * resterait valable jusqu'à son expiration. On mémorise donc son `jti`
 * jusqu'à son `exp` ; l'entrée expire avec le jeton, la liste ne grossit
 * pas indéfiniment.
 *
 * La révocation est écrite dans Redis (partagée entre instances) ET en
 * mémoire. La copie mémoire garantit qu'une déconnexion reste effective
 * localement même si Redis tombe juste après l'écriture, et évite un
 * aller-retour réseau sur le chemin chaud.
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

    // Toujours alimenter la mémoire, même quand Redis répond : sans cela une
    // panne Redis ultérieure ferait réapparaître une session déconnectée.
    this.remember(jti, Date.now() + ttlSeconds * 1000);

    try {
      if (this.redis?.isOpen) {
        await this.redis.set(`${KEY_PREFIX}${jti}`, '1', { EX: ttlSeconds });
      }
    } catch (error) {
      this.logger.error(
        `Impossible d'enregistrer la révocation dans Redis: ${String(error)}`,
      );
    }
  }

  async isRevoked(jti: string | undefined): Promise<boolean> {
    if (!jti) return false;

    // 1. Révocation locale : c'est le cas nominal du logout sur cette instance.
    const expiresAt = this.memory.get(jti);
    if (expiresAt !== undefined) {
      if (expiresAt > Date.now()) return true;
      this.memory.delete(jti);
    }

    // 2. Révocation faite sur une autre instance : Redis fait foi.
    try {
      if (this.redis?.isOpen) {
        return (await this.redis.exists(`${KEY_PREFIX}${jti}`)) === 1;
      }
    } catch (error) {
      // Redis indisponible : on ne déconnecte pas toutes les sessions pour
      // autant, la révocation est un mécanisme de défense en profondeur.
      this.logger.error(
        `Impossible de lire la révocation dans Redis: ${String(error)}`,
      );
    }

    return false;
  }

  private remember(jti: string, expiresAt: number): void {
    if (this.memory.size >= MEMORY_PRUNE_THRESHOLD) {
      const now = Date.now();
      for (const [key, expiry] of this.memory) {
        if (expiry <= now) this.memory.delete(key);
      }
    }
    this.memory.set(jti, expiresAt);
  }
}
