import { Global, Inject, Logger, Module, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import { RateLimitService } from './rate-limit.service';
import { RedisHealthService } from './redis-health.service';
import { REDIS_CLIENT } from './redis.constants';

export { REDIS_CLIENT };

class RedisLifecycle implements OnModuleInit, OnModuleDestroy {
  constructor(@Optional() @Inject(REDIS_CLIENT) private readonly redis: RedisClientType | null) {}

  async onModuleInit() {
    if (!this.redis || this.redis.isOpen) return;
    try {
      await this.redis.connect();
    } catch (error) {
      // Redis est une défense en profondeur : son indisponibilité au démarrage
      // ne doit pas empêcher l'application de servir les requêtes. La
      // reconnexion automatique prendra le relais.
      new Logger('Redis').error(
        `Connexion initiale à Redis impossible : ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.redis?.isOpen) await this.redis.quit();
  }
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const logger = new Logger('Redis');
        const url = config.get<string>('REDIS_URL');
        if (!url) {
          if (config.get<string>('NODE_ENV') === 'production') {
            throw new Error('REDIS_URL must be configured in production.');
          }
          logger.warn('REDIS_URL is not set; using an in-memory login limiter for local development.');
          return null;
        }

        const client = createClient({
          url,
          socket: {
            // Backoff exponentiel plafonné : une coupure Redis ne provoque pas
            // de tempête de reconnexions, et le client réessaie indéfiniment
            // (l'application reste debout pendant l'indisponibilité).
            reconnectStrategy: (retries) =>
              Math.min(500 * 2 ** Math.min(retries, 6), 30_000),
          },
        });
        client.on('error', (error) =>
          logger.error(
            `Redis connection error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        );
        return client;
      },
    },
    RedisLifecycle,
    RateLimitService,
    RedisHealthService,
  ],
  exports: [REDIS_CLIENT, RateLimitService, RedisHealthService],
})
export class RedisModule {}
