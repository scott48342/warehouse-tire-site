-- Migration: 0011_supplier_credentials
-- Add encrypted credentials storage to admin_suppliers

-- Add credentials column for encrypted credential storage
ALTER TABLE admin_suppliers 
ADD COLUMN IF NOT EXISTS credentials TEXT;

-- Add comment explaining the format
COMMENT ON COLUMN admin_suppliers.credentials IS 'Encrypted credentials JSON (AES-256-GCM). Format: iv:authTag:ciphertext (base64)';

-- Update the config column comment
COMMENT ON COLUMN admin_suppliers.config IS 'Non-sensitive provider config (JSON). Sensitive data should go in credentials column.';
