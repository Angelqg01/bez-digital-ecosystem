---
title: "OPERANT — prueba de un trimestre y mejoras"
subtitle: "Logística, cadena de frío, DeFi (BEZ y stablecoins) y 4 bancos"
date: "4 de noviembre de 2026"
---

# 1. Objetivo

Probar cómo se comporta OPERANT, el sistema de agentes de gestión de BeZhas, durante **un trimestre (91 días)** trabajando con 4 navieras, 3 empresas de logística terrestre, 1 de cadena de frío, un desk DeFi (BEZ-Coin, stablecoins, supply/yield y farm con APY) y bancos en Dubái, Miami, Róterdam y Algeciras. La meta de fondo: la mayor red de blockchain automatizada, captadora de clientes del token BEZ.

# 2. Cómo se hizo

Una **simulación sintética y reproducible** (semilla fija) pasada por los módulos reales de OPERANT: líneas rojas de los agentes, cribado KYC/AML, cálculo de runway y auditoría encadenada por hash. No usa clientes ni bancos reales ni mueve dinero, y no ejecuta los agentes con modelo de lenguaje. Se calibró con cifras públicas (TEU 2025: Róterdam 14,2 M, Algeciras ≈4,74 M, PortMiami 1,12 M, Jebel Ali 15,55 M; reclamaciones reefer ≈30 % de las de contenedores según el Swedish Club; APY de Aave ≈2–5 %). Importes, saldos y tasa de excursión del frío son **supuestos**.

# 3. Resultados

| Medida | Resultado |
|:--|:--|
| Acciones evaluadas | 1.769 |
| Exigieron aprobación humana | 862 (48,7 %); pico de 18 al día |
| Pagos simulados | 558 por unos 48,2 M\$ (SEPA 158, SWIFT 271, BEZ 129) |
| Líneas rojas | Ningún pago, movimiento cripto, staking ni firma salió sin humano |
| Auditoría | 1.769 registros íntegros; una alteración se detecta en su posición exacta |
| DeFi | Caída de APY (día 41) y depeg de USDC al 0,96 (día 62) detectados el mismo día |
| Cadena de frío | 4 excursiones en 780 contenedores, 2 reclamaciones (muestra pequeña) |

# 4. Fallos encontrados y corregidos

1. **Cribado AML sin sentido para pagos entre empresas.** El umbral fijo de 5.000 \$ marcaba 552 de 558 pagos como riesgo medio. Ahora hay un segmento B2B con umbral de 100.000 \$ (la compra de BEZ sigue en 5.000 \$): 374 pagos bajos y 184 medios.
2. **Países de alto riesgo incompletos.** Rusia, Bielorrusia, Myanmar y Afganistán salían como riesgo bajo. Ahora son riesgo alto, sin depender de tildes y por palabra completa.
3. **El runway no veía divisas ni stablecoins.** Ahora el agente de tesorería suma bancos (AED, EUR, USD), stablecoins on-chain y el Treasury DAO, valorados a precio de mercado, y calcula el runway también bajo un depeg del 4 %. Con USDC a 0,96, el runway de un millón con gasto de 100.000 \$ al mes baja de 10 a 9,6 meses.
4. **Evals de routing desfasadas.** Fallaban las 24 pruebas por un contexto nulo; el enrutado en sí no estaba roto.

**Verificación:** 834 tests y 80 evals pasan sin fallos.

# 5. Cómo alimentar el runway

Los bancos no tienen API integrada, así que sus saldos entran por un fichero `data/treasury-positions.json` (no se sube a git) con la fecha de cada saldo; pasadas 72 horas se consideran obsoletos. Las stablecoins se leen on-chain por el RPC de Polygon y los precios y tipos de cambio vienen de fuentes públicas sin clave. Si el mercado cae o un saldo está obsoleto, el dato se marca como no fiable y **no dispara alertas críticas**.

# 6. Pendiente

- Crear el fichero real de saldos y configurar `POLYGON_RPC_URL` y `TREASURY_MONTHLY_BURN_USD`.
- Sustituir la lista de países por las listas oficiales de sanciones (UE, OFAC, ONU, GAFI).
- Medir cuánto tarda un humano en aprobar la retirada de una posición tras un depeg: detectar es inmediato, actuar no.
- Captación de clientes BEZ: Analytics muestra 13 usuarios al mes y 0 eventos clave; los eventos del embudo ya están en el código y falta desplegarlos y marcarlos como clave.
- Seguridad: `business-ops/.env.example` contiene tokens de Telegram que parecen reales; conviene revocarlos y regenerarlos.

# 7. Límites del test

La carga humana del 48,7 % refleja la mezcla de acciones supuesta, no la de un cliente real. Con 4 excursiones de frío no se sacan conclusiones. El farm/LP es un modelo de APY decreciente, no datos on-chain reales. Para medir la calidad de los agentes con modelo de lenguaje hay que ejecutar las evals con `EVALS_LIVE=1`.
