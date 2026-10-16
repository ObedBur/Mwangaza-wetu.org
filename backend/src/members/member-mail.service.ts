import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MemberMailService {
  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return Boolean(
      this.config.get('MAIL_HOST') &&
        this.config.get('MAIL_USER') &&
        this.config.get('MAIL_PASSWORD') &&
        this.config.get('MAIL_FROM'),
    );
  }

  async sendTemporaryPassword(input: {
    email: string;
    fullName: string;
    accountNumber: string;
    password: string;
  }) {
    const host = this.config.get<string>('MAIL_HOST');
    const user = this.config.get<string>('MAIL_USER');
    const pass = this.config.get<string>('MAIL_PASSWORD');
    const from = this.config.get<string>('MAIL_FROM');
    if (!host || !user || !pass || !from) {
      throw new ServiceUnavailableException(
        "L'envoi d'e-mails n'est pas configuré sur le serveur",
      );
    }

    const port = Number(this.config.get('MAIL_PORT') || 587);
    const secure = this.config.get<string>('MAIL_SECURE') === 'true';
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
    const loginUrl = this.config.get<string>('MEMBER_LOGIN_URL') ||
      `${this.config.get<string>('FRONTEND_URL') || ''}/login`;

    try {
      await transporter.sendMail({
        from,
        to: input.email,
        subject: 'Vos identifiants Mwangaza Wetu',
        text: [
          `Bonjour ${input.fullName},`,
          '',
          'Votre espace membre est prêt.',
          `Numéro de compte : ${input.accountNumber}`,
          `Mot de passe temporaire : ${input.password}`,
          loginUrl ? `Connexion : ${loginUrl}` : '',
          '',
          'Nous vous conseillons de remplacer ce mot de passe après votre première connexion.',
        ].filter(Boolean).join('\n'),
        html: `<p>Bonjour ${escapeHtml(input.fullName)},</p><p>Votre espace membre Mwangaza Wetu est prêt.</p><p><strong>Numéro de compte :</strong> ${escapeHtml(input.accountNumber)}<br><strong>Mot de passe temporaire :</strong> ${escapeHtml(input.password)}</p>${loginUrl ? `<p><a href="${escapeHtml(loginUrl)}">Se connecter</a></p>` : ''}<p>Nous vous conseillons de remplacer ce mot de passe après votre première connexion.</p>`,
      });
    } catch {
      throw new ServiceUnavailableException(
        "L'e-mail contenant les identifiants n'a pas pu être envoyé; le membre n'a pas été créé",
      );
    }
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!);
}
