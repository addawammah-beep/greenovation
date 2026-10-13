CREATE TABLE IF NOT EXISTS seller_products (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  points_cost INTEGER NOT NULL CHECK (points_cost > 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_orders (
  id BIGSERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES seller_products(id) ON DELETE SET NULL,
  seller_id INTEGER NOT NULL REFERENCES sellers(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  product_name VARCHAR(255) NOT NULL,
  points_cost INTEGER NOT NULL CHECK (points_cost > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'fulfilled', 'rejected')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_seller_products_active
  ON seller_products(active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seller_products_seller
  ON seller_products(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_orders_user
  ON product_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_orders_seller
  ON product_orders(seller_id, status, created_at DESC);
