/**
 * Jeton d'injection du client Redis.
 *
 * Ce symbole vit dans son propre fichier : le déclarer dans `redis.module.ts`
 * créait un import circulaire (module → services → module) et Nest refusait
 * alors de compiler le graphe d'injection.
 */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
