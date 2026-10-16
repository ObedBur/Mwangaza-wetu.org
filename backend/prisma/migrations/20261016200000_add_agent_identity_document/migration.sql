ALTER TABLE "agents"
ADD COLUMN "date_naissance" DATE,
ADD COLUMN "numero_carte_electeur" TEXT,
ADD COLUMN "image_carte_electeur" TEXT,
ADD COLUMN "image_carte_electeur_public_id" TEXT;

CREATE UNIQUE INDEX "agents_numero_carte_electeur_key"
ON "agents"("numero_carte_electeur");
