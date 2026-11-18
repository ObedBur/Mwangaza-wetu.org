import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { RedisClientType } from 'redis';
import { REDIS_CLIENT } from './redis.constants';

/**
 * Incrémente un compteur et pose sa fenêtre expirante dans la même opération.
 *
 * Sans le script, un `INCR` suivi d'un `PEXPIRE` peut laisser une clé sans
 * TTL si le processus meurt entre les deux : le compteur ne serait alors
 * jamais réinitialisé et bloquerait l'utilisateur indéfiniment.
 */
const CONSUME_SCRIPT = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('PEXPIRE', KEYS[1], ARGV[1])
  end
  local ttl = redis.call('PTTL', KEYS[1])
  return {count, ttl}
`;

/** Décrémente sans jamais passer sous zéro ni ressusciter une clé purgée. */
const DECREMENT_SCRIPT = `
  local value = tonumber(redis.call('GET', KEYS[1]) or '0')
  if value <= 0 then
    return 0
  end
  if value == 1 then
    redis.call('DEL', KEYS[1])
    return 0
  end
  return redis.call('DECR', KEYS[1])
`;

/** Au-delà, on élague les compteurs mémoire expirés. */
const MEMORY_PRUNE_THRESHOLD = 10_000;
/** Une alerte de repli au maximum par minute : pas de spam de logs. */
const FALLBACK_LOG_INTERVAL_MS = 60_000;

interface MemoryBucket {
  count: number;
  resetAt: number;
}

/**
 * Compteurs de limitation de débit.
 *
 * Redis est la source de vérité : les compteurs sont partagés entre instances
 * et n'écrivent plus une ligne PostgreSQL à chaque tentative de connexion
 * (surface DoS gratuite pour un attaquant).
 *
 * Redis reste optionnel en développement. Quand il est absent ou
 * momentanément indisponible, un compteur mémoire prend le relais : la
 * limitation est alors locale au processus. Mieux vaut un quota local qu'un
 * service de connexion totalement ouvert ; le repli est journalisé pour ne
 * pas rester silencieux.
 */
@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly memory = new Map<string, MemoryBucket>();
  private lastFallbackLogAt = 0;

  constructor(
    @Optional()
    @Inject(REDIS_CLIENT)
    private readonly redis: RedisClientType | null,
  ) {}

  /**
   * Compte une tentative.
   *
   * @returns le nombre de secondes à attendre si la limite est dépassée,
   *          `undefined` si la tentative est autorisée.
   */
  async consume(
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<number | undefined> {
    const { count, retryAfterMs } = await this.increment(key, windowMs);
    if (count <= limit) return undefined;
    return Math.max(1, Math.ceil(retryAfterMs / 1000));
  }

  /** Supprime un compteur (connexion réussie, changement de mot de passe…). */
  async reset(key: string): Promise<void> {
    this.memory.delete(key);
    try {
      if (this.redis?.isReady) await this.redis.del(key);
    } catch (error) {
      this.reportFallback('DEL', error);
    }
  }

  /**
   * Retire une tentative d'un compteur.
   *
   * Utilisé par le limiteur de connexion : une connexion réussie ne doit pas
   * consommer le quota global de l'adresse IP, sans pour autant effacer les
   * échecs essuyés sur d'autres comptes.
   */
  async decrement(key: string): Promise<void> {
    const bucket = this.memory.get(key);
    if (bucket) {
      if (bucket.resetAt <= Date.now() || bucket.count <= 1) {
        this.memory.delete(key);
      } else {
        bucket.count -= 1;
      }
    }

    try {
      if (this.redis?.isReady) {
        await this.redis.eval(DECREMENT_SCRIPT, { keys: [key] });
      }
    } catch (error) {
      this.reportFallback('DECR', error);
    }
  }

  private async increment(
    key: string,
    windowMs: number,
  ): Promise<{ count: number; retryAfterMs: number }> {
    if (this.redis?.isReady) {
      try {
        const result = (await this.redis.eval(CONSUME_SCRIPT, {
          keys: [key],
          arguments: [String(windowMs)],
        })) as [number, number];
        const count = Number(result[0]);
        const ttl = Number(result[1]);
        return {
          count,
          // `PTTL` peut valoir -1/-2 si la clé a expiré entre-temps : on
          // retombe alors sur une fenêtre complète.
          retryAfterMs: ttl > 0 ? ttl : windowMs,
        };
      } catch (error) {
        this.reportFallback('INCR', error);
      }
    }

    return this.incrementInMemory(key, windowMs);
  }

  private incrementInMemory(
    key: string,
    windowMs: number,
  ): { count: number; retryAfterMs: number } {
    const now = Date.now();
    this.pruneExpired(now);

    const bucket = this.memory.get(key);
    if (!bucket || bucket.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowMs };
      this.memory.set(key, fresh);
      return { count: fresh.count, retryAfterMs: windowMs };
    }

    bucket.count += 1;
    return { count: bucket.count, retryAfterMs: bucket.resetAt - now };
  }

  private pruneExpired(now: number): void {
    if (this.memory.size < MEMORY_PRUNE_THRESHOLD) return;
    for (const [key, bucket] of this.memory) {
      if (bucket.resetAt <= now) this.memory.delete(key);
    }
  }

  private reportFallback(operation: string, error: unknown): void {
    const now = Date.now();
    if (now - this.lastFallbackLogAt < FALLBACK_LOG_INTERVAL_MS) return;
    this.lastFallbackLogAt = now;
    this.logger.warn(
      `Redis indisponible (${operation}) : limitation de débit basculée sur le compteur mémoire. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
