-- Phase 5: Social & Activity Feed
CREATE TABLE IF NOT EXISTS gamification_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enterprise_id UUID REFERENCES enterprises(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'achievement', 'level_up', 'referral', 'redemption'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    xp_value INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_gamification_activities_enterprise ON gamification_activities(enterprise_id);
CREATE INDEX idx_gamification_activities_created ON gamification_activities(created_at DESC);

-- Function to record activity
CREATE OR REPLACE FUNCTION record_gamification_activity(
    e_id UUID,
    a_type VARCHAR,
    a_title VARCHAR,
    a_desc TEXT,
    a_xp INTEGER,
    a_meta JSONB
) RETURNS VOID AS $$
BEGIN
    INSERT INTO gamification_activities (enterprise_id, type, title, description, xp_value, metadata)
    VALUES (e_id, a_type, a_title, a_desc, a_xp, a_meta);
END;
$$ LANGUAGE plpgsql;
