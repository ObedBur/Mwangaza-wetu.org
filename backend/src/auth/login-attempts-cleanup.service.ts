import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Tentatives conservées : au-delà, elles ne participent plus à aucune fenêtre. */
const RETENTION_MS = 24 * 60 * 60 * 1000;
/** Fréquence de purge : une fois par heure. */
const PURGE_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Purge périodique de la table `login_attempts`.
 *
 * La limitation de débit ne lit que les tentatives des 15 dernières minutes,
 * mais rien ne supprimait les lignes plus anciennes : la table grossissait
 * indéfiniment (et chaque tentative de connexion y écrivait une ligne).
 *
 * On n'ajoute pas `@nestjs/schedule` pour une seule tâche : un `setInterval`
 * avec `unref()` suffit et ne retient pas le processus à l'arrêt.
 */
@Injectable()
export class LoginAttemptsCleanupService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(LoginAttemptsCleanupService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.purge();
    }, PURGE_INTERVAL_MS);
    // Ne bloque pas l'arrêt du processus (tests, redémarrage, serverless).
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Supprime les tentatives sorties de toutes les fenêtres de limitation. */
  async purge(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - RETENTION_MS);
    try {
      const result = await this.prisma.loginAttempt.deleteMany({
        where: { updatedAt: { lt: cutoff } },
      });
      if (result.count > 0) {
        this.logger.log(
          `${result.count} tentative(s) de connexion purgée(s) (antérieures au ${cutoff.toISOString()}).`,
        );
      }
      return result.count;
    } catch (error) {
      // Une purge ratée ne doit jamais faire tomber l'application : elle sera
      // retentée au prochain intervalle.
      this.logger.warn(
        `Purge de login_attempts impossible : ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return 0;
    }
  }
}
