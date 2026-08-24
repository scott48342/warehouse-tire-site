-- Phase 3B: Pending Saved Quotes (Guest Flow)
-- Temporary holding table for quotes saved by guests before authentication

CREATE TABLE pending_saved_quotes (
  -- Token-based lookup (cryptographically secure, one-time use)
  -- Format: psq_<nanoid(32)>
  token TEXT PRIMARY KEY,
  
  -- The validated quote snapshot to save after authentication
  snapshot_json JSONB NOT NULL,
  
  -- Vehicle fields (denormalized for convenience)
  vehicle_year TEXT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_trim TEXT,
  vehicle_modification TEXT,
  
  -- Tracking
  cart_id TEXT,  -- Original cart ID for correlation
  
  -- Return URL after claim (must be internal/allow-listed)
  return_to TEXT NOT NULL DEFAULT '/account',
  
  -- Expiration (24 hours from creation)
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index: Cleanup expired tokens
CREATE INDEX idx_pending_saved_quotes_expires ON pending_saved_quotes(expires_at);

-- Comment
COMMENT ON TABLE pending_saved_quotes IS 'Temporary holding for guest quote saves pending authentication (Phase 3B)';
