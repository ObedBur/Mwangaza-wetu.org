// prisma.config.ts — Prisma v7 configuration
import * as fs from "fs";
import * as path from "path";

// Charge le .env manuellement (compatible CJS et ESM, sans dépendance externe)
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) process.env[key] = val;
  }
}

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "ts-node prisma/seed.ts",
  },
  datasource: {
    // Les commandes migrate nécessitent la connexion PostgreSQL directe ;
    // l’application peut continuer à utiliser DATABASE_URL (pool/accelerate).
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
