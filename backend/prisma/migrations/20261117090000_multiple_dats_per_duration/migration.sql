-- Link every ledger movement to the specific DAT it belongs to. The active
-- duration rule is serialized by locking the owning member during opening.
ALTER TABLE "epargnes"
ADD COLUMN "dat_id" INTEGER;

ALTER TABLE "epargnes"
ADD CONSTRAINT "epargnes_dat_id_fkey"
FOREIGN KEY ("dat_id") REFERENCES "dats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "epargnes_dat_id_idx" ON "epargnes"("dat_id");

