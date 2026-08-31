-- Migration 008: Logistics, Bridge Escrows, Fiat, and Transactions

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: bridge_shipments
CREATE TABLE IF NOT EXISTS bridge_shipments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracking_number VARCHAR(255) UNIQUE NOT NULL,
    carrier VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    history JSONB DEFAULT '[]'::jsonb,
    origin JSONB,
    destination JSONB,
    estimated_delivery TIMESTAMP WITH TIME ZONE,
    actual_delivery TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bridge_shipments_tracking ON bridge_shipments(tracking_number);
CREATE INDEX idx_bridge_shipments_status ON bridge_shipments(status);

-- Table: bridge_synced_items
CREATE TABLE IF NOT EXISTS bridge_synced_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bezhas_id VARCHAR(255) UNIQUE NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    platform VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    price JSONB,
    stock INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',
    metadata JSONB DEFAULT '{}'::jsonb,
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bridge_items_bezhas_id ON bridge_synced_items(bezhas_id);
CREATE INDEX idx_bridge_items_external_id ON bridge_synced_items(external_id);
CREATE INDEX idx_bridge_items_platform ON bridge_synced_items(platform);

-- Table: logistics_shipments
CREATE TABLE IF NOT EXISTS logistics_shipments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'CREATED',
    carrier VARCHAR(100) NOT NULL,
    tracking_number VARCHAR(255),
    origin JSONB,
    destination JSONB,
    container_info JSONB,
    parcel_info JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_logistics_type ON logistics_shipments(shipment_type);
CREATE INDEX idx_logistics_status ON logistics_shipments(status);
CREATE INDEX idx_logistics_tracking ON logistics_shipments(tracking_number);

-- Table: bezcoin_transactions
CREATE TABLE IF NOT EXISTS bezcoin_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    wallet_address VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    amount DECIMAL(36,18) NOT NULL,
    currency VARCHAR(20) DEFAULT 'EUR',
    fiat_amount DECIMAL(20,4),
    exchange_rate DECIMAL(20,8),
    tx_hash VARCHAR(255),
    status VARCHAR(50) DEFAULT 'completed',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bezcoin_tx_user ON bezcoin_transactions(user_id);
CREATE INDEX idx_bezcoin_tx_wallet ON bezcoin_transactions(wallet_address);
CREATE INDEX idx_bezcoin_tx_type ON bezcoin_transactions(type);

-- Table: fiat_orders
CREATE TABLE IF NOT EXISTS fiat_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_wallet VARCHAR(255) NOT NULL,
    user_email VARCHAR(255),
    fiat_amount DECIMAL(20,4) NOT NULL,
    fiat_currency VARCHAR(10) DEFAULT 'EUR',
    bez_amount DECIMAL(36,18),
    status VARCHAR(50) DEFAULT 'PENDING',
    payment_method VARCHAR(100),
    reference_id VARCHAR(255) UNIQUE,
    bank_receipt_url VARCHAR(1024),
    admin_notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fiat_orders_wallet ON fiat_orders(user_wallet);
CREATE INDEX idx_fiat_orders_status ON fiat_orders(status);
CREATE INDEX idx_fiat_orders_reference ON fiat_orders(reference_id);

-- Table: transactions (General)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    tx_hash VARCHAR(255),
    type VARCHAR(50) NOT NULL,
    amount DECIMAL(36,18) NOT NULL,
    currency VARCHAR(20) DEFAULT 'BEZ',
    status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    retry_count INT DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_general_tx_user ON transactions(user_id);
CREATE INDEX idx_general_tx_hash ON transactions(tx_hash);
CREATE INDEX idx_general_tx_status ON transactions(status);

-- Triggers for updated_at
CREATE TRIGGER update_bridge_shipments_modtime BEFORE UPDATE ON bridge_shipments FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_bridge_synced_items_modtime BEFORE UPDATE ON bridge_synced_items FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_logistics_shipments_modtime BEFORE UPDATE ON logistics_shipments FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_bezcoin_tx_modtime BEFORE UPDATE ON bezcoin_transactions FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_fiat_orders_modtime BEFORE UPDATE ON fiat_orders FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_general_tx_modtime BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_modified_column();
