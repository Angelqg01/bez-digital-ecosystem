-- 007_settings_and_logs.sql
-- Migración para configuración, logs y seguridad (API Keys, Auditoría, Settings)

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    key VARCHAR(255) UNIQUE NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    sector VARCHAR(50) NOT NULL,
    permissions JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(20) DEFAULT 'active',
    rate_limit JSONB DEFAULT '{"requestsPerMinute": 60, "requestsPerDay": 10000}'::jsonb,
    usage JSONB DEFAULT '{"totalRequests": 0, "requestsToday": 0, "requestsThisMonth": 0, "smartContractCalls": 0, "identityValidations": 0}'::jsonb,
    achievements JSONB DEFAULT '[]'::jsonb,
    environment VARCHAR(20) DEFAULT 'development',
    ip_whitelist JSONB DEFAULT '[]'::jsonb,
    webhooks JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    last_rotated TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_apikey_user_status ON api_keys(user_id, status);
CREATE INDEX idx_apikey_sector_status ON api_keys(sector, status);
CREATE INDEX idx_apikey_key ON api_keys(key);

CREATE TABLE IF NOT EXISTS api_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    request JSONB NOT NULL,
    response JSONB NOT NULL,
    client JSONB NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_apilog_apiKey_ts ON api_logs(api_key_id, timestamp DESC);
CREATE INDEX idx_apilog_user_ts ON api_logs(user_id, timestamp DESC);
CREATE INDEX idx_apilog_ts ON api_logs(timestamp DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    performed_by VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255),
    section VARCHAR(100),
    previous_state JSONB,
    new_state JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_auditlog_created_at ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS global_settings (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'global_settings',
    defi JSONB NOT NULL,
    fiat JSONB NOT NULL,
    token JSONB NOT NULL,
    farming JSONB NOT NULL,
    staking JSONB NOT NULL,
    dao JSONB NOT NULL,
    rwa JSONB NOT NULL,
    platform JSONB NOT NULL,
    openclaw JSONB NOT NULL,
    last_updated_by VARCHAR(255) DEFAULT 'system',
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sdk_configs (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'global_sdk_config',
    sdk_version VARCHAR(20) DEFAULT '1.0.0',
    is_globally_enabled BOOLEAN DEFAULT true,
    maintenance_mode BOOLEAN DEFAULT false,
    maintenance_message TEXT,
    modules JSONB DEFAULT '[]'::jsonb,
    ai_models JSONB DEFAULT '[]'::jsonb,
    access_tiers JSONB DEFAULT '[]'::jsonb,
    webhooks JSONB DEFAULT '[]'::jsonb,
    global_rate_limit JSONB NOT NULL,
    logging JSONB NOT NULL,
    security JSONB NOT NULL,
    mcp_server JSONB NOT NULL,
    updated_by VARCHAR(255) DEFAULT '',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    steps JSONB DEFAULT '[]'::jsonb,
    trigger JSONB NOT NULL,
    created_by VARCHAR(42) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    tags JSONB DEFAULT '[]'::jsonb,
    run_history JSONB DEFAULT '[]'::jsonb,
    last_run TIMESTAMP WITH TIME ZONE,
    total_runs INTEGER DEFAULT 0,
    blockchain JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_workflow_created_by ON workflows(created_by);
CREATE INDEX idx_workflow_status ON workflows(status);
