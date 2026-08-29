-- 047_token_market_cache.sql
--
-- Mercados por cadena del par BEZ, para el endpoint publico
-- GET /api/gateway/v1/oracle/token-prices.
--
-- `token_price_cache` (migracion 006) guarda UN precio agregado del token.
-- Esta tabla guarda el detalle por cadena: que pool, a que precio y con cuanta
-- liquidez. La portada pinta una tarjeta por cadena y necesita poder decir
-- "pendiente de pool" en una mientras la otra ya cotiza; con un solo precio
-- agregado eso no se puede representar.
--
-- Las filas se siembran en `pending` con liquidez 0 a proposito: hoy no existe
-- ningun par BEZ/USDC desplegado. Es el estado real, y el consumidor sabe
-- pintarlo. Sembrar un precio inventado seria peor que no tener fila.

CREATE TABLE IF NOT EXISTS token_market_cache (
    chain_id      INTEGER PRIMARY KEY,
    symbol        VARCHAR(10)   NOT NULL DEFAULT 'BEZ',
    token_address VARCHAR(42)   NOT NULL,
    pool          VARCHAR(64),
    -- NULL, no 0: "todavia no hay precio" y "el precio es cero" son cosas
    -- distintas, y la portada las pinta distinto.
    price_usd     DECIMAL(18,8),
    liquidity_usd DECIMAL(20,2) NOT NULL DEFAULT 0,
    -- Se publica tal cual en una respuesta sin autenticar: mejor que la base
    -- rechace un estado desconocido a que llegue a la portada.
    status        VARCHAR(16)   NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('active', 'paused', 'pending')),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_market_symbol ON token_market_cache (symbol);

-- Direcciones ya desplegadas del token BEZ (ver CLAUDE.md, seccion contratos).
INSERT INTO token_market_cache (chain_id, symbol, token_address, pool, status)
VALUES
    (137, 'BEZ', '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8', 'QuickSwap V3',   'pending'),
    (56,  'BEZ', '0x8a1e3930fde1f151471c368fdbb39f3f63a65b55', 'PancakeSwap V3', 'pending')
ON CONFLICT (chain_id) DO NOTHING;
