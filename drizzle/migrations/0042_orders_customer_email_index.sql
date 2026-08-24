-- Add expression index for customer email lookups
-- Matches the query pattern: WHERE LOWER(TRIM(customer_email)) = $1
-- Used by /api/account/orders for order ownership lookup
-- Phase 3A: My Orders

CREATE INDEX IF NOT EXISTS idx_orders_customer_email_normalized 
ON orders (LOWER(TRIM(customer_email)));
