/**
 * Origines autorisées pour CORS et le limiteur de connexion.
 *
 * `FRONTEND_URL` accepte une liste séparée par des virgules. Le frontend de
 * développement (`http://localhost:5000`) n'est ajouté QUE hors production :
 * en production, une origine locale ne doit jamais être acceptée, même si
 * `FRONTEND_URL` est mal renseigné ou absent. Dans ce dernier cas on échoue
 * au démarrage plutôt que de retomber silencieusement sur localhost.
 */
export const LOCAL_FRONTEND_ORIGIN = 'http://localhost:5000';

export function getAllowedOrigins(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const origins = (env.FRONTEND_URL ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);

  const isProduction = env.NODE_ENV === 'production';

  if (isProduction) {
    if (origins.length === 0) {
      throw new Error(
        'FRONTEND_URL must list at least one origin in production.',
      );
    }
    return origins;
  }

  if (!origins.includes(LOCAL_FRONTEND_ORIGIN)) {
    origins.push(LOCAL_FRONTEND_ORIGIN);
  }
  return origins;
}
