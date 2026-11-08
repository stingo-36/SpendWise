-- An icon you pick for a category or subcategory. NULL = guessed from the
-- name (lib/categoryIcons.ts). Additive only; safe to run more than once.
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "icon" TEXT;
