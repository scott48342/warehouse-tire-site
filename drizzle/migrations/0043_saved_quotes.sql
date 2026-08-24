-- Phase 3B: Saved Quotes
-- Customer-saved shopping configurations for their account

CREATE TABLE saved_quotes (
  -- Primary key: cryptographically secure, non-sequential
  -- Format: sq_<nanoid(21)>
  id TEXT PRIMARY KEY,
  
  -- Ownership (auth_users.id) - CASCADE on user deletion
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  
  -- Optional user-assigned name
  name TEXT,
  
  -- Vehicle snapshot (denormalized for display without parsing JSON)
  vehicle_year TEXT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_trim TEXT,
  vehicle_modification TEXT,  -- Canonical fitment ID
  
  -- Immutable configuration snapshot (JSONB)
  -- Contains: vehicle, items, pricing, savedFrom, savedAt
  snapshot_json JSONB NOT NULL,
  
  -- Timestamps
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_viewed_at TIMESTAMPTZ,
  
  -- Conversion tracking (populated when quote becomes order)
  converted_order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,
  
  -- Soft delete / archive
  archived_at TIMESTAMPTZ,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index: User lookup for listing (newest first, active only)
CREATE INDEX idx_saved_quotes_user_active ON saved_quotes(user_id, saved_at DESC)
  WHERE archived_at IS NULL;

-- Index: All user quotes including archived (for count checks)
CREATE INDEX idx_saved_quotes_user_id ON saved_quotes(user_id);

-- Index: Conversion lookup (for order detail page to show "from saved quote")
CREATE INDEX idx_saved_quotes_converted_order ON saved_quotes(converted_order_id)
  WHERE converted_order_id IS NOT NULL;

-- Comment
COMMENT ON TABLE saved_quotes IS 'Customer-saved shopping configurations (Phase 3B)';
