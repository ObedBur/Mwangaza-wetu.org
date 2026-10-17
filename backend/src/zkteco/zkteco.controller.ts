import { ADMIN_ROLES, Roles } from '../common/decorators/roles.decorator';
import {
  Controller,
  Get,
  Post,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ZktecoService } from './zkteco.service';
import { SyncService } from './sync/sync.service';

@Roles(...ADMIN_ROLES)
@Controller('api/zkteco')
export class ZktecoController {
  constructor(
    private readonly zkteco: ZktecoService,
    private readonly syncService: SyncService, // Renommé pour éviter le conflit
  ) {}

  @Post('connect')
  async connect() {
    await this.zkteco.connect();
    return { message: "Connecté à l'appareil" };
  }

  @Post('disconnect')
  async disconnect() {
    await this.zkteco.disconnect();
    return { message: 'Déconnecté' };
  }

  @Get('users')
  async getUsers() {
    const users = await this.zkteco.getUsers();
    return users;
  }

  @Get('attendances')
  async getAttendances() {
    const attendances = await this.zkteco.getAttendances();
    return attendances;
  }

  @Post('sync')
  async sync() {
    await this.syncService.syncAllAttendances();
    return { message: 'Synchronisation lancée' };
  }

  @Post('clear')
  async clear() {
    await this.zkteco.clearAttendance();
    return { message: 'Logs effacés' };
  }

  @Post('realtime/start')
  async startRealtime() {
    // Note: cette méthode est bloquante, à exécuter avec précaution
    // Idéalement, on la lance au démarrage de l'application
    await this.syncService.startRealTimeListener();
    return { message: 'Écoute temps réel démarrée' };
  }

  @Post('capture-fingerprint')
  @Roles(...ADMIN_ROLES, 'agent')
  async captureFingerprint() {
    try {
      // Timeout piloté par ZKTECO_CAPTURE_TIMEOUT (défaut 30 s)
      const userId = await this.zkteco.captureFingerprint();
      return {
        userId,
        // Horodatage serveur : l'horloge de l'appareil est non fiable (RTC)
        capturedAt: new Date().toISOString(),
        message: 'Empreinte capturée avec succès',
      };
    } catch (error: any) {
      // Capture déjà en cours (single-flight : 1 appareil = 1 fenêtre)
      if (error?.message === 'CAPTURE_IN_FLIGHT') {
        throw new HttpException(
          {
            message:
              'Une capture est déjà en cours : attendez qu’elle se termine',
          },
          HttpStatus.CONFLICT,
        );
      }
      // Fournir un message d'erreur clair au frontend
      const errorMessage =
        error?.message || "Erreur lors de la capture d'empreinte";
      throw new HttpException(
        {
          message: errorMessage,
          details: `Vérifiez que l'appareil ZKTeco est allumé et connecté au réseau (${this.zkteco.deviceAddress})`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
