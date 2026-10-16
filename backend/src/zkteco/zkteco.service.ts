// src/zkteco/zkteco.service.ts
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// node-zklib utilise module.exports = ZKLib (CommonJS)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ZKLib = require('node-zklib');

/** Log de pointage renvoyé par node-zklib */
export interface ZkAttendanceLog {
  userSn: number;
  deviceUserId?: string;
  uid?: string;
  userId?: string;
  recordTime?: string;
  timestamp?: string;
  ip?: string;
}

/** Utilisateur enrôlé sur l'appareil */
export interface ZkDeviceUser {
  userId?: string;
  name?: string;
  uid?: string;
  password?: string;
  card?: string;
  group?: string;
  priv?: number;
  [key: string]: unknown;
}

@Injectable()
export class ZktecoService implements OnModuleDestroy {
  private readonly logger = new Logger(ZktecoService.name);
  private zkInstance: any;
  private isConnected = false;

  // Intégrité de la capture : une seule fenêtre à la fois (1 seul appareil)
  private captureInFlight = false;
  // SN de la dernière pression déjà attribuée — empêche tout rejeu
  private lastConsumedSn = -1;

  // Configuration de l'appareil — variables d'env ZKTECO_* (défauts = site actuel)
  private readonly ip: string;
  private readonly port: number;
  private readonly timeout: number;
  private readonly inport: number;
  private readonly captureTimeout: number;

  constructor(config: ConfigService) {
    this.ip = config.get<string>('ZKTECO_IP') ?? '10.25.114.235';
    this.port = Number(config.get('ZKTECO_PORT') ?? 4370);
    this.timeout = Number(config.get('ZKTECO_TIMEOUT') ?? 10000);
    this.inport = Number(config.get('ZKTECO_INPORT') ?? 4000);
    this.captureTimeout = Number(config.get('ZKTECO_CAPTURE_TIMEOUT') ?? 30000);
  }

  /** Adresse affichable de l'appareil (logs + messages d'erreur) */
  get deviceAddress(): string {
    return `${this.ip}:${this.port}`;
  }

  /**
   * Se connecte à l'appareil ZKTeco
   * La lib utilise createSocket() pour initier la connexion TCP/UDP
   */
  async connect(): Promise<boolean> {
    if (this.isConnected) return true;

    try {
      this.zkInstance = new ZKLib(
        this.ip,
        this.port,
        this.timeout,
        this.inport,
      );

      // createSocket() est la vraie méthode de connexion dans node-zklib
      await this.zkInstance.createSocket(
        (err: any) => {
          this.logger.error('Erreur socket ZKTeco :', err?.message || err);
          this.isConnected = false;
        },
        () => {
          this.logger.warn('Socket ZKTeco fermé');
          this.isConnected = false;
        },
      );

      // Correction de la fuite de mémoire : augmenter la limite de listeners sur le socket interne
      if (this.zkInstance.zsock) {
        this.zkInstance.zsock.setMaxListeners(100);
      }

      this.isConnected = true;
      this.logger.log(`Connecté avec succès à l'appareil ZKTeco ${this.ip}`);

      const info = await this.zkInstance.getInfo();
      this.logger.debug('Info appareil :', info);

      return true;
    } catch (error) {
      this.isConnected = false;
      this.logger.error(
        "Échec de la connexion à l'appareil ZKTeco :",
        error.message || error,
      );
      throw error;
    }
  }

  /**
   * Déconnexion propre
   */
  async disconnect(): Promise<void> {
    if (this.zkInstance && this.isConnected) {
      try {
        await this.zkInstance.disconnect();
        this.logger.log("Déconnecté proprement de l'appareil");
      } catch (error) {
        this.logger.warn(
          'Erreur lors de la déconnexion (ignorée) :',
          error.message,
        );
      } finally {
        this.isConnected = false;
      }
    }
  }

  private async ensureConnection(): Promise<void> {
    if (!this.isConnected || !this.zkInstance) {
      await this.connect();
    }
  }

