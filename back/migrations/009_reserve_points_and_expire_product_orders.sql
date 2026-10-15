ALTER TABLE product_orders
  DROP CONSTRAINT IF EXISTS product_orders_status_check;

ALTER TABLE product_orders
  ADD CONSTRAINT product_orders_status_check
  CHECK (status IN ('pending', 'approved', 'fulfilled', 'rejected', 'cancelled', 'expired'));

CREATE INDEX IF NOT EXISTS idx_product_orders_pending_expiry
  ON product_orders(created_at)
  WHERE status = 'pending';
