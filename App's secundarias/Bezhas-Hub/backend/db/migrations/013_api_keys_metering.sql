-- 013_api_keys_metering.sql
-- =============================================================================
-- Medición de uso de API por organización/sede (base de la facturación B2B).
-- Aditivo: añade columnas nullable a api_logs e índices de agregación.
-- =============================================================================

ALTER TABLE api_logs ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE api_logs ADD COLUMN IF NOT EXISTS site_id UUID;

CREATE INDEX IF NOT EXISTS idx_api_logs_org ON api_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_org_site ON api_logs(org_id, site_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_org_time ON api_logs(org_id, timestamp);
