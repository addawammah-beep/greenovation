-- schema.sql
-- Database schema for Greenovation application


-- =====================================================
-- Users table
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    balance DECIMAL(10,2) DEFAULT 0,
    points DECIMAL(12,3) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image TEXT;


-- =====================================================
-- Sellers table
-- =====================================================

CREATE TABLE IF NOT EXISTS sellers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    registry VARCHAR(255),
    gps VARCHAR(255),
    points INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE sellers ADD COLUMN IF NOT EXISTS profile_image TEXT;


-- =====================================================
-- Collectors table
-- =====================================================

CREATE TABLE IF NOT EXISTS collectors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    registry VARCHAR(255),
    gps VARCHAR(255),
    points INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE collectors ADD COLUMN IF NOT EXISTS location_name VARCHAR(255);
ALTER TABLE collectors ADD COLUMN IF NOT EXISTS profile_image TEXT;
ALTER TABLE collectors ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE collectors ADD COLUMN IF NOT EXISTS experience_years INTEGER;


-- =====================================================
-- Requests table
-- =====================================================

CREATE TABLE IF NOT EXISTS requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    material_type VARCHAR(100) NOT NULL,
    weight DECIMAL(10,2) NOT NULL,
    location TEXT NOT NULL,
    description TEXT,
    gps VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    collector_id INTEGER REFERENCES collectors(id) ON DELETE SET NULL,
    collector_gps POINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    collected_at TIMESTAMP,
    completed_at TIMESTAMP,
    collected_weight DECIMAL(10,2)
);

CREATE TABLE IF NOT EXISTS request_collector_candidates (
    id SERIAL PRIMARY KEY,
    request_id INTEGER REFERENCES requests(id) ON DELETE CASCADE,
    collector_id INTEGER REFERENCES collectors(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (request_id, collector_id)
);


-- =====================================================
-- Add columns if requests table already exists
-- =====================================================

ALTER TABLE requests
ADD COLUMN IF NOT EXISTS collector_gps POINT;

ALTER TABLE requests
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

ALTER TABLE requests
ADD COLUMN IF NOT EXISTS collected_weight DECIMAL(10,2);


-- =====================================================
-- Offers table
-- =====================================================

CREATE TABLE IF NOT EXISTS offers (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER REFERENCES sellers(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    material_type VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    location TEXT NOT NULL,
    description TEXT,
    gps VARCHAR(255),
    duration INTEGER DEFAULT 7,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =====================================================
-- Codes table
-- =====================================================

CREATE TABLE IF NOT EXISTS codes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    seller_id INTEGER REFERENCES sellers(id) ON DELETE CASCADE,
    code VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =====================================================
-- Indexes for performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_users_email
ON users(email);

CREATE INDEX IF NOT EXISTS idx_sellers_email
ON sellers(email);

CREATE INDEX IF NOT EXISTS idx_collectors_email
ON collectors(email);

CREATE INDEX IF NOT EXISTS idx_requests_user_id
ON requests(user_id);

CREATE INDEX IF NOT EXISTS idx_requests_status
ON requests(status);

CREATE INDEX IF NOT EXISTS idx_offers_seller_id
ON offers(seller_id);

CREATE INDEX IF NOT EXISTS idx_offers_status
ON offers(status);


-- =====================================================
-- Reports table
-- =====================================================

CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,

    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

    problem_type VARCHAR(100) NOT NULL,

    address TEXT NOT NULL,

    description TEXT NOT NULL,

    image VARCHAR(255),

    latitude DOUBLE PRECISION NOT NULL,

    longitude DOUBLE PRECISION NOT NULL,

    ai_valid BOOLEAN DEFAULT FALSE,

    ai_contains_trash BOOLEAN NOT NULL DEFAULT FALSE,

    ai_confidence INTEGER DEFAULT 0,

    ai_reason TEXT,

    captured_at TIMESTAMPTZ,

    capture_accuracy_m DOUBLE PRECISION,

    capture_method VARCHAR(20),

    status VARCHAR(30) DEFAULT 'pending',

    reviewed_by VARCHAR(100),

    reviewed_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =====================================================
-- Reports Indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_reports_status
ON reports(status);

CREATE INDEX IF NOT EXISTS idx_reports_user
ON reports(user_id);

CREATE INDEX IF NOT EXISTS idx_reports_created
ON reports(created_at);

CREATE INDEX IF NOT EXISTS idx_reports_problem
ON reports(problem_type);