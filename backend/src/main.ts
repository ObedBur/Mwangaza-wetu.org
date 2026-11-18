import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { join } from 'path';
import * as fs from 'fs';
import { configureApp } from './configure-app';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);

  const port = process.env.PORT ?? 4000;
  await app.listen(port, "0.0.0.0");

  console.log(`\n🚀 Backend Mwangaza Wetu démarré sur le port ${port}.`);
  console.log('📂 Stockage des fichiers prêt.\n');
}
void bootstrap();
