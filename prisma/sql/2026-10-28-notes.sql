-- Payment notes and the transactions attached to them. Additive only; safe to
-- run more than once. Same names Prisma would generate, so `db push` sees no drift.
CREATE TABLE IF NOT EXISTS "notes" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "note_transactions" (
    "note_id" INTEGER NOT NULL,
    "transaction_id" INTEGER NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_transactions_pkey" PRIMARY KEY ("note_id","transaction_id"),
    CONSTRAINT "note_transactions_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "note_transactions_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "notes_user_id_updated_at_idx" ON "notes"("user_id", "updated_at");
CREATE INDEX IF NOT EXISTS "note_transactions_transaction_id_idx" ON "note_transactions"("transaction_id");
