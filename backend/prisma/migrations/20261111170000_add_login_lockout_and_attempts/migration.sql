-- Verrouillage de compte après N échecs de connexion
ALTER TABLE "membres"
ADD COLUMN "login_failures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "locked_until" TIMESTAMP;

ALTER TABLE "administrateurs"
ADD COLUMN "login_failures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "locked_until" TIMESTAMP;

ALTER TABLE "agents"
ADD COLUMN "login_failures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "locked_until" TIMESTAMP;

-- Table de suivi des tentatives de connexion (rate limiting persistant)
CREATE TABLE "login_attempts" (
    "id" SERIAL PRIMARY KEY,
    "ip" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "first_attempt" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX "login_attempts_ip_identifier_idx" ON "login_attempts"("ip", "identifier");
