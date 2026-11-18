import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { join } from 'path';
import * as fs from 'fs';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { SecurityHeadersMiddleware } from './middleware/security-headers.middleware';
import { getAllowedOrigins } from './common/config/allowed-origins';

/**
 * Configuration HTTP commune au démarrage réel et aux tests e2e.
 *
 * Extraite de `main.ts` pour que les tests exercent exactement la même
 * chaîne : proxy, en-têtes de sécurité, `no-store` sur l'authentification,
 * limites de corps, CORS, filtre d'exceptions et `ValidationPipe`.
 * Tester une application configurée autrement ne prouverait rien.
 */
export function configureApp(app: NestExpressApplication): void {
  // L'API tourne derrière le proxy de Render (1 hop). Sans ce réglage,
  // req.ip vaut l'IP du load-balancer pour tous les visiteurs : le limiteur
  // de connexion partage alors un seul compteur et peut bloquer la
  // plateforme entière. Ne jamais mettre `true` (X-Forwarded-For spoofable).
  const trustProxy =
    process.env.TRUST_PROXY ||
    (process.env.NODE_ENV === 'production' ? '1' : '');
  if (trustProxy) {
    app.set(
      'trust proxy',
      /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy,
    );
  }

  // En-têtes de sécurité sur toutes les réponses
  const securityHeaders = new SecurityHeadersMiddleware();
  app.use((req, res, next) => securityHeaders.use(req, res, next));

  // Les réponses d'authentification contiennent des données de session et un
  // jeton CSRF : aucun cache navigateur, proxy ou CDN ne doit les conserver.
  app.use('/api/auth', (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    next();
  });

  // Les routes d'authentification n'acceptent que de petits formulaires JSON.
  // Ce parseur est monté avant la limite élevée nécessaire aux photos.
  app.use('/api/auth', json({ limit: '8kb' }));

  // Augmenter la limite de taille pour les photos et empreintes (Base64)
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // Dossier uploads
  const uploadsPath = join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }

  // Pas de setGlobalPrefix car les contrôleurs utilisent déjà 'api/' dans leur décorateur
  // Ex: @Controller('api/membres'), @Controller('api/auth'), etc.

  // Origines autorisées : `http://localhost:5000` n'est ajouté qu'hors
  // production (voir `getAllowedOrigins`).
  const envOrigins = getAllowedOrigins();

  // Activer CORS pour permettre les requêtes depuis le frontend Next.js
  app.enableCors({
    origin: envOrigins,
    credentials: true, // Nécessaire pour envoyer les cookies d'authentification
  });

  // Filtre d'exceptions global pour journaliser et formater les erreurs
  app.useGlobalFilters(new AllExceptionsFilter());

  // Validation automatique des DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Supprime les propriétés non déclarées dans le DTO
      forbidNonWhitelisted: true,
      transform: true, // Convertit automatiquement les types (string → number, etc.)
    }),
  );
}
