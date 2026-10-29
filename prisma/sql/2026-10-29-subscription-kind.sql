-- Split recurring payments into subscriptions and other recurring payments
-- (rent, EMI, SIP). Additive only; safe to run more than once.
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'subscription';
