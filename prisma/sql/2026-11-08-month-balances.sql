-- Opening balances you set by hand, per month. Additive only; safe to run
-- more than once. Same names Prisma would generate, so `db push` sees no drift.
CREATE TABLE IF NOT EXISTS "month_balances" (
    "user_id" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "opening" DECIMAL(12,2) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "month_balances_pkey" PRIMARY KEY ("user_id","month"),
    CONSTRAINT "month_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
