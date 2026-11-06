/**
 * Test de connexion SMTP Brevo — vérifie que les identifiants .env sont valides.
 * Usage : cd backend && bun run test-smtp.ts
 */
import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';

dotenv.config();

const host = process.env.MAIL_HOST;
const port = Number(process.env.MAIL_PORT || 587);
const user = process.env.MAIL_USER;
const pass = process.env.MAIL_PASSWORD;

console.log('─────────────────────────────────────');
console.log('🔍 Test connexion SMTP Brevo');
console.log('─────────────────────────────────────');
console.log(`  Host     : ${host}`);
console.log(`  Port     : ${port}`);
console.log(`  User     : ${user}`);
console.log(`  Password : ${pass ? pass.slice(0, 12) + '...' + pass.slice(-6) : '⚠️ MANQUANT'}`);
console.log('─────────────────────────────────────\n');

if (!host || !user || !pass) {
  console.error('❌ Variables MAIL_HOST, MAIL_USER ou MAIL_PASSWORD manquantes dans .env');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: false,
  auth: { user, pass },
});

async function main() {
  try {
    // Étape 1 : Vérifier l'authentification SMTP (ne envoie rien)
    console.log('⏳ Connexion au serveur SMTP...');
    await transporter.verify();
    console.log('✅ Authentification SMTP réussie ! Les identifiants Brevo sont valides.\n');

    // Étape 2 (optionnel) : Envoyer un e-mail de test
    const testEmail = process.argv[2];
    if (testEmail) {
      console.log(`📧 Envoi d'un e-mail de test à ${testEmail}...`);
      const info = await transporter.sendMail({
        from: process.env.MAIL_FROM || `Test <${user}>`,
        to: testEmail,
        subject: '✅ Test SMTP Mwangaza Wetu',
        text: 'Si vous recevez cet e-mail, la configuration SMTP Brevo est fonctionnelle !',
        html: '<h2>✅ Test réussi</h2><p>La configuration SMTP Brevo de <strong>Mwangaza Wetu</strong> fonctionne correctement.</p>',
      });
      console.log(`✅ E-mail envoyé ! Message ID : ${info.messageId}\n`);
    } else {
      console.log('💡 Pour envoyer un e-mail de test :');
      console.log('   bun run test-smtp.ts votre@email.com\n');
    }
  } catch (error: any) {
    console.error('❌ Échec de la connexion SMTP :', error.message);
    if (error.responseCode === 535) {
      console.error('   → Identifiants (MAIL_USER / MAIL_PASSWORD) incorrects.');
    }
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      console.error('   → Le serveur SMTP est injoignable (pare-feu / réseau ?).');
    }
    process.exit(1);
  }
}

main();

