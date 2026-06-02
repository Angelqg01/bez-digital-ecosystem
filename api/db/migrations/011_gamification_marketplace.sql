-- Migration: 011_gamification_marketplace.sql
-- Description: Add marketplace tables for rewards redemption.

CREATE TABLE IF NOT EXISTS marketplace_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    cost_xp         INTEGER NOT NULL,
    type            VARCHAR(50) NOT NULL, -- 'discount', 'nft', 'service', 'perk'
    stock           INTEGER DEFAULT -1, -- -1 for infinite
    image_url       TEXT,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_redemptions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    item_id         UUID REFERENCES marketplace_items(id) ON DELETE CASCADE,
    status          VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processed', 'failed'
    redeemed_at     TIMESTAMPTZ DEFAULT NOW(),
    metadata        JSONB -- Store delivery details, codes, etc.
);

-- Seed some initial rewards
INSERT INTO marketplace_items (name, description, cost_xp, type, image_url) VALUES
('Descuento Gas Fee (20%)', 'Reduce el costo de gas en todas tus transacciones por 30 días.', 2000, 'perk', 'https://api.placeholder.com/400/320'),
('Auditoría Smart Contract', 'Una revisión profesional de seguridad para uno de tus contratos desplegados.', 15000, 'service', 'https://api.placeholder.com/400/320'),
('NFT Fundador BeZhas', 'Un NFT exclusivo que otorga acceso a eventos privados y gobernanza beta.', 10000, 'nft', 'https://api.placeholder.com/400/320'),
('Soporte Priority 24/7', 'Acceso directo a nuestro equipo técnico con respuesta en menos de 1 hora.', 5000, 'service', 'https://api.placeholder.com/400/320'),
('Dashboard Customizado', 'Desbloquea widgets avanzados de analítica logística para tu control center.', 3500, 'perk', 'https://api.placeholder.com/400/320')
ON CONFLICT DO NOTHING;
