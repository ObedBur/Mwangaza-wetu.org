-- Trace teller identity on cash operations and invalidate agent JWTs after
-- password changes. Cash movement references are intentionally not foreign
-- keys so the audit trail survives operational record corrections.
ALTER TABLE "agents"
ADD COLUMN "auth_version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "epargnes"
ADD COLUMN "execute_par_id" INTEGER,
ADD COLUMN "execute_par_role" TEXT;

ALTER TABLE "remboursements"
ADD COLUMN "execute_par_id" INTEGER,
ADD COLUMN "execute_par_role" TEXT;

ALTER TABLE "mouvements_caisses_agents"
ADD COLUMN "epargne_id" INTEGER,
ADD COLUMN "remboursement_id" INTEGER;

CREATE INDEX "mouvements_caisses_agents_epargne_id_idx"
ON "mouvements_caisses_agents"("epargne_id");

CREATE INDEX "mouvements_caisses_agents_remboursement_id_idx"
ON "mouvements_caisses_agents"("remboursement_id");
