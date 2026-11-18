import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { LoginThrottleGuard } from './login-throttle.guard';
import { SessionRevocationService } from './session-revocation.service';
import { RedisModule } from '../redis/redis.module';
import { AuthAuditService } from './auth-audit.service';
import { LoginAttemptsCleanupService } from './login-attempts-cleanup.service';
import { PasswordChangeThrottleGuard } from './password-change-throttle.guard';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: getJwtSecret(configService),
        signOptions: { expiresIn: '24h' },
      }),
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    LoginThrottleGuard,
    PasswordChangeThrottleGuard,
    SessionRevocationService,
    AuthAuditService,
    LoginAttemptsCleanupService,
  ],
  controllers: [AuthController],
  exports: [AuthService, JwtStrategy, SessionRevocationService],
})
export class AuthModule {}

function getJwtSecret(configService: ConfigService): string {
  const secret = configService.getOrThrow<string>('JWT_SECRET');
  if (
    secret.trim().length < 32 ||
    /changeme|example|placeholder|your[-_ ]?secret/i.test(secret)
  ) {
    throw new Error('JWT_SECRET must be a non-placeholder value of at least 32 characters.');
  }
  return secret;
}
