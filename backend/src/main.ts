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

  const uploadsPath = join(process.cwd(), 'uploads');
  const files = fs.readdirSync(uploadsPath);
  console.log(
    `\n🚀 Backend Mwangaza Wetu démarré sur le port ${port} (0.0.0.0)`,
  );
  console.log(`📂 Dossier uploads : ${uploadsPath} (${files.length} fichiers)`);
  if (files.length > 0)
    console.log(`📄 Dernier fichier : ${files[files.length - 1]}`);
  console.log(`🌐 Accès images : http://localhost:${port}/uploads/...\n`);
}
void bootstrap();
