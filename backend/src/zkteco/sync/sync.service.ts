// src/zkteco/sync/sync.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ZktecoService } from '../zkteco.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly zkteco: ZktecoService,
    private readonly prisma: PrismaService,
  ) {}

  async syncAllAttendances() {
    try {
      const logs = await this.zkteco.getAttendances();
      this.logger.log(`Récupération de ${logs.length} logs depuis l'appareil`);

      const recentLogs = logs.filter((log) => {
        const dateStr = log.recordTime || log.timestamp;
        if (!dateStr) return false;
        const year = new Date(dateStr).getFullYear();
        return year >= 2024;
      });

      this.logger.log(`${recentLogs.length} logs récents à synchroniser`);

      for (const log of recentLogs) {
        const uid = log.userSn?.toString() || log.userId?.toString();
        const dateStr = log.recordTime || log.timestamp;
        const timestamp = new Date(dateStr ?? '');

        if (!uid || isNaN(timestamp.getTime())) {
          this.logger.warn('Log ignoré (UID ou timestamp invalide):', log);
          continue;
        }

        // Vérifier si déjà présent
        const existing = await this.prisma.attendance.findFirst({
          where: { uid, timestamp },
        });

        if (!existing) {
          const membre = await this.prisma.membre.findFirst({
            where: { userId: uid },
          });

          if (membre) {
            await this.prisma.attendance.create({
              data: {
                uid,
                timestamp,
                membreId: membre.id,
              },
            });
            this.logger.debug(`Synchronisé → ${membre.nomComplet} (${uid})`);
          } else {
            this.logger.warn(`UID ${uid} inconnu – aucun membre associé`);
          }
        }
      }

      this.logger.log('Synchronisation manuelle terminée avec succès');
    } catch (error) {
      this.logger.error('Erreur lors de la synchronisation', error);
      throw error;
    }
  }

  async startRealTimeListener() {
    this.logger.log("Démarrage de l'écoute temps réel...");

    await this.zkteco.startRealtime(async (log) => {
      this.logger.debug('Pointage temps réel reçu:', log);

      const uid = log.userSn?.toString() || log.userId?.toString();
      // Pression en direct → horodatage serveur (horloge appareil non fiable)
      const timestamp = new Date();

      if (!uid) {
        this.logger.warn('Log temps réel invalide ignoré');
        return;
      }

      const membre = await this.prisma.membre.findFirst({
        where: { userId: uid },
      });

      if (!membre) {
        this.logger.warn(`Pointage ignoré – UID ${uid} inconnu dans la base`);
        return;
      }

      // Dédup fenêtré (5 s) : le timestamp serveur change à chaque appel
      const exists = await this.prisma.attendance.findFirst({
        where: { uid, timestamp: { gte: new Date(Date.now() - 5000) } },
      });

      if (!exists) {
        await this.prisma.attendance.create({
          data: {
            uid,
            timestamp,
            membreId: membre.id,
          },
        });
        this.logger.log(
          `Pointage temps réel → ${membre.nomComplet} à ${timestamp.toLocaleTimeString()}`,
        );
      }
    });
  }
}