  async getUsers(): Promise<ZkDeviceUser[]> {
    await this.ensureConnection();
    try {
      const users = await this.zkInstance.getUsers();
      this.logger.log(`Récupéré ${users?.data?.length ?? 0} utilisateurs`);
      return (users?.data ?? users ?? []) as ZkDeviceUser[];
    } catch (error) {
      this.logger.error('Erreur getUsers :', error.message || error);
      throw error;
    }
  }

  async getAttendances(): Promise<ZkAttendanceLog[]> {
    await this.ensureConnection();
    try {
      const attendances = await this.zkInstance.getAttendances();
      this.logger.log(
        `Récupéré ${attendances?.data?.length ?? 0} logs de présence`,
      );
      return (attendances?.data ?? attendances ?? []) as ZkAttendanceLog[];
    } catch (error) {
      this.logger.error('Erreur getAttendances :', error.message || error);
      throw error;
    }
  }

  /**
   * EFFACEMENT DES LOGS
   * Méthode réelle dans node-zklib : clearAttendanceLog()
   */
  async clearAttendance(): Promise<void> {
    await this.ensureConnection();

    this.logger.warn(
      "⚠️ Tentative d'effacement de TOUS les logs de présence sur l'appareil...",
    );

    try {
      const result = await this.zkInstance.clearAttendanceLog();
      this.logger.log('Logs de présence effacés avec succès !', result);
    } catch (error: any) {
      if (
        error.message?.includes('command not supported') ||
        error.message?.includes('Execute command failed') ||
        error.code === -5 ||
        error.code === -1008
      ) {
        this.logger.error(
          "Cet appareil ne permet PAS l'effacement des logs à distance (modèle limité).",
        );
        this.logger.error(
          "→ Il faut effacer physiquement sur l'écran : Menu → Data Mng → Clear Attendance",
        );
      } else {
        this.logger.error(
          'Échec du clearAttendanceLog :',
          error.message || error,
        );
      }
      throw error;
    }
  }

  /**
   * Temps réel – utilise getRealTimeLogs() de node-zklib
   */
  async startRealtime(callback: (log: any) => void): Promise<void> {
    await this.ensureConnection();
    this.logger.log("Démarrage de l'écoute en temps réel...");

    try {
      await this.zkInstance.getRealTimeLogs((data: any) => {
        this.logger.debug('Log temps réel →', data);
        callback(data);
      });
    } catch (error) {
      this.logger.error(
        'Erreur lors du démarrage du realtime :',
        error.message || error,
      );
      throw error;
    }
  }

  /**
   * Capture une empreinte biométrique depuis l'appareil ZKTeco.
   *
   * L'horloge de l'appareil est TOTALEMENT IGNORÉE (RTC non maintenue :
   * l'heure se perd à chaque redémarrage). Aucun raccourci "log récent" :
   * une pression en direct est OBLIGATOIRE pendant la fenêtre de capture,
   * détectée par incrément de userSn (polling) ou listener temps réel.
   * L'horodatage serveur (capturedAt) est ajouté par le contrôleur.
   *
   * Intégrité :
   * - single-flight : une seule capture à la fois (erreur CAPTURE_IN_FLIGHT),
   *   sinon une même pression satisferait deux fenêtres ouvertes ;
   * - anti-rejeu : lastConsumedSn intègre la baseline, une pression déjà
   *   attribuée ne peut plus être revendiquée par la capture suivante
   *   (même si le log appareil n'est pas encore écrit au moment du baseline).
   */
  async captureFingerprint(timeoutMs?: number): Promise<string> {
    if (this.captureInFlight) {
      throw new Error('CAPTURE_IN_FLIGHT');
    }
    this.captureInFlight = true;

    const timeout = timeoutMs ?? this.captureTimeout;

    // Garde-fou : libère le verrou même si la promesse interne se pend
    // (timeout interne + 10 s de marge sur l'attente doigt)
    let guardTimer: NodeJS.Timeout | undefined;
    const guard = new Promise<string>((_, reject) => {
      guardTimer = setTimeout(() => {
        reject(new Error('Placez le doigt encore ou réessayez'));
      }, timeout + 10000);
      guardTimer.unref?.();
    });

    try {
      return await Promise.race([this.captureOnce(timeout), guard]);
    } finally {
      if (guardTimer) clearTimeout(guardTimer);
      this.captureInFlight = false;
    }
  }

