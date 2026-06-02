-- Migration: 010_gamification_automation.sql
-- Description: Add tables for per-user achievements and enterprise events.

CREATE TABLE IF NOT EXISTS user_achievements (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    achievement_key VARCHAR(100) NOT NULL,
    unlocked_at     TIMESTAMPTZ DEFAULT NOW(),
    xp_awarded      INTEGER NOT NULL,
    UNIQUE(user_id, achievement_key)
);

CREATE TABLE IF NOT EXISTS enterprise_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enterprise_id   UUID REFERENCES enterprises(id) ON DELETE CASCADE,
    event_key       VARCHAR(100) NOT NULL, -- 'safety_training', 'carbon_reduction', 'sales_target'
    value           NUMERIC(20, 8) DEFAULT 1,
    metadata        JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ent_events_ent ON enterprise_events(enterprise_id);
CREATE INDEX idx_ent_events_key ON enterprise_events(event_key);

-- Add some enterprise-specific rules
INSERT INTO achievement_rules (key, name, description, xp, threshold, metric_type) VALUES
('safety_1', 'Seguridad Primero', 'Completa tu primera capacitación de seguridad', 300, 1, 'event:safety_training'),
('carbon_hero', 'Héroe del Clima', 'Reduce tu huella de carbono en un 10%', 1000, 10, 'event:carbon_reduction'),
('sales_master', 'Maestro de Ventas', 'Alcanza la meta de ventas trimestral', 800, 1, 'event:sales_target'),
('zero_accidents', 'Cero Accidentes', 'Reporta 0 accidentes durante 30 días', 1200, 30, 'event:safety_days')
ON CONFLICT (key) DO NOTHING;
