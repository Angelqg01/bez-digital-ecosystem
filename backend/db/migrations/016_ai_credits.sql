-- Créditos del chat de IA: consumo por periodo (día/mes) y créditos comprados con Stripe.
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_credit_balance INTEGER NOT NULL DEFAULT 0 CHECK (ai_credit_balance >= 0);

CREATE TABLE IF NOT EXISTS ai_usage (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period  TEXT NOT NULL,              -- 'd:2026-10-05' | 'm:2026-10' (UTC)
    count   INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
    PRIMARY KEY (user_id, period)
);

-- Una compra de créditos se aplica una sola vez aunque el webhook llegue repetido.
CREATE TABLE IF NOT EXISTS ai_credit_grants (
    session_id TEXT PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pack_id    TEXT NOT NULL,
    credits    INTEGER NOT NULL CHECK (credits > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
