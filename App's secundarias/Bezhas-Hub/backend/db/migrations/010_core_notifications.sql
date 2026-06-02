-- 010_core_notifications.sql
-- Notification System for BeZhas Platform

CREATE TYPE notification_type AS ENUM ('transaction', 'social', 'system', 'reward', 'security');

CREATE TABLE IF NOT EXISTS platform_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    action_url VARCHAR(255),
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user_id ON platform_notifications(user_id);
CREATE INDEX idx_notifications_read ON platform_notifications(user_id, read);
CREATE INDEX idx_notifications_created_at ON platform_notifications(created_at DESC);
