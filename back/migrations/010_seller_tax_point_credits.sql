CREATE TABLE IF NOT EXISTS seller_tax_point_credits (
  order_id BIGINT PRIMARY KEY REFERENCES product_orders(id) ON DELETE RESTRICT,
  seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE RESTRICT,
  points INTEGER NOT NULL CHECK (points > 0),
  verified_by INTEGER NOT NULL REFERENCES admins(id),
  verified_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_seller_tax_point_credits_seller
  ON seller_tax_point_credits(seller_id, verified_at DESC);
