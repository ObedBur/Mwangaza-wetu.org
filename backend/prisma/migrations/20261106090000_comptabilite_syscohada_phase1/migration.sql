ALTER TYPE "TypeOperationComptable" ADD VALUE IF NOT EXISTS 'DECAISSEMENT_CREDIT';
ALTER TYPE "TypeOperationComptable" ADD VALUE IF NOT EXISTS 'FRAIS_RETRAIT';

ALTER TABLE "membres"
  ADD COLUMN "duree_adhesion_mois" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "date_expiration_adhesion" TIMESTAMP(3);

UPDATE "membres"
SET "date_expiration_adhesion" = "date_adhesion" + INTERVAL '1 month'
WHERE "date_expiration_adhesion" IS NULL;
