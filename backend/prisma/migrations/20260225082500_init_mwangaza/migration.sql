-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'superadmin');

-- CreateEnum
CREATE TYPE "Sexe" AS ENUM ('M', 'F');

-- CreateEnum
CREATE TYPE "StatutMembre" AS ENUM ('actif', 'inactif');

-- CreateEnum
CREATE TYPE "TypeOperationEpargne" AS ENUM ('depot', 'retrait');

-- CreateEnum
CREATE TYPE "Devise" AS ENUM ('FC', 'USD');

-- CreateEnum
CREATE TYPE "StatutCredit" AS ENUM ('actif', 'rembourse', 'en_retard');

-- CreateTable
CREATE TABLE "membres" (
    "id" SERIAL NOT NULL,
    "numero_compte" TEXT NOT NULL,
    "nom_complet" TEXT NOT NULL,
    "date_adhesion" TIMESTAMP(3) NOT NULL,
    "telephone" TEXT NOT NULL,
    "email" TEXT,
    "adresse" TEXT,
    "sexe" "Sexe",
    "type_compte" TEXT NOT NULL,
    "statut" "StatutMembre" NOT NULL DEFAULT 'actif',
    "photo_profil" TEXT,
    "userId" TEXT,
    "mot_de_passe" TEXT,
    "date_naissance" TIMESTAMP(3),
    "id_nationale" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "administrateurs" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "mot_de_passe" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'admin',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "numero_compte" TEXT,
    "userId" TEXT,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "administrateurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delegues" (
    "id" SERIAL NOT NULL,
    "membre_id" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "piece_identite" TEXT,
    "userId" TEXT,
    "photo_profil" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delegues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "numero_compte" TEXT NOT NULL,
    "solde" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comptes_epargne" (
    "id" SERIAL NOT NULL,
    "numero_compte" TEXT NOT NULL,
    "type_compte" TEXT NOT NULL,
    "solde" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "date_ouverture" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "statut" TEXT DEFAULT 'actif',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comptes_epargne_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "epargnes" (
    "id" SERIAL NOT NULL,
    "compte" TEXT NOT NULL,
    "type_operation" "TypeOperationEpargne" NOT NULL,
    "devise" "Devise" NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "date_operation" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "epargnes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retraits" (
    "id" SERIAL NOT NULL,
    "compte" TEXT NOT NULL,
    "devise" "Devise" NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "date_operation" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "solde_avant" DOUBLE PRECISION NOT NULL,
    "solde_apres" DOUBLE PRECISION NOT NULL,
    "frais" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retraits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credits" (
    "id" SERIAL NOT NULL,
    "numero_compte" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "montant_rembourse" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "devise" TEXT NOT NULL,
    "taux_interet" DOUBLE PRECISION NOT NULL,
    "duree" INTEGER NOT NULL,
    "date_debut" TIMESTAMP(3) NOT NULL,
    "date_echeance" TIMESTAMP(3),
    "statut" "StatutCredit" NOT NULL DEFAULT 'actif',
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remboursements" (
    "id" SERIAL NOT NULL,
    "credit_id" INTEGER NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "devise" TEXT NOT NULL,
    "date_remboursement" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "remboursements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametres_epargne" (
    "id" SERIAL NOT NULL,
    "nom_parametre" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,
    "description" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parametres_epargne_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_confirmations" (
    "id" SERIAL NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "confirmation_code" TEXT NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_logs" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "success" BOOLEAN NOT NULL,
    "user_id" INTEGER,
    "ip_address" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "membres_numero_compte_key" ON "membres"("numero_compte");

-- CreateIndex
CREATE UNIQUE INDEX "administrateurs_email_key" ON "administrateurs"("email");

-- CreateIndex
CREATE UNIQUE INDEX "administrateurs_numero_compte_key" ON "administrateurs"("numero_compte");

-- CreateIndex
CREATE UNIQUE INDEX "administrateurs_userId_key" ON "administrateurs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "sections_nom_key" ON "sections"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "sections_numero_compte_key" ON "sections"("numero_compte");

-- CreateIndex
CREATE UNIQUE INDEX "comptes_epargne_numero_compte_type_compte_key" ON "comptes_epargne"("numero_compte", "type_compte");

-- CreateIndex
CREATE UNIQUE INDEX "parametres_epargne_nom_parametre_key" ON "parametres_epargne"("nom_parametre");

-- AddForeignKey
ALTER TABLE "delegues" ADD CONSTRAINT "delegues_membre_id_fkey" FOREIGN KEY ("membre_id") REFERENCES "membres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comptes_epargne" ADD CONSTRAINT "comptes_epargne_numero_compte_fkey" FOREIGN KEY ("numero_compte") REFERENCES "membres"("numero_compte") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epargnes" ADD CONSTRAINT "epargnes_compte_fkey" FOREIGN KEY ("compte") REFERENCES "membres"("numero_compte") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retraits" ADD CONSTRAINT "retraits_compte_fkey" FOREIGN KEY ("compte") REFERENCES "membres"("numero_compte") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credits" ADD CONSTRAINT "credits_numero_compte_fkey" FOREIGN KEY ("numero_compte") REFERENCES "membres"("numero_compte") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remboursements" ADD CONSTRAINT "remboursements_credit_id_fkey" FOREIGN KEY ("credit_id") REFERENCES "credits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
