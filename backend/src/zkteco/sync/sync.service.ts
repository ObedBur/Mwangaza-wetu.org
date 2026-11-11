// src/zkteco/sync/sync.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ZktecoService } from '../zkteco.service';
import { ZkAttendanceLog } from '../zkteco.service';

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
        const uid = this.deviceUserId(log);
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

  /** Stores attendance logs sent by the local Windows relay. */
  async ingestDeviceAttendances(input: unknown[]): Promise<number> {
    let stored = 0;
    for (const value of input) {
      if (!value || typeof value !== 'object') continue;
      const log = value as ZkAttendanceLog;
      const uid = this.deviceUserId(log);
      const dateStr = log.recordTime || log.timestamp;
      const timestamp = new Date(dateStr ?? '');
      if (!uid || Number.isNaN(timestamp.getTime())) continue;

      const membre = await this.prisma.membre.findFirst({
        where: { userId: uid },
        select: { id: true, nomComplet: true },
      });
      const existing = await this.prisma.attendance.findFirst({
        where: { uid, timestamp },
        select: { id: true, membreId: true },
      });
      if (existing) {
        if (membre && existing.membreId === null) {
          await this.prisma.attendance.update({
            where: { id: existing.id },
            data: { membreId: membre.id },
          });
        }
        continue;
      }

      if (!membre) {
        this.logger.warn(`UID appareil ${uid} inconnu – pointage enregistré sans membre`);
      }
      await this.prisma.attendance.create({
        data: { uid, timestamp, membreId: membre?.id ?? null },
      });
      stored += 1;
      if (membre) this.logger.debug(`Pointage relais → ${membre.nomComplet} (${uid})`);
    }
    return stored;
  }

  private deviceUserId(log: ZkAttendanceLog): string | undefined {
    const id = log.deviceUserId || log.userId || log.uid;
    return id === undefined || id === null || id === '' ? undefined : String(id);
  }

  async startRealTimeListener() {
    this.logger.log("Démarrage de l'écoute temps réel...");

    await this.zkteco.startRealtime(async (log) => {
      this.logger.debug('Pointage temps réel reçu:', log);

      const uid = this.deviceUserId(log);
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
