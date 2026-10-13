-- Greenovation platform core migration. Safe to run against the existing MVP schema.

ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(30) NOT NULL DEFAULT 'user';
ALTER TABLE collectors ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) NOT NULL DEFAULT 'pending';
ALTER TABLE collectors ADD COLUMN IF NOT EXISTS availability_status VARCHAR(20) NOT NULL DEFAULT 'offline';
ALTER TABLE collectors ADD COLUMN IF NOT EXISTS service_area TEXT;
ALTER TABLE collectors ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(100);
ALTER TABLE collectors ADD COLUMN IF NOT EXISTS vehicle_identifier VARCHAR(100);
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) NOT NULL DEFAULT 'pending';
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS commercial_registration_number VARCHAR(255);
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS tax_registration_number VARCHAR(255);
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS business_address TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS legal_name VARCHAR(255);
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS business_activity VARCHAR(120);
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS branch_name VARCHAR(255);
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS branch_address TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS responsible_person VARCHAR(255);
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS verified_by INTEGER;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE sellers ALTER COLUMN account_status SET DEFAULT 'PENDING_VERIFICATION';
ALTER TABLE requests ADD COLUMN IF NOT EXISTS material_type VARCHAR(100) NOT NULL DEFAULT 'other';
ALTER TABLE requests ADD COLUMN IF NOT EXISTS preferred_pickup_at TIMESTAMP;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS actual_weight DECIMAL(10,3);
ALTER TABLE requests ADD COLUMN IF NOT EXISTS weight_confirmed_at TIMESTAMP;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS weight_confirmed_by INTEGER REFERENCES users(id);
ALTER TABLE requests ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMP;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS points_awarded DECIMAL(12,3);
ALTER TABLE requests ADD COLUMN IF NOT EXISTS public_reference VARCHAR(32) UNIQUE;

