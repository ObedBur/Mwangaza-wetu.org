DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TypeOperationComptable') THEN
    CREATE TYPE "TypeOperationComptable" AS ENUM (
      'ADHESION', 'ABONNEMENT_EPARGNE', 'INTERET_CREDIT',
      'DECAISSEMENT_CREDIT', 'DEPOT_EPARGNE', 'RETRAIT_EPARGNE',
      'FRAIS_RETRAIT', 'CONTREPASSATION', 'AJUSTEMENT'
    );
  END IF;
END $$;

ALTER TYPE "TypeOperationComptable" ADD VALUE IF NOT EXISTS 'DECAISSEMENT_CREDIT';
ALTER TYPE "TypeOperationComptable" ADD VALUE IF NOT EXISTS 'FRAIS_RETRAIT';

ALTER TABLE "membres"
  ADD COLUMN "duree_adhesion_mois" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "date_expiration_adhesion" TIMESTAMP(3);

UPDATE "membres"
SET "date_expiration_adhesion" = "date_adhesion" + INTERVAL '1 month'
WHERE "date_expiration_adhesion" IS NULL;
