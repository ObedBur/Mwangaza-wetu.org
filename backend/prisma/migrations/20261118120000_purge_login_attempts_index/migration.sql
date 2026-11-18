-- Index de purge : le service de nettoyage supprime les tentatives dont
-- "updated_at" est antérieur à la fenêtre de rétention.
CREATE INDEX "login_attempts_updated_at_idx" ON "login_attempts"("updated_at");
