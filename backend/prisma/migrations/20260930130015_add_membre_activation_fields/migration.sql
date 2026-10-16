/*
  Warnings:

  - You are about to alter the column `solde` on the `comptes_epargne` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `montant` on the `credits` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `montant_rembourse` on the `credits` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `taux_interet` on the `credits` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `montant` on the `epargnes` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `montant` on the `remboursements` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `montant` on the `retraits` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `solde_avant` on the `retraits` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `solde_apres` on the `retraits` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `frais` on the `retraits` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `solde` on the `sections` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - A unique constraint covering the columns `[telephone]` on the table `membres` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `membres` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[idempotency_key]` on the table `remboursements` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[reference]` on the table `retraits` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updated_at` to the `remboursements` table without a default value. This is not possible if the table is not empty.
  - The required column `reference` was added to the `retraits` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- CreateEnum
CREATE TYPE "StatutRetrait" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- DropForeignKey
ALTER TABLE "remboursements" DROP CONSTRAINT "remboursements_credit_id_fkey";

-- AlterTable
ALTER TABLE "administrateurs" ADD COLUMN     "photo_profil" TEXT;

-- AlterTable
ALTER TABLE "comptes_epargne" ALTER COLUMN "solde" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "credits" ADD COLUMN     "derniere_operation" TIMESTAMP(3),
ALTER COLUMN "montant" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "montant_rembourse" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "taux_interet" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "epargnes" ADD COLUMN     "remboursement_id" INTEGER,
ALTER COLUMN "montant" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "membres" ADD COLUMN     "activation_expires" TIMESTAMP(3),
ADD COLUMN     "activation_token" TEXT,
ADD COLUMN     "first_acces" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_activated" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "remboursements" ADD COLUMN     "delete_reason" TEXT,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "idempotency_key" TEXT,
ADD COLUMN     "part_interet" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "part_principal" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "montant" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "retraits" ADD COLUMN     "reference" TEXT NOT NULL,
ADD COLUMN     "statut" "StatutRetrait" NOT NULL DEFAULT 'COMPLETED',
ALTER COLUMN "montant" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "solde_avant" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "solde_apres" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "frais" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "sections" ALTER COLUMN "solde" SET DATA TYPE DECIMAL(18,2);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" SERIAL NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uid" TEXT NOT NULL,
    "membreId" INTEGER,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenu_types" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "revenu_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenus" (
    "id" SERIAL NOT NULL,
    "type_compte" TEXT NOT NULL,
    "type_revenu_id" INTEGER NOT NULL,
    "montant" DECIMAL(18,2) NOT NULL,
    "devise" "Devise" NOT NULL,
    "date_operation" TIMESTAMP(3) NOT NULL,
    "source_compte" TEXT,
    "remboursement_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revenus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "membre_id" INTEGER,
    "admin_id" INTEGER,
    "titre" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "revenu_types_nom_key" ON "revenu_types"("nom");

-- CreateIndex
CREATE INDEX "revenus_remboursement_id_idx" ON "revenus"("remboursement_id");

-- CreateIndex
CREATE INDEX "revenus_date_operation_idx" ON "revenus"("date_operation");

-- CreateIndex
CREATE INDEX "notifications_admin_id_idx" ON "notifications"("admin_id");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "notifications_membre_id_idx" ON "notifications"("membre_id");

-- CreateIndex
CREATE INDEX "epargnes_remboursement_id_idx" ON "epargnes"("remboursement_id");

-- CreateIndex
CREATE INDEX "epargnes_date_operation_idx" ON "epargnes"("date_operation");

-- CreateIndex
CREATE UNIQUE INDEX "membres_telephone_key" ON "membres"("telephone");

-- CreateIndex
CREATE UNIQUE INDEX "membres_email_key" ON "membres"("email");

-- CreateIndex
CREATE UNIQUE INDEX "remboursements_idempotency_key_key" ON "remboursements"("idempotency_key");

-- CreateIndex
CREATE INDEX "remboursements_credit_id_idx" ON "remboursements"("credit_id");

-- CreateIndex
CREATE INDEX "remboursements_date_remboursement_idx" ON "remboursements"("date_remboursement");

-- CreateIndex
CREATE INDEX "remboursements_deleted_at_idx" ON "remboursements"("deleted_at");

-- CreateIndex
CREATE INDEX "remboursements_idempotency_key_idx" ON "remboursements"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "retraits_reference_key" ON "retraits"("reference");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_membreId_fkey" FOREIGN KEY ("membreId") REFERENCES "membres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epargnes" ADD CONSTRAINT "epargnes_remboursement_id_fkey" FOREIGN KEY ("remboursement_id") REFERENCES "remboursements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remboursements" ADD CONSTRAINT "remboursements_credit_id_fkey" FOREIGN KEY ("credit_id") REFERENCES "credits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenus" ADD CONSTRAINT "revenus_remboursement_id_fkey" FOREIGN KEY ("remboursement_id") REFERENCES "remboursements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenus" ADD CONSTRAINT "revenus_type_revenu_id_fkey" FOREIGN KEY ("type_revenu_id") REFERENCES "revenu_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "administrateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_membre_id_fkey" FOREIGN KEY ("membre_id") REFERENCES "membres"("id") ON DELETE CASCADE ON UPDATE CASCADE;
