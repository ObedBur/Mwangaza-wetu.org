import { Global, Inject, Logger, Module, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import type { RedisClientType } from 'redis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

class RedisLifecycle implements OnModuleInit, OnModuleDestroy {
  constructor(@Optional() @Inject(REDIS_CLIENT) private readonly redis: RedisClientType | null) {}

  async onModuleInit() {
    if (this.redis && !this.redis.isOpen) await this.redis.connect();
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

        const client = createClient({ url });
        client.on('error', () => logger.error('Redis connection error.'));
        return client;
      },
    },
    RedisLifecycle,
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