  private async captureOnce(timeout: number): Promise<string> {
    await this.ensureConnection();
    this.logger.log(
      `Démarrage capture empreinte (Polling + RT, timeout: ${timeout}ms)`,
    );

    // 1. Baseline : dernier userSn connu (ou déjà consommé) — tout SN
    //    supérieur = nouvelle pression pendant la fenêtre
    let lastLogSn = this.lastConsumedSn;
    try {
      const logs = await this.getAttendances();
      if (logs.length > 0) {
        lastLogSn = Math.max(lastLogSn, logs[logs.length - 1].userSn || -1);
      }
      this.logger.debug(
        `Baseline logs: SN ${lastLogSn} (consommé: ${this.lastConsumedSn}, horloge appareil ignorée)`,
      );
    } catch {
      this.logger.warn(
        'Impossible de lire les logs initiaux, on se basera uniquement sur le temps réel.',
      );
    }

    // 2. Attente d'un nouveau log (Polling + Real-time)
    return new Promise((resolve, reject) => {
      let resolved = false;

      const cleanup = () => {
        resolved = true;
        clearInterval(polling);
        clearTimeout(timer);
      };

      // Timeout global
      const timer = setTimeout(() => {
        if (!resolved) {
          cleanup();
          this.logger.warn(`Capture expirée (Timeout ${timeout}ms)`);
          reject(new Error('Placez le doigt encore ou réessayez'));
        }
      }, timeout);

      // Polling de secours (toutes les 2 secondes)
      const polling = setInterval(async () => {
        if (resolved) return;
        try {
          const logs = await this.getAttendances();
          if (logs.length > 0) {
            const lastLog = logs[logs.length - 1];
            // Si le numéro de séquence a augmenté, c'est un nouveau log!
            if (lastLog.userSn > lastLogSn && lastLogSn !== -1) {
              this.logger.log(
                `✅ Nouveau pointage détecté via polling: User ${lastLog.deviceUserId}`,
              );
              const userId =
                lastLog.deviceUserId || lastLog.uid || lastLog.userId;
              this.lastConsumedSn = Math.max(
                this.lastConsumedSn,
                lastLog.userSn,
              );
              cleanup();
              resolve(String(userId));
            } else if (lastLogSn === -1) {
              // Si on n'avait pas de SN initial, on prend le premier qui arrive
              lastLogSn = lastLog.userSn;
            }
          }
        } catch {
          // Ignorer les erreurs temporaires de polling
        }
      }, 2500);

      // Listener Temps Réel (si supporté par l'appareil)
      try {
        this.zkInstance.getRealTimeLogs((data: any) => {
          if (resolved) return;
          this.logger.log('✅ Pointage détecté via temps réel:', data);
          const userId =
            data?.deviceUserId || data?.uid || data?.userId || data?.userID;
          if (userId) {
            cleanup();
            // Marque la pression comme consommée AVANT de résoudre (anti-rejeu)
            this.getAttendances()
              .then((logs) => {
                if (logs.length > 0) {
                  this.lastConsumedSn = Math.max(
                    this.lastConsumedSn,
                    logs[logs.length - 1].userSn || 0,
                  );
                }
                resolve(String(userId));
              })
              .catch(() => {
                this.lastConsumedSn = Math.max(this.lastConsumedSn, lastLogSn);
                resolve(String(userId));
              });
          }
        });
      } catch (e) {
        this.logger.error('Erreur listener temps réel:', e.message);
      }
    });
  }

  /**
   * Nettoyage à l'arrêt de l'app
   */
  async onModuleDestroy() {
    await this.disconnect();
  }
}
