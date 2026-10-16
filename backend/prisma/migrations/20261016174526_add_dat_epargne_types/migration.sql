-- CreateEnum
CREATE TYPE "StatutDat" AS ENUM ('OUVERT', 'ECHEANCE', 'CLOTURE', 'ANNULE');

-- AlterTable
ALTER TABLE "epargnes" ADD COLUMN     "type_compte" TEXT NOT NULL DEFAULT 'PRINCIPAL';

-- CreateTable
CREATE TABLE "dats" (
    "id" SERIAL NOT NULL,
    "numero_compte" TEXT NOT NULL,
    "devise" "Devise" NOT NULL,
    "capital" DECIMAL(18,2) NOT NULL,
    "taux_periode" DECIMAL(8,4) NOT NULL,
    "duree_mois" INTEGER NOT NULL,
    "base_jours" INTEGER NOT NULL,
    "gain" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "date_ouverture" TIMESTAMP(3) NOT NULL,
    "date_echeance" TIMESTAMP(3) NOT NULL,
    "statut" "StatutDat" NOT NULL DEFAULT 'OUVERT',
    "motif" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dats_numero_compte_statut_idx" ON "dats"("numero_compte", "statut");

-- CreateIndex
CREATE INDEX "dats_date_echeance_idx" ON "dats"("date_echeance");

-- CreateIndex
CREATE INDEX "epargnes_compte_type_compte_idx" ON "epargnes"("compte", "type_compte");

-- AddForeignKey
ALTER TABLE "dats" ADD CONSTRAINT "dats_numero_compte_fkey" FOREIGN KEY ("numero_compte") REFERENCES "membres"("numero_compte") ON DELETE RESTRICT ON UPDATE CASCADE;
