CREATE TABLE "zkteco_commands" (
    "id" TEXT NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "payload" JSONB,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "zkteco_commands_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "zkteco_commands_status_created_at_idx"
    ON "zkteco_commands"("status", "created_at");
