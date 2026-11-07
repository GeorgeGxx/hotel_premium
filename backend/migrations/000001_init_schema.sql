-- ==============================================================================
-- HOTEL PREMIUM - ENTERPRISE POSTGRESQL 18 SCHEMA
-- Domain-Driven Design | Pure English | High Performance
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ------------------------------------------------------------------------------
-- 1. USERS & ACCESS CONTROL (REPLACES 'user')
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'RECEPTIONIST' CHECK (role IN ('ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 2. CASH SHIFTS / CASH REGISTER SESSIONS (REPLACES 'caja')
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cash_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMPTZ,
    opening_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    closing_amount NUMERIC(12, 2),
    actual_closing_amount NUMERIC(12, 2),
    difference NUMERIC(12, 2) GENERATED ALWAYS AS (actual_closing_amount - closing_amount) STORED,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 3. ROOM CATEGORIES & ROOMS (REPLACES 'categoria', 'habitacion', 'rooms')
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS room_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    base_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    capacity INT NOT NULL DEFAULT 2 CHECK (capacity > 0),
    image_url VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number VARCHAR(20) NOT NULL UNIQUE,
    category_id UUID NOT NULL REFERENCES room_categories(id) ON DELETE RESTRICT,
    floor INT NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE' 
        CHECK (status IN ('AVAILABLE', 'OCCUPIED', 'DIRTY', 'CLEANING', 'MAINTENANCE', 'BLOCKED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 4. GUESTS & PROFILES (REPLACES 'persona', 'contacto')
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type VARCHAR(20) NOT NULL CHECK (document_type IN ('PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE', 'OTHER')),
    document_number VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(200) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(30),
    nationality VARCHAR(100),
    is_vip BOOLEAN NOT NULL DEFAULT false,
    stay_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 5. STAYS & FOLIOS (REPLACES 'proceso', 'cliente_proceso', 'reservations')
-- Mathematical double-booking exclusion using PostgreSQL GiST range constraint
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
    primary_guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE RESTRICT,
    cash_shift_id UUID REFERENCES cash_shifts(id) ON DELETE SET NULL,
    registered_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    stay_period TSTZRANGE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' 
        CHECK (status IN ('RESERVED', 'ACTIVE', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW')),
    nightly_rate NUMERIC(10, 2) NOT NULL CHECK (nightly_rate >= 0),
    total_nights INT NOT NULL DEFAULT 1 CHECK (total_nights > 0),
    deposit_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' 
        CHECK (payment_status IN ('PENDING', 'PARTIAL', 'PAID', 'REFUNDED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Prevent overlapping active reservations or stays on the same room
ALTER TABLE stays
    ADD CONSTRAINT stays_room_period_exclusion
    EXCLUDE USING gist (room_id WITH =, stay_period WITH &&)
    WHERE (status IN ('RESERVED', 'ACTIVE'));

-- ------------------------------------------------------------------------------
-- 6. POS PRODUCTS & FOLIO CHARGES (REPLACES 'producto', 'venta', 'proceso_venta')
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    cost_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    sale_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    current_stock INT NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stay_charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stay_id UUID NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    description VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    total_price NUMERIC(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 7. INITIAL SEED DATA
-- ------------------------------------------------------------------------------
INSERT INTO users (username, email, password_hash, first_name, last_name, role)
VALUES ('admin', 'admin@hotelpremium.com', '$2a$12$e8Yd8e7hG.sample.modern.hash.change.me', 'Hotel', 'Administrator', 'ADMIN')
ON CONFLICT (username) DO NOTHING;

INSERT INTO room_categories (code, name, description, base_price, capacity, image_url)
VALUES 
    ('SGL', 'Single Standard', 'Comfortable single room with Queen bed and high-speed Wi-Fi', 65.00, 1, 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=80'),
    ('DBL', 'Double Deluxe', 'Spacious double room with King bed, mini-bar, and city view', 95.00, 2, 'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&q=80'),
    ('STE', 'Presidential Suite', 'Luxury suite with panoramic views, Jacuzzi, and private lounge', 220.00, 4, 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80')
ON CONFLICT (code) DO NOTHING;
