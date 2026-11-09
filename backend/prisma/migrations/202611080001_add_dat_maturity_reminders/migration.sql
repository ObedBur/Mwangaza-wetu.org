ALTER TABLE "membres" ADD COLUMN "duree_epargne_mois" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "notifications" ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'all';
ALTER TABLE "notifications" ADD COLUMN "reference" TEXT;
CREATE UNIQUE INDEX "notifications_reference_key" ON "notifications"("reference");
