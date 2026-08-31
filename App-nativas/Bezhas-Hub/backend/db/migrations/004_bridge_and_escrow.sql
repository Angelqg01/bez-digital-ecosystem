-- 004_bridge_and_escrow.sql
-- Tablas para el Universal Bridge y el sistema Escrow interconectado

CREATE TYPE bridge_platform AS ENUM ('vinted', 'amazon', 'ebay', 'other');
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');
CREATE TYPE payment_order_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE escrow_status AS ENUM ('pending', 'locked', 'released', 'refunded');

CREATE TABLE IF NOT EXISTS bridge_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bezhas_order_id VARCHAR(255) UNIQUE NOT NULL,
    external_order_id VARCHAR(255) NOT NULL,
    platform bridge_platform NOT NULL,
    
    -- Los buyers y sellers los alojaremos encapsulados en JSONB
    -- ya que sus correos y metadata varían mucho según el source_platform
    buyer JSONB NOT NULL,
    seller JSONB NOT NULL,
    
    -- Array struct embebido en mongo (Items) -> JSONB
    items JSONB DEFAULT '[]'::jsonb,
    
    shipping_address JSONB,
    
    total_amount NUMERIC(15, 4) NOT NULL,
    shipping_cost NUMERIC(15, 4) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'EUR',
    
    status order_status DEFAULT 'pending',
    payment_status payment_order_status DEFAULT 'pending',
    paid_at TIMESTAMP WITH TIME ZONE,
    
    escrow_id VARCHAR(255),
    escrow_status escrow_status DEFAULT 'pending',
    tracking_number VARCHAR(255),
    
    api_key_id UUID, -- Relacional hacia la api_key pero en draft lo mantenemos UUID
    
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_bridge_platform_ext_id ON bridge_orders (platform, external_order_id);
CREATE INDEX idx_bridge_status_payment ON bridge_orders (status, payment_status);
