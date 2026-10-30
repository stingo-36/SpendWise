-- Credit card billing cycle: the day of the month the bill is generated.
-- Additive only; safe to run more than once.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "card_statement_day" INTEGER NOT NULL DEFAULT 15;
