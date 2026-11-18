import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

/** Contexte commun à tous les événements d'authentification. */
export interface LoginAuditContext {
  ip?: string | null;
  /** Identifiant saisi (email, téléphone, numéro de compte). Jamais journalisé en clair. */
  identifier?: string | null;
}

export type LoginAuditRole = 'admin' | 'superadmin' | 'agent' | 'member';

/**
 * Journal d'audit des événements d'authentification.
 *
 * Les journaux sont volontairement best-effort : une panne de la table
 * `admin_logs` ne doit jamais empêcher une connexion légitime ni transformer
 * un échec d'authentification en erreur 500. En contrepartie, l'absence de
 * ligne doit être surveillée (voir `AuthAuditService` dans les métriques).
 *
 * Confidentialité : on ne stocke jamais l'email, le téléphone ou le mot de
 * passe. L'identifiant saisi est réduit à une empreinte SHA-256 tronquée qui
 * permet de corréler des tentatives sans permettre de retrouver la valeur.
 */
@Injectable()
export class AuthAuditService {
  private readonly logger = new Logger(AuthAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  private fingerprint(identifier?: string | null): string | null {
    if (!identifier) return null;
    return createHash('sha256')
      .update(identifier.trim().toLowerCase())
      .digest('hex')
      .slice(0, 16);
  }

  private async write(entry: {
    action: string;
    details: string;
    success: boolean;
    userId?: number | null;
    ipAddress?: string | null;
  }): Promise<void> {
    try {
      await this.prisma.adminLog.create({
        data: {
          action: entry.action,
          details: entry.details,
          success: entry.success,
          userId: entry.userId ?? null,
          ipAddress: entry.ipAddress ?? null,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Événement d'audit ${entry.action} non journalisé : ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async loginSucceeded(
    role: LoginAuditRole,
    userId: number,
    context: LoginAuditContext = {},
  ): Promise<void> {
    await this.write({
      action: 'LOGIN_SUCCESS',
      details: `Connexion réussie (rôle ${role}, compte #${userId}).`,
      success: true,
      userId,
      ipAddress: context.ip,
    });
  }

  async loginFailed(
    role: LoginAuditRole | null,
    userId: number | null,
    context: LoginAuditContext = {},
    reason = 'identifiants_invalides',
  ): Promise<void> {
    const target =
      role && userId ? `rôle ${role}, compte #${userId}` : 'compte inconnu';
    const fingerprint = this.fingerprint(context.identifier);
    await this.write({
      action: 'LOGIN_FAILED',
      details:
        `Échec de connexion (${target}, motif : ${reason}` +
        `${fingerprint ? `, identifiant ${fingerprint}` : ''}).`,
      success: false,
      userId,
      ipAddress: context.ip,
    });
  }

  async accountLocked(
    role: LoginAuditRole,
    userId: number,
    context: LoginAuditContext = {},
  ): Promise<void> {
    const fingerprint = this.fingerprint(context.identifier);
    await this.write({
      action: 'ACCOUNT_LOCKED',
      details:
        `Compte verrouillé après trop d'échecs (rôle ${role}, compte #${userId}` +
        `${fingerprint ? `, identifiant ${fingerprint}` : ''}).`,
      success: false,
      userId,
      ipAddress: context.ip,
    });
  }

  async logout(
    role: string | null,
    userId: number | null,
    context: LoginAuditContext = {},
  ): Promise<void> {
    if (!userId) return;
    await this.write({
      action: 'LOGOUT',
      details: `Déconnexion (rôle ${role ?? 'inconnu'}, compte #${userId}).`,
      success: true,
      userId,
      ipAddress: context.ip,
    });
  }
}
