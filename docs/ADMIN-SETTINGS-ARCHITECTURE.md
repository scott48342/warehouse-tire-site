# Admin Settings Architecture

## Data Model

### Payment Gateways (`admin_payment_gateways` table)

```sql
CREATE TABLE admin_payment_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,           -- 'stripe' | 'square' | 'paypal' | 'manual'
  display_name TEXT NOT NULL,       -- "Stripe", "Square", "Call to Complete"
  enabled BOOLEAN DEFAULT false,
  mode TEXT DEFAULT 'test',         -- 'test' | 'live'
  priority INTEGER DEFAULT 0,       -- Sort order for display
  
  -- Provider-specific settings (encrypted/hashed in practice)
  config JSONB DEFAULT '{}',        -- Provider-specific config (non-sensitive)
  -- Sensitive keys stored in env vars, referenced by name
  secret_key_env TEXT,              -- e.g., 'STRIPE_SECRET_KEY'
  publishable_key_env TEXT,         -- e.g., 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint on provider
CREATE UNIQUE INDEX idx_payment_gateways_provider ON admin_payment_gateways(provider);
```

**Example configs by provider:**
```jsonc
// Stripe
{ "webhookEndpoint": "/api/stripe/webhook", "currency": "usd" }

// Square
{ "locationId": "xxx", "currency": "usd" }

// Manual (Call to Complete)
{ "instructions": "Call 1-800-XXX to complete your order", "collectPaymentInfo": false }
```

### Suppliers (`admin_suppliers` table)

```sql
CREATE TABLE admin_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,           -- 'wheelpros' | 'keystone' | 'km' | 'custom'
  display_name TEXT NOT NULL,       -- "Wheel Pros", "Keystone Automotive"
  enabled BOOLEAN DEFAULT false,
  priority INTEGER DEFAULT 0,       -- Sort order / priority for inventory lookup
  
  -- Connection settings
  config JSONB DEFAULT '{}',        -- Provider-specific config
  -- Sensitive credentials in env vars
  api_key_env TEXT,                 -- e.g., 'WHEELPROS_API_KEY'
  
  -- Identifiers
  customer_number TEXT,             -- Customer/dealer number
  company_code TEXT,                -- Company code (for Keystone, etc.)
  warehouse_codes TEXT[],           -- Preferred warehouse codes
  
  -- Connection status
  last_test_at TIMESTAMPTZ,
  last_test_status TEXT,            -- 'success' | 'error'
  last_test_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_suppliers_provider ON admin_suppliers(provider);
```

**Example configs by provider:**
```jsonc
// Wheel Pros
{
  "baseUrl": "https://api.wheelpros.com",
  "version": "v2",
  "timeout": 30000,
  "retryCount": 3
}

// Keystone
{
  "baseUrl": "https://api.keystone.com",
  "shipToCode": "001",
  "priceLevel": "dealer"
}

// K&M
{
  "ftpHost": "ftp.kmtire.com",
  "ftpPath": "/inventory"
}
```

## API Endpoints

### GET /api/admin/settings/gateways
Returns all payment gateways with status

### POST /api/admin/settings/gateways
Create/update a payment gateway

### DELETE /api/admin/settings/gateways/:id
Remove a payment gateway

### POST /api/admin/settings/gateways/:id/test
Test gateway connection

### GET /api/admin/settings/suppliers
Returns all suppliers with status

### POST /api/admin/settings/suppliers
Create/update a supplier

### DELETE /api/admin/settings/suppliers/:id
Remove a supplier

### POST /api/admin/settings/suppliers/:id/test
Test supplier connection

## UI Layout

```
Settings
├── Payments
│   ├── [Provider Card: Stripe]
│   │   ├── Toggle enabled/disabled
│   │   ├── Mode: Test / Live
│   │   ├── Status indicator (green/red)
│   │   └── "Test Connection" button
│   ├── [Provider Card: Square] (coming soon badge)
│   ├── [Provider Card: Manual/Call]
│   │   ├── Toggle enabled/disabled
│   │   └── Instructions text field
│   └── [+ Add Gateway] button
│
├── Suppliers
│   ├── [Supplier Card: Wheel Pros]
│   │   ├── Toggle enabled/disabled
│   │   ├── Customer Number field
│   │   ├── Warehouse Codes field
│   │   ├── Status: Last checked X ago - Success/Error
│   │   └── "Test Connection" button
│   ├── [Supplier Card: Keystone]
│   │   ├── Toggle enabled/disabled
│   │   ├── Company Code field
│   │   ├── Ship To Code field
│   │   └── "Test Connection" button
│   ├── [Supplier Card: K&M] (coming soon badge)
│   └── [+ Add Supplier] button
│
└── Site Settings
    ├── Maintenance Mode toggle
    └── Other site-wide settings
```

## Migration

```sql
-- Migration: 0010_admin_gateways_suppliers.sql

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

-- Migrate existing settings from admin_settings
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
END $$;
```
