import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';
import { join } from 'path';
import * as fs from 'fs';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  const envOrigins = (process.env.FRONTEND_URL || 'http://localhost:5000')
    .split(',')
    .map((origin) => origin.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);

  if (!envOrigins.includes('http://localhost:5000')) {
    envOrigins.push('http://localhost:5000');
  }

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

  const port = process.env.PORT ?? 4000;
  await app.listen(port);

  const files = fs.readdirSync(uploadsPath);
  console.log(
    `\n🚀 Backend Mwangaza Wetu démarré sur : http://localhost:${port}`,
  );
  console.log(`📂 Dossier uploads : ${uploadsPath} (${files.length} fichiers)`);
  if (files.length > 0)
    console.log(`📄 Dernier fichier : ${files[files.length - 1]}`);
  console.log(`🌐 Accès images : http://localhost:${port}/uploads/...\n`);
}
void bootstrap();
