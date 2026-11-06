/**
 * Test Cloudinary — vérifie que les identifiants .env sont valides.
 * Usage : cd backend && bun run test-cloudinary.ts
 */
import { v2 as cloudinary } from 'cloudinary';
import * as dotenv from 'dotenv';

dotenv.config();

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

console.log('─────────────────────────────────────');
console.log('🔍 Test connexion Cloudinary');
console.log('─────────────────────────────────────');
console.log(`  Cloud Name : ${cloudName}`);
console.log(`  API Key    : ${apiKey}`);
console.log(`  API Secret : ${apiSecret ? apiSecret.slice(0, 6) + '...' + apiSecret.slice(-4) : '⚠️ MANQUANT'}`);
console.log('─────────────────────────────────────\n');

if (!cloudName || !apiKey || !apiSecret) {
  console.error('❌ Variables CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY ou CLOUDINARY_API_SECRET manquantes');
  process.exit(1);
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

async function main() {
  try {
    console.log('⏳ Vérification des identifiants Cloudinary (appel API ping)...');
    const result = await cloudinary.api.ping();
    console.log(`✅ Cloudinary OK ! Réponse : ${result.status}\n`);

    // Infos du compte
    console.log('⏳ Récupération des infos du compte...');
    const usage = await cloudinary.api.usage();
    console.log(`📊 Plan          : ${usage.plan}`);
    console.log(`📦 Stockage      : ${(usage.storage.usage / 1024 / 1024).toFixed(1)} Mo / ${(usage.storage.limit / 1024 / 1024).toFixed(0)} Mo`);
    console.log(`🖼️  Images        : ${usage.resources ?? 'N/A'}`);
    console.log(`📤 Transformations: ${usage.transformations?.usage ?? 'N/A'} / ${usage.transformations?.limit ?? 'N/A'}`);
    console.log('');
  } catch (error: any) {
    console.error('❌ Échec Cloudinary :', error.message);
    if (error.message?.includes('Invalid API Key')) {
      console.error('   → CLOUDINARY_API_KEY est incorrect.');
    } else if (error.message?.includes('invalid signature')) {
      console.error('   → CLOUDINARY_API_SECRET est incorrect.');
    } else if (error.message?.includes('unknown cloud')) {
      console.error('   → CLOUDINARY_CLOUD_NAME est incorrect.');
    }
    process.exit(1);
  }
}

main();

