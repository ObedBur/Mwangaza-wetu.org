-- Revoke all existing member sessions after a password change.
ALTER TABLE "membres"
ADD COLUMN "auth_version" INTEGER NOT NULL DEFAULT 0;

CREATE TYPE "SupportTicketCategory" AS ENUM (
  'COMPTE', 'EPARGNE', 'CREDIT', 'TECHNIQUE', 'AUTRE'
);

CREATE TYPE "SupportTicketStatus" AS ENUM (
  'OUVERT', 'EN_COURS', 'ATTENTE_MEMBRE', 'RESOLU', 'FERME'
);

CREATE TABLE "support_tickets" (
  "id" SERIAL NOT NULL,
  "reference" TEXT NOT NULL,
  "membre_id" INTEGER NOT NULL,
  "sujet" VARCHAR(120) NOT NULL,
  "categorie" "SupportTicketCategory" NOT NULL DEFAULT 'AUTRE',
  "statut" "SupportTicketStatus" NOT NULL DEFAULT 'OUVERT',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "support_ticket_messages" (
  "id" SERIAL NOT NULL,
  "ticket_id" INTEGER NOT NULL,
  "auteur_id" INTEGER NOT NULL,
  "auteur_role" VARCHAR(20) NOT NULL,
  "message" VARCHAR(3000) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "support_tickets_reference_key" ON "support_tickets"("reference");
CREATE INDEX "support_tickets_membre_id_created_at_idx" ON "support_tickets"("membre_id", "created_at");
CREATE INDEX "support_tickets_statut_updated_at_idx" ON "support_tickets"("statut", "updated_at");
CREATE INDEX "support_ticket_messages_ticket_id_created_at_idx" ON "support_ticket_messages"("ticket_id", "created_at");

ALTER TABLE "support_tickets"
ADD CONSTRAINT "support_tickets_membre_id_fkey"
FOREIGN KEY ("membre_id") REFERENCES "membres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_ticket_messages"
ADD CONSTRAINT "support_ticket_messages_ticket_id_fkey"
FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
