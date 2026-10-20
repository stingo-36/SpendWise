-- Admin flag that follows the account (so the admin can change its email)
-- and Pulse connection tracking. Additive only; safe to run more than once.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_admin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "pulse_connected_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "pulse_last_seen_at" TIMESTAMP(3);

UPDATE "users" SET "is_admin" = true WHERE "email" = 'admin@spendwise.app';
