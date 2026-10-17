ALTER TYPE "StatutRetrait" ADD VALUE 'CANCELLED';

ALTER TABLE "retraits"
  ADD COLUMN "execute_par_id" INTEGER,
  ADD COLUMN "execute_par_role" TEXT,
  ADD COLUMN "annule_le" TIMESTAMP(3),
  ADD COLUMN "annule_par_id" INTEGER,
  ADD COLUMN "annule_par_role" TEXT,
  ADD COLUMN "motif_annulation" TEXT,
  ADD COLUMN "idempotency_key" TEXT;

CREATE UNIQUE INDEX "retraits_idempotency_key_key"
  ON "retraits"("idempotency_key");

CREATE TABLE "caisses_agents" (
  "id" SERIAL NOT NULL,
  "agent_id" INTEGER NOT NULL,
  "devise" "Devise" NOT NULL,
  "solde" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "caisses_agents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "caisses_agents_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "caisses_agents_agent_id_devise_key"
  ON "caisses_agents"("agent_id", "devise");

CREATE TABLE "mouvements_caisses_agents" (
  "id" SERIAL NOT NULL,
  "caisse_id" INTEGER NOT NULL,
  "retrait_id" INTEGER,
  "type" TEXT NOT NULL,
  "devise" "Devise" NOT NULL,
  "montant" DECIMAL(18,2) NOT NULL,
  "solde_avant" DECIMAL(18,2) NOT NULL,
  "solde_apres" DECIMAL(18,2) NOT NULL,
  "motif" TEXT,
  "acteur_id" INTEGER,
  "acteur_role" TEXT,
  "idempotency_key" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mouvements_caisses_agents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mouvements_caisses_agents_caisse_id_fkey" FOREIGN KEY ("caisse_id") REFERENCES "caisses_agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "mouvements_caisses_agents_retrait_id_fkey" FOREIGN KEY ("retrait_id") REFERENCES "retraits"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "mouvements_caisses_agents_caisse_id_created_at_idx"
  ON "mouvements_caisses_agents"("caisse_id", "created_at");
CREATE INDEX "mouvements_caisses_agents_retrait_id_idx"
  ON "mouvements_caisses_agents"("retrait_id");
CREATE UNIQUE INDEX "mouvements_caisses_agents_idempotency_key_key"
  ON "mouvements_caisses_agents"("idempotency_key");

-- Reprise des soldes initiaux déjà configurés sur les comptes agents.
INSERT INTO "caisses_agents" ("agent_id", "devise", "solde")
SELECT "id", 'USD'::"Devise",
       CASE WHEN "devise" = 'USD'::"Devise" THEN "solde_initial" ELSE 0 END
FROM "agents";
INSERT INTO "caisses_agents" ("agent_id", "devise", "solde")
SELECT "id", 'FC'::"Devise",
       CASE WHEN "devise" = 'FC'::"Devise" THEN "solde_initial" ELSE 0 END
FROM "agents";

INSERT INTO "mouvements_caisses_agents"
  ("caisse_id", "type", "devise", "montant", "solde_avant", "solde_apres", "motif")
SELECT "id", 'OUVERTURE', "devise", "solde", 0, "solde",
       'Reprise du solde initial agent lors de la migration'
FROM "caisses_agents"
WHERE "solde" > 0;
