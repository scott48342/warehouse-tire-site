-- B6: Add PayPal order ID column to orders table
-- Enables idempotency checking for PayPal payments
-- Partial unique index: allows NULL (Stripe orders), enforces uniqueness on non-NULL

-- Add column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'paypal_order_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN paypal_order_id TEXT;
  END IF;
END
$$;

-- Create partial unique index for idempotency
-- Note: Partial unique allows multiple NULLs but enforces uniqueness on actual values
CREATE UNIQUE INDEX IF NOT EXISTS orders_paypal_order_id_unique 
ON orders (paypal_order_id) 
WHERE paypal_order_id IS NOT NULL;
