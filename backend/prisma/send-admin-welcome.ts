import * as dotenv from 'dotenv';
import * as nodemailer from 'nodemailer';

dotenv.config();

const recipients = [
  { email: 'obedburindi@gmail.com', role: 'Super administrateur' },
  { email: 'makasimumbere22@gmail.com', role: 'Administrateur' },
  { email: 'kitavulameschack@gmail.com', role: 'Administrateur' },
];

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]!,
  );
}

async function main() {
  const { MAIL_HOST, MAIL_USER, MAIL_PASSWORD, MAIL_FROM } = process.env;
  if (!MAIL_HOST || !MAIL_USER || !MAIL_PASSWORD || !MAIL_FROM) {
    throw new Error(
      'Configuration e-mail absente. Définissez MAIL_HOST, MAIL_USER, MAIL_PASSWORD et MAIL_FROM dans backend/.env.',
    );
  }

  const port = Number(process.env.MAIL_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('MAIL_PORT doit être un port valide.');
  }

  const transporter = nodemailer.createTransport({
    host: MAIL_HOST,
    port,
    secure: process.env.MAIL_SECURE === 'true',
    auth: { user: MAIL_USER, pass: MAIL_PASSWORD },
  });

  const frontendUrl = process.env.FRONTEND_URL?.replace(/\/+$/, '');
  const loginUrl = frontendUrl ? `${frontendUrl}/login` : undefined;

  try {
    const results = await Promise.allSettled(
      recipients.map(({ email, role }) =>
        transporter
          .sendMail({
            from: MAIL_FROM,
            to: email,
            subject: 'Bienvenue dans l’administration de Mwangaza Wetu',
            text: [
              'Bonjour,',
              '',
              `Bienvenue dans votre espace Mwangaza Wetu en tant que ${role.toLowerCase()}.`,
              'Nous sommes heureux de vous compter parmi l’équipe de gestion de la coopérative.',
              loginUrl ? `Accédez à votre espace : ${loginUrl}` : '',
              '',
              'Pour votre sécurité, aucun mot de passe n’est inclus dans ce message.',
              'L’équipe Mwangaza Wetu',
            ]
              .filter(Boolean)
              .join('\n'),
            html: [
              '<p>Bonjour,</p>',
              `<p>Bienvenue dans votre espace Mwangaza Wetu en tant que ${escapeHtml(role.toLowerCase())}.</p>`,
              '<p>Nous sommes heureux de vous compter parmi l’équipe de gestion de la coopérative.</p>',
              loginUrl
                ? `<p><a href="${escapeHtml(loginUrl)}">Accéder à votre espace</a></p>`
                : '',
              '<p>Pour votre sécurité, aucun mot de passe n’est inclus dans ce message.</p>',
              '<p>L’équipe Mwangaza Wetu</p>',
            ]
              .filter(Boolean)
              .join(''),
          })
          .then(() => email),
      ),
    );

    let failed = false;
    for (const [index, result] of results.entries()) {
      if (result.status === 'fulfilled') {
        console.log(`Message de bienvenue envoyé à ${result.value}.`);
      } else {
        failed = true;
        console.error(
          `Échec de l’envoi à ${recipients[index].email}:`,
          result.reason,
        );
      }
    }

    if (failed) {
      throw new Error('Au moins un message de bienvenue n’a pas été envoyé.');
    }
  } finally {
    transporter.close();
  }
}

main().catch((error: unknown) => {
  console.error('Échec du script d’envoi des messages de bienvenue:', error);
  process.exitCode = 1;
});
