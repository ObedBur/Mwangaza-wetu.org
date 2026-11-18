import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from 'dotenv';

/**
 * Amorçage des tests e2e.
 *
 * Objectif : rendre les e2e possibles sans jamais toucher la base distante.
 * - On charge `backend/.env.test.local` (gitignoré) puis `.env.test`.
 * - Si `DATABASE_URL` n'est pas locale, on marque les tests comme ignorés
 *   au lieu de laisser Prisma se connecter à la production.
 * - `NODE_ENV=test` évite l'exigence de `REDIS_URL` (le module Redis bascule
 *   alors sur son cache mémoire).
 */
const backendRoot = join(__dirname, '..');

for (const file of ['.env.test.local', '.env.test']) {
  const path = join(backendRoot, file);
  if (existsSync(path)) {
    config({ path, override: false });
  }
}

process.env.NODE_ENV = 'test';

function isLocalDatabaseUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  } catch {
    return false;
  }
}

if (!isLocalDatabaseUrl(process.env.DATABASE_URL)) {
  process.env.E2E_SKIP = '1';
  // Message unique et explicite : un e2e ignoré ne doit pas ressembler à un
  // succès silencieux.
  console.warn(
    '[e2e] DATABASE_URL locale absente : tests e2e ignorés. ' +
      'Copiez backend/.env.test.example vers backend/.env.test.local ' +
      'et pointez une base PostgreSQL locale.',
  );
} else {
  delete process.env.E2E_SKIP;
  process.env.JWT_SECRET ??=
    'e2e-only-secret-value-with-at-least-32-characters';
  process.env.FRONTEND_URL ??= 'http://localhost:5000';
  // Le limiteur écrit dans Postgres : on garde une petite marge pour les
  // rafales des tests sans dépendre de Redis.
  process.env.TRUST_PROXY ??= '';
}
