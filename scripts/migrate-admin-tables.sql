-- Admin Portal Phase 1 - Database Tables
-- Run against the warehouse-tire database

-- 1. Fitment Overrides
-- Override fitment data for specific vehicle modifications
CREATE TABLE IF NOT EXISTS admin_fitment_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modification_id TEXT NOT NULL UNIQUE,  -- e.g., "s_a72739b4"
  year TEXT,
  make TEXT,
  model TEXT,
  trim TEXT,
  -- Override fields (NULL = use default from DB/API)
  bolt_pattern TEXT,
  center_bore_mm NUMERIC(5,2),
  wheel_sizes JSONB,        -- ["18x8", "20x9"]
  tire_sizes JSONB,         -- ["275/55R20", "265/50R22"]
  thread_size TEXT,
  seat_type TEXT,
  offset_min INT,
  offset_max INT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_fitment_overrides_mod 
  ON admin_fitment_overrides(modification_id);

CREATE INDEX IF NOT EXISTS idx_fitment_overrides_ymm 
  ON admin_fitment_overrides(year, make, model);

-- 2. Product Flags
-- Hide/flag/pin products
CREATE TABLE IF NOT EXISTS admin_product_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type TEXT NOT NULL CHECK (product_type IN ('wheel', 'tire', 'accessory')),
  sku TEXT NOT NULL,
  hidden BOOLEAN DEFAULT FALSE,
  flagged BOOLEAN DEFAULT FALSE,
  flag_reason TEXT,
  pinned BOOLEAN DEFAULT FALSE,        -- Future: prefer in results
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_type, sku)
);

CREATE INDEX IF NOT EXISTS idx_product_flags_sku 
  ON admin_product_flags(sku);

CREATE INDEX IF NOT EXISTS idx_product_flags_hidden 
  ON admin_product_flags(hidden) WHERE hidden = TRUE;

CREATE INDEX IF NOT EXISTS idx_product_flags_type 
  ON admin_product_flags(product_type);

-- 3. Admin Logs
-- Diagnostic logging for fitment, inventory, errors
CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_type TEXT NOT NULL,  -- 'fitment', 'inventory', 'search_error', 'warning'
  vehicle_params JSONB,
  sku TEXT,
  resolution_path TEXT,
  details JSONB,
  duration_ms INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_type 
  ON admin_logs(log_type);

CREATE INDEX IF NOT EXISTS idx_admin_logs_created 
  ON admin_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_logs_type_created 
  ON admin_logs(log_type, created_at DESC);

-- 4. Admin Settings
-- Key-value store for configuration
CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default settings
INSERT INTO admin_settings (key, value) VALUES
  ('payments', '{"stripe_enabled": true}'),
  ('suppliers', '{"wheelpros_enabled": true, "keystone_enabled": true}'),
  ('site', '{"maintenance_mode": false}')
ON CONFLICT (key) DO NOTHING;

-- Done
SELECT 'Admin tables created successfully' as status;
