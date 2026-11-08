-- Split transactions: your own share of a debit, and the other people's
-- shares with the credit that paid each one back. Additive only; safe to run
-- more than once. Same names Prisma would generate, so `db push` sees no drift.
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "my_share" DECIMAL(12,2);

CREATE TABLE IF NOT EXISTS "split_shares" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "transaction_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "settled_by_id" INTEGER,
    "settled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "split_shares_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "split_shares_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "split_shares_settled_by_id_fkey" FOREIGN KEY ("settled_by_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "split_shares_settled_by_id_key" ON "split_shares"("settled_by_id");
CREATE INDEX IF NOT EXISTS "split_shares_transaction_id_idx" ON "split_shares"("transaction_id");
CREATE INDEX IF NOT EXISTS "split_shares_user_id_settled_by_id_idx" ON "split_shares"("user_id", "settled_by_id");
