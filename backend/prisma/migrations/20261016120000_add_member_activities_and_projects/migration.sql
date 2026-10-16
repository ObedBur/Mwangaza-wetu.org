CREATE TYPE "StatutProjet" AS ENUM ('PLANIFIE', 'EN_COURS', 'TERMINE', 'ANNULE');

ALTER TABLE "membres" ADD COLUMN "activite" TEXT;

CREATE TABLE "projets" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "categorie" TEXT NOT NULL,
    "date_debut" TIMESTAMP(3) NOT NULL,
    "date_fin" TIMESTAMP(3),
    "budget" DECIMAL(18,2),
    "devise" "Devise",
    "statut" "StatutProjet" NOT NULL DEFAULT 'PLANIFIE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "projets_statut_idx" ON "projets"("statut");
CREATE INDEX "projets_categorie_idx" ON "projets"("categorie");
CREATE INDEX "projets_date_debut_idx" ON "projets"("date_debut");
