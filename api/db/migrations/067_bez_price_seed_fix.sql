-- 067_bez_price_seed_fix.sql
--
-- El precio de BEZ-Coin de la fase semilla es 0,0075 USD (config/bez-price.js,
-- confirmado por Yoel el 2026-09-18), pero la 006 sembró token_price_cache con
-- 0,10 USD y nada ha vuelto a escribir esa fila. Como la liquidación de compras
-- (paymentSettlement), el vigilante on-chain, la cotización de BEZ-Pay y el
-- oráculo público leen la tabla antes que la configuración, una compra de 25 USD
-- entregaba 250 BEZ en vez de 3.333.
--
-- Sólo se corrige la fila semilla intacta: si alguien ya ha escrito un precio
-- de mercado, se respeta.

UPDATE token_price_cache
   SET price_usd = 0.0075,
       change_24h = 0,
       updated_at = NOW()
 WHERE symbol = 'BEZ'
   AND price_usd = 0.10;
