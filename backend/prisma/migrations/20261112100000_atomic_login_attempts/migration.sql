BEGIN;

LOCK TABLE "login_attempts" IN ACCESS EXCLUSIVE MODE;

-- Les compteurs expirés ne participent plus à la fenêtre de limitation.
DELETE FROM "login_attempts"
WHERE "first_attempt" < now() - INTERVAL '15 minutes';

-- Fusionne les doublons historiques avant d'imposer une clé unique.
WITH ranked AS (
  SELECT
    "id",
    SUM("count") OVER (PARTITION BY "ip", "identifier")::INTEGER AS merged_count,
    MIN("first_attempt") OVER (PARTITION BY "ip", "identifier") AS merged_first_attempt,
    MAX("updated_at") OVER (PARTITION BY "ip", "identifier") AS merged_updated_at,
    ROW_NUMBER() OVER (
      PARTITION BY "ip", "identifier"
      ORDER BY "updated_at" DESC, "id" DESC
    ) AS row_number
  FROM "login_attempts"
)
UPDATE "login_attempts" AS target
SET
  "count" = ranked.merged_count,
  "first_attempt" = ranked.merged_first_attempt,
  "updated_at" = ranked.merged_updated_at
FROM ranked
WHERE target."id" = ranked."id"
  AND ranked.row_number = 1;

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "ip", "identifier"
      ORDER BY "updated_at" DESC, "id" DESC
    ) AS row_number
  FROM "login_attempts"
)
DELETE FROM "login_attempts" AS target
USING ranked
WHERE target."id" = ranked."id"
  AND ranked.row_number > 1;

CREATE UNIQUE INDEX "login_attempts_ip_identifier_key"
ON "login_attempts"("ip", "identifier");

COMMIT;
