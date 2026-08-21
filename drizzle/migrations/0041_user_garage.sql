-- User Garage Table
-- Stores saved vehicles for authenticated users
-- Created: 2026-08-21

CREATE TABLE IF NOT EXISTS "user_garage" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "auth_users"("id") ON DELETE CASCADE,
  "year" TEXT NOT NULL,
  "make" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "trim" TEXT,
  "modification" TEXT,
  "wheel_dia" TEXT,
  "nickname" TEXT,
  "added_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "last_active_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for user lookups (get all vehicles for a user)
CREATE INDEX IF NOT EXISTS "user_garage_user_id_idx" ON "user_garage" ("user_id");

-- Unique constraint: one vehicle per user per modification (prevents duplicates)
-- Note: This index only applies when modification is NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS "user_garage_user_modification_idx" 
  ON "user_garage" ("user_id", "modification") 
  WHERE "modification" IS NOT NULL;
