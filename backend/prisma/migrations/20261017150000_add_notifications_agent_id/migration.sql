-- Notifications ciblant un agent de guichet.
-- Convention de portée :
--   membre_id != NULL  -> notification pour CE membre
--   agent_id  != NULL  -> notification POUR CET agent
--   les deux NULL      -> diffusion générale (membres ET agents)
ALTER TABLE "notifications" ADD COLUMN "agent_id" INTEGER;

CREATE INDEX "notifications_agent_id_idx" ON "notifications"("agent_id");

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "agents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
