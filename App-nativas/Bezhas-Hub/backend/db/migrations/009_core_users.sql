-- Migration 009: Identity, Users, and Core Auth

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identity
    username VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    wallet_address VARCHAR(255) UNIQUE,
    
    -- Account Type & Profile
    account_type VARCHAR(50) DEFAULT 'individual',
    profile_image VARCHAR(1024),
    cover_image VARCHAR(1024),
    bio TEXT,
    
    -- Commercial Profile
    company_name VARCHAR(255),
    tax_id VARCHAR(100),
    industry VARCHAR(100),
    company_size VARCHAR(50),
    website VARCHAR(255),
    primary_contact_role VARCHAR(100),
    expected_volume VARCHAR(50),
    interested_services JSONB DEFAULT '[]'::jsonb,
    
    -- Contact
    phone VARCHAR(100),
    phone_hash VARCHAR(255),
    email_hash VARCHAR(255),
    address JSONB DEFAULT '{}'::jsonb,
    
    wallet_linked_at TIMESTAMP WITH TIME ZONE,
    
    -- System
    roles JSONB DEFAULT '["USER"]'::jsonb,
    is_email_verified BOOLEAN DEFAULT false,
    is_wallet_verified BOOLEAN DEFAULT false,
    
    -- Security
    is_2fa_enabled BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(255),
    backup_codes JSONB DEFAULT '[]'::jsonb,
    
    -- External Auth
    google_id VARCHAR(255) UNIQUE,
    facebook_id VARCHAR(255) UNIQUE,
    github_id VARCHAR(255) UNIQUE,
    twitter_id VARCHAR(255) UNIQUE,
    linkedin_id VARCHAR(255) UNIQUE,
    
    -- Affiliates
    affiliate_referral_code VARCHAR(255) UNIQUE,
    affiliate_referred_by UUID REFERENCES users(id) ON DELETE SET NULL,
    affiliate_registered_with_code VARCHAR(255),
    affiliate_earnings DECIMAL(36,18) DEFAULT 0,
    
    -- Legacy/Compatibility
    is_vip BOOLEAN DEFAULT false,
    subscription VARCHAR(50) DEFAULT 'FREE',
    vip_tier VARCHAR(50),
    contact_sync JSONB DEFAULT '{"hasSynced": false, "lastSync": null}'::jsonb,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_users_roles ON users USING GIN (roles);
CREATE INDEX idx_users_username ON users(username);

CREATE TRIGGER update_users_modtime BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_modified_column();
