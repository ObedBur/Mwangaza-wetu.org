-- Fenêtre glissante des échecs de connexion.
-- Le compteur ne s'accumule plus indéfiniment : il repart à zéro quand la
-- fenêtre est dépassée, et le verrou expiré remet le compte à neuf.
ALTER TABLE "membres"
ADD COLUMN "login_failures_since" TIMESTAMP;

ALTER TABLE "administrateurs"
ADD COLUMN "login_failures_since" TIMESTAMP;

ALTER TABLE "agents"
ADD COLUMN "login_failures_since" TIMESTAMP;
