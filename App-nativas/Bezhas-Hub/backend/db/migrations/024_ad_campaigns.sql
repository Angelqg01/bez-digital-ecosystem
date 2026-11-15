-- Migration 024: anunciantes y campañas publicitarias (antes, colecciones `advertiserprofiles` y `campaigns` de Mongo).
--
-- Los límites que Mongoose validaba al guardar (presupuesto mínimo, puja mínima, estados, enumerados) pasan a CHECK: la base
-- los impone aunque una ruta olvide validarlos. Las métricas (impresiones, clics, gasto) son columnas numéricas para poder
-- sumarlas y actualizarlas de forma atómica; el rendimiento (CTR, CPC, CPM) se calcula al leer, no se guarda.
-- Revertir: DROP TABLE ad_campaigns; DROP TABLE advertiser_profiles;

CREATE TABLE IF NOT EXISTS advertiser_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    wallet_address VARCHAR(42),
    business_type VARCHAR(20) NOT NULL CHECK (business_type IN ('nft-project', 'content-creator', 'defi-dapp', 'web3-service', 'store', 'other')),
    project_name VARCHAR(255) NOT NULL,
    country VARCHAR(100),
    website TEXT,
    business_goals JSONB NOT NULL DEFAULT '[]'::jsonb,
    company_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
    suspension_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_advertiser_profiles_state ON advertiser_profiles (is_active, is_suspended);
CREATE INDEX IF NOT EXISTS idx_advertiser_profiles_created ON advertiser_profiles (created_at DESC);

CREATE TABLE IF NOT EXISTS ad_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    advertiser_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    advertiser_wallet VARCHAR(42),
    name VARCHAR(255) NOT NULL,
    objective VARCHAR(16) NOT NULL CHECK (objective IN ('clicks', 'impressions', 'conversions', 'video-views', 'engagement')),
    creative JSONB NOT NULL,                                  -- title, description, imageUrl, videoUrl, destinationUrl, callToAction
    targeting JSONB NOT NULL DEFAULT '{}'::jsonb,
    daily_budget NUMERIC(14, 4) NOT NULL CHECK (daily_budget >= 5),
    total_budget NUMERIC(14, 4) NOT NULL CHECK (total_budget >= 10),
    bid_amount NUMERIC(14, 4) NOT NULL CHECK (bid_amount >= 0.01),
    bid_strategy VARCHAR(12) NOT NULL DEFAULT 'manual' CHECK (bid_strategy IN ('manual', 'automatic', 'target-cpa')),
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR' CHECK (currency IN ('EUR', 'BEZ')),
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    time_ranges JSONB NOT NULL DEFAULT '[]'::jsonb,
    timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    status VARCHAR(16) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'pending_approval', 'approved', 'active', 'paused', 'completed', 'rejected', 'suspended')),
    rejection_reason TEXT,
    suspension_reason TEXT,
    impressions BIGINT NOT NULL DEFAULT 0 CHECK (impressions >= 0),
    clicks BIGINT NOT NULL DEFAULT 0 CHECK (clicks >= 0),
    spent NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (spent >= 0),
    conversions BIGINT NOT NULL DEFAULT 0 CHECK (conversions >= 0),
    video_views BIGINT NOT NULL DEFAULT 0 CHECK (video_views >= 0),
    engagement BIGINT NOT NULL DEFAULT 0 CHECK (engagement >= 0),
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    last_active_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ad_campaigns_dates CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_advertiser_status ON ad_campaigns (advertiser_id, status);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status_start ON ad_campaigns (status, start_date);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status_created ON ad_campaigns (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_keywords ON ad_campaigns USING GIN ((targeting -> 'keywords'));
