-- CreateTable
CREATE TABLE "agents" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "guichet_assigne" TEXT NOT NULL,
    "solde_initial" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "devise" "Devise" NOT NULL DEFAULT 'USD',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "mot_de_passe" TEXT,
    "userId" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agents_email_key" ON "agents"("email");

-- CreateIndex
CREATE UNIQUE INDEX "agents_userId_key" ON "agents"("userId");
