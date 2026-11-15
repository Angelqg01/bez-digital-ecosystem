-- Migration 022: eventos de afiliados y leads B2B (antes, colecciones `affiliateevents` y `b2bleads` de Mongo).
-- Revertir: DROP TABLE affiliate_events; DROP TABLE b2b_leads;

CREATE TABLE IF NOT EXISTS affiliate_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,   -- quien recibe el crédito
    referred_id UUID REFERENCES users(id) ON DELETE SET NULL,           -- el referido (sólo en 'signup')
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('click', 'signup', 'rewardable_action')),
    ip_address VARCHAR(64),
    user_agent TEXT,
    referral_code_used VARCHAR(255),
    attribution_window_ends TIMESTAMP WITH TIME ZONE,
    reward_status VARCHAR(12) NOT NULL DEFAULT 'pending' CHECK (reward_status IN ('pending', 'processed', 'failed', 'ineligible')),
    reward_transaction_id VARCHAR(255),
    reward_amount NUMERIC(36, 18),
    reward_currency VARCHAR(20) NOT NULL DEFAULT 'Bez-Coin',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_affiliate_events_referrer ON affiliate_events (referrer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_events_referrer_type ON affiliate_events (referrer_id, event_type);
CREATE INDEX IF NOT EXISTS idx_affiliate_events_referred ON affiliate_events (referred_id) WHERE referred_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_affiliate_events_code ON affiliate_events (referral_code_used) WHERE referral_code_used IS NOT NULL;

CREATE TABLE IF NOT EXISTS b2b_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id VARCHAR(255) NOT NULL,
    sector VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    url TEXT,
    type VARCHAR(10) NOT NULL DEFAULT 'B2B' CHECK (type IN ('B2B', 'B2G', 'Unknown')),
    contact_email VARCHAR(320),
    whatsapp_number VARCHAR(64),
    linkedin_profile TEXT,
    score INTEGER NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
    score_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(16) NOT NULL DEFAULT 'needs_approval'
        CHECK (status IN ('new', 'needs_approval', 'approved', 'sent', 'replied', 'qualified', 'disqualified', 'blocked', 'failed')),
    source VARCHAR(64) NOT NULL DEFAULT 'openclaw',
    -- Mensaje de salida (antes subdocumento `outreach`). Nada se envía hasta que una persona lo aprueba.
    outreach_channel VARCHAR(10) CHECK (outreach_channel IN ('email', 'whatsapp', 'linkedin', 'telegram')),
    outreach_subject TEXT,
    outreach_message TEXT,
    outreach_status VARCHAR(16) CHECK (outreach_status IN ('draft', 'needs_approval', 'approved', 'sent', 'blocked', 'failed')),
    outreach_approved_by VARCHAR(255),
    outreach_approved_at TIMESTAMP WITH TIME ZONE,
    outreach_sent_at TIMESTAMP WITH TIME ZONE,
    outreach_provider_message_id VARCHAR(255),
    outreach_error TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_b2b_leads_campaign ON b2b_leads (campaign_id);
CREATE INDEX IF NOT EXISTS idx_b2b_leads_status ON b2b_leads (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_b2b_leads_email_campaign ON b2b_leads (contact_email, campaign_id);
CREATE INDEX IF NOT EXISTS idx_b2b_leads_score ON b2b_leads (score DESC);
