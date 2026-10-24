-- 074_ai_action_usage.sql
--
-- Cupo mensual de acciones de IA (config/plans.js: aiActions) para el gateway REST y el MCP.
--
-- Un contador por app y mes, no filas en gateway_usage_ledger: ese ledger es de facturación y
-- /subscription/usage y el resumen del Starter cuentan sus filas como llamadas, así que una fila por
-- acción duplicaría el consumo que ve el cliente. El chat de la plataforma sigue contando sus
-- mensajes en el ledger (action = 'ai_chat'); services/aiActionQuota.js suma las dos fuentes, así
-- que el cupo del plan es uno solo.

CREATE TABLE IF NOT EXISTS ai_action_usage (
    app_id      TEXT        NOT NULL,
    period      DATE        NOT NULL,                  -- primer día del mes (date_trunc('month', NOW()))
    used        INTEGER     NOT NULL DEFAULT 0 CHECK (used >= 0),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (app_id, period)
);
