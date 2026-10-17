import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { MembersModule } from './members/members.module';
import { SavingsModule } from './savings/savings.module';
import { CreditsModule } from './credits/credits.module';
import { AuthModule } from './auth/auth.module';
import { BalancesModule } from './balances/balances.module';
import { WithdrawalsModule } from './withdrawals/withdrawals.module';
import { ParametresModule } from './parametres/parametres.module';
import { RemboursementsModule } from './remboursements/remboursements.module';
import { AdminsModule } from './admins/admins.module';
import { AgentsModule } from './agents/agents.module';
import { ReportsModule } from './reports/reports.module';
import { ZktecoModule } from './zkteco/zkteco.module';
import { ProjectsModule } from './projects/projects.module';
import { DatModule } from './dat/dat.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SupportModule } from './support/support.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Le monorepo peut démarrer Nest depuis la racine du dépôt.
      // Chercher aussi le fichier backend/.env, quelle que soit la cwd.
      envFilePath: [
        join(__dirname, '..', '.env'),
        join(process.cwd(), 'backend', '.env'),
        join(process.cwd(), '.env'),
      ],
    }),
    PrismaModule,
    MembersModule,
    SavingsModule,
    CreditsModule,
    AuthModule,
    BalancesModule,
    WithdrawalsModule,
    ParametresModule,
    RemboursementsModule,
    AdminsModule,
    AgentsModule,
    ReportsModule,
    ZktecoModule,
    ProjectsModule,
    DatModule,
    NotificationsModule,
    SupportModule,
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
