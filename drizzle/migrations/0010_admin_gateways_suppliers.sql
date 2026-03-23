-- Migration: 0010_admin_gateways_suppliers.sql
-- Multi-gateway payment and multi-supplier support

-- Payment Gateways
CREATE TABLE IF NOT EXISTS admin_payment_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  display_name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT false,
  mode TEXT DEFAULT 'test',
  priority INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}',
  secret_key_env TEXT,
  publishable_key_env TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_gateways_provider 
  ON admin_payment_gateways(provider);

-- Suppliers
CREATE TABLE IF NOT EXISTS admin_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  display_name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT false,
  priority INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}',
  api_key_env TEXT,
  customer_number TEXT,
  company_code TEXT,
  warehouse_codes TEXT[],
  last_test_at TIMESTAMPTZ,
  last_test_status TEXT,
  last_test_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_provider 
  ON admin_suppliers(provider);

-- Seed default gateways
INSERT INTO admin_payment_gateways (provider, display_name, enabled, mode, priority, secret_key_env, publishable_key_env)
VALUES 
  ('stripe', 'Stripe', true, 'test', 1, 'STRIPE_SECRET_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'),
  ('manual', 'Call to Complete', false, 'live', 99, NULL, NULL)
ON CONFLICT (provider) DO NOTHING;

-- Seed default suppliers
INSERT INTO admin_suppliers (provider, display_name, enabled, priority, api_key_env)
VALUES 
  ('wheelpros', 'Wheel Pros', true, 1, 'WHEELPROS_API_KEY'),
  ('keystone', 'Keystone Automotive', true, 2, 'KEYSTONE_API_KEY')
ON CONFLICT (provider) DO NOTHING;

-- Migrate existing settings from admin_settings (if they exist)
DO $$
DECLARE
  payments_value JSONB;
  suppliers_value JSONB;
BEGIN
  -- Get existing payments setting
  SELECT value::jsonb INTO payments_value 
  FROM admin_settings WHERE key = 'payments';
  
  IF payments_value IS NOT NULL THEN
    UPDATE admin_payment_gateways 
    SET enabled = COALESCE((payments_value->>'stripe_enabled')::boolean, true)
    WHERE provider = 'stripe';
  END IF;

  -- Get existing suppliers setting
  SELECT value::jsonb INTO suppliers_value 
  FROM admin_settings WHERE key = 'suppliers';
  
  IF suppliers_value IS NOT NULL THEN
    UPDATE admin_suppliers 
    SET enabled = COALESCE((suppliers_value->>'wheelpros_enabled')::boolean, true)
    WHERE provider = 'wheelpros';
    
    UPDATE admin_suppliers 
    SET enabled = COALESCE((suppliers_value->>'keystone_enabled')::boolean, true)
    WHERE provider = 'keystone';
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    -- admin_settings doesn't exist, skip migration
    NULL;
END $$;