CREATE TABLE IF NOT EXISTS platform_rules (
  rule_key VARCHAR(100) PRIMARY KEY,
  rule_value JSONB NOT NULL,
  updated_by INTEGER,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGSERIAL PRIMARY KEY,
  actor_id INTEGER,
  actor_role VARCHAR(30),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100),
  previous_value JSONB,
  new_value JSONB,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_outbox (
  id BIGSERIAL PRIMARY KEY,
  recipient_id INTEGER NOT NULL,
  recipient_role VARCHAR(30) NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  entity_type VARCHAR(50),
  entity_id VARCHAR(100),
  payload JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  recipient_id INTEGER NOT NULL,
  recipient_role VARCHAR(30) NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  entity_type VARCHAR(50),
  entity_id VARCHAR(100),
  payload JSONB NOT NULL DEFAULT '{}',
  read_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pickup_events (
  id BIGSERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  collector_id INTEGER NOT NULL REFERENCES collectors(id),
  event_type VARCHAR(30) NOT NULL,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  distance_meters DECIMAL(10,2),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS request_status_history (
  id BIGSERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  changed_by_user_id INTEGER,
  changed_by_role VARCHAR(30),
  reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS weight_records (
  id BIGSERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  collector_id INTEGER NOT NULL REFERENCES collectors(id),
  estimated_weight_snapshot DECIMAL(10,3),
  actual_weight DECIMAL(10,3) NOT NULL CHECK (actual_weight > 0),
  unit VARCHAR(10) NOT NULL DEFAULT 'kg',
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  gps_accuracy DECIMAL(10,2),
  evidence_url TEXT,
  weighed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE weight_records ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);

CREATE TABLE IF NOT EXISTS arrival_verifications (
  id BIGSERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  collector_id INTEGER NOT NULL REFERENCES collectors(id),
  user_latitude DECIMAL(10,7) NOT NULL,
  user_longitude DECIMAL(10,7) NOT NULL,
  collector_latitude DECIMAL(10,7) NOT NULL,
  collector_longitude DECIMAL(10,7) NOT NULL,
  distance_meters DECIMAL(10,2) NOT NULL,
  allowed_radius_meters DECIMAL(10,2) NOT NULL,
  accuracy_meters DECIMAL(10,2),
  verified BOOLEAN NOT NULL,
  rejection_reason TEXT,
  captured_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS material_types (
  id SERIAL PRIMARY KEY,
  code VARCHAR(80) UNIQUE NOT NULL,
  name VARCHAR(120) NOT NULL,
  points_per_kg DECIMAL(12,4) NOT NULL DEFAULT 5,
  rounding VARCHAR(20) NOT NULL DEFAULT 'nearest',
  allowed_variance_percent DECIMAL(6,2) NOT NULL DEFAULT 5,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS recycling_partners (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  account_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  supported_materials JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  account_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS company_partners (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255),
  account_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS material_batches (
  id SERIAL PRIMARY KEY,
  public_reference VARCHAR(32) UNIQUE NOT NULL,
  request_id INTEGER NOT NULL REFERENCES requests(id),
  material_type VARCHAR(100) NOT NULL,
  collection_weight DECIMAL(10,3) NOT NULL,
  receiving_weight DECIMAL(10,3),
  recycler_id INTEGER REFERENCES recycling_partners(id),
  status VARCHAR(40) NOT NULL DEFAULT 'created',
  variance_flagged BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  received_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS point_ledger (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  request_id INTEGER REFERENCES requests(id),
  points DECIMAL(12,3) NOT NULL,
  reason VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, request_id, reason)
);

CREATE TABLE IF NOT EXISTS rewards (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  points_cost DECIMAL(12,3) NOT NULL,
  value_amount DECIMAL(12,2),
  currency VARCHAR(10),
  merchant_id INTEGER REFERENCES merchants(id),
  sponsor_id INTEGER REFERENCES company_partners(id),
  funding_model VARCHAR(30) NOT NULL DEFAULT 'configurable',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMP
);

ALTER TABLE rewards ADD COLUMN IF NOT EXISTS seller_id INTEGER REFERENCES sellers(id);

CREATE TABLE IF NOT EXISTS coupons (
  id BIGSERIAL PRIMARY KEY,
  public_reference VARCHAR(32) UNIQUE NOT NULL,
  secure_code_hash VARCHAR(255) UNIQUE NOT NULL,
  reward_id INTEGER NOT NULL REFERENCES rewards(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  seller_id INTEGER REFERENCES sellers(id),
  user_name VARCHAR(255),
  request_id INTEGER UNIQUE REFERENCES requests(id),
  code VARCHAR(64) UNIQUE,
  final_weight DECIMAL(10,3),
  reward_value DECIMAL(12,3),
  points_earned DECIMAL(12,3),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  redeemed_at TIMESTAMP,
  redeemed_by INTEGER REFERENCES merchants(id)
);

ALTER TABLE coupons ADD COLUMN IF NOT EXISTS request_id INTEGER UNIQUE REFERENCES requests(id);
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS seller_id INTEGER REFERENCES sellers(id);
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS user_name VARCHAR(255);
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS code VARCHAR(64) UNIQUE;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS final_weight DECIMAL(10,3);
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS reward_value DECIMAL(12,3);
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS points_earned DECIMAL(12,3);

CREATE TABLE IF NOT EXISTS coupon_events (
  id BIGSERIAL PRIMARY KEY,
  coupon_id BIGINT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  merchant_id INTEGER REFERENCES merchants(id),
  event_type VARCHAR(30) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Existing MVP merchants are stored in sellers, with actor identity in audit_events.
ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_redeemed_by_fkey;
ALTER TABLE coupon_events DROP CONSTRAINT IF EXISTS coupon_events_merchant_id_fkey;

CREATE TABLE IF NOT EXISTS disputes (
  id BIGSERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES requests(id),
  opened_by INTEGER NOT NULL,
  reason TEXT NOT NULL,
  original_value JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  resolution JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP
);

INSERT INTO platform_rules (rule_key, rule_value)
VALUES
  ('arrival_tolerance_meters', '150'::jsonb),
  ('max_gps_accuracy_meters', '150'::jsonb),
  ('default_points_rounding', '"nearest"'::jsonb),
  ('default_allowed_variance_percent', '5'::jsonb)
ON CONFLICT (rule_key) DO NOTHING;

UPDATE platform_rules
SET rule_value = '150'::jsonb
WHERE rule_key = 'max_gps_accuracy_meters' AND rule_value = '100'::jsonb;

INSERT INTO material_types (code, name, points_per_kg)
VALUES
  ('plastic', 'Plastic', 0),
  ('paper', 'Paper/Cardboard', 0),
  ('metal', 'Metals', 0),
  ('glass', 'Glass', 0),
  ('electronic', 'Electronic Waste', 0),
  ('organic', 'Organic/Agricultural Residues', 0),
  ('wood', 'Wood/Plant Residues', 0),
  ('other', 'Other Approved Material', 0)
ON CONFLICT (code) DO NOTHING;

UPDATE material_types SET points_per_kg = 5 WHERE points_per_kg = 0;

CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending ON notification_outbox(status, available_at);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, recipient_role, created_at);
CREATE INDEX IF NOT EXISTS idx_pickup_events_request ON pickup_events(request_id, created_at);
CREATE INDEX IF NOT EXISTS idx_status_history_request ON request_status_history(request_id, created_at);
CREATE INDEX IF NOT EXISTS idx_weight_records_request ON weight_records(request_id, created_at);
CREATE INDEX IF NOT EXISTS idx_arrival_verifications_request ON arrival_verifications(request_id, captured_at);
CREATE INDEX IF NOT EXISTS idx_requests_collector_status ON requests(collector_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_batches_status ON material_batches(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_batches_request_unique ON material_batches(request_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code_hash ON coupons(secure_code_hash);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
