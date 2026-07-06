# BeZhas — Plan Estratégico de Financiación & Expansión
> Versión: Junio 2026 | Autor: Claude (para Yoel, BeZhas founder)

---

## DIAGNÓSTICO INICIAL

**Activos reales que ya tienes:**
- L2 blockchain propia desplegada (BNB + Polygon)
- Token BEZ-Coin en dos redes (`0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8`)
- Smart contracts auditables: staking, DAO, marketplace, pagos, vesting
- Dominio + marca: `bez.digital`
- Stack tecnológico completo (OpenClaw, AEGIS, control-center, 14 sub-apps)
- Casos de uso reales: RWA, logística, aduanas, pagos internacionales

**Problema central:** Capital y liquidez. Todo lo demás ya existe.

---

## FASE 1 — LIQUIDEZ INMEDIATA (Semanas 1–4)

### 1.1 Listing en DEX + Liquidez inicial

**Objetivo:** BEZ-Coin negociable públicamente hoy.

| Acción | Detalle |
|--------|---------|
| QuickSwap V3 (Polygon) | Crear pool BEZ/USDC o BEZ/MATIC. Liquidez mínima: $5,000 USDC para precio estable |
| PancakeSwap V3 (BNB) | Pool BEZ/USDT. Liquidez mínima: $5,000 USDT |
| Configurar LP vesting | Lockear liquidez 12 meses → CertiK/Team.Finance → genera confianza automáticamente |

**Lo que yo puedo hacer ahora:**
- Escribir el script de deploy del pool de liquidez
- Generar la página de tokenomics para inversores
- Preparar el pitch deck técnico para el listing

### 1.2 CoinGecko / CoinMarketCap Listing

Un token listado en CG/CMC genera credibilidad gratuita y tráfico orgánico.

**Requisitos CoinGecko:**
- Pool activo con volumen > $1,000/24h
- Website funcional (bez.digital)
- Whitepaper público
- Contrato verificado en Polygonscan/BSCScan

**Lo que yo puedo hacer ahora:**
- Redactar el whitepaper completo (20–30 páginas)
- Verificar y limpiar el contrato para Polygonscan
- Rellenar el formulario de listing (CG/CMC) y preparar todos los assets

---

## FASE 2 — FUNDRAISING ESTRUCTURADO (Mes 1–3)

### 2.1 Ronda Seed/Angel (€50K–€500K)

**Target:** Business angels tech/fintech en España y Europa.

**Canales prioritarios:**
- **Lanzadera (Valencia)** — Acepta proyectos blockchain/fintech. Ticket hasta €150K + red de mentores
- **Wayra (Telefónica)** — Programa open call permanente. Foco en B2B tech
- **ENISA (ICO español)** — Préstamo participativo hasta €300K. Sin dilución de equity
- **Horizon Europe (Grants)** — Fondos EU para proyectos blockchain/DePIN. Sin devolución

**Documentos necesarios (puedo generarlos):**
- [ ] One-pager ejecutivo (1 página, para CEO)
- [ ] Pitch deck (12 slides)
- [ ] Data room: tokenomics, contratos auditados, proyecciones financieras
- [ ] Modelo financiero 3 años (Excel)

### 2.2 IDO — Initial DEX Offering

**Plataformas objetivo:**

| Plataforma | Red | Ventaja |
|------------|-----|---------|
| **DAO Maker** | Multi-chain | Mayor reputación EU, comunidad activa |
| **Polkastarter** | Polygon nativo | Perfecto para BEZ en Polygon |
| **PinkSale** | BNB + Polygon | Más fácil de acceder, menos KYC para el proyecto |
| **Gempad** | BNB | Rapidez de listing, comunidad BSC |

**Estructura IDO recomendada:**
- Precio IDO: X (definir según valoración objetivo)
- Softcap: $50,000 / Hardcap: $300,000
- Vesting: 25% TGE + 75% lineal 6 meses
- Whitelist: KYC obligatorio (cumplimiento MiCA/UE)

**Lo que yo puedo hacer:**
- Redactar el documento de IDO (terms, tokenomics, vesting schedule)
- Crear la landing page del IDO en HTML/React
- Preparar los materiales de KYC para la plataforma

### 2.3 Grants Blockchain (Capital sin dilución)

Fuentes de grants específicas para blockchain B2B:

| Grant | Monto | Requisito |
|-------|-------|-----------|
| **Polygon Village Grants** | $10K–$100K | Proyecto en Polygon (✅ ya estás) |
| **BNB Chain MVB Program** | $50K+ | Proyecto en BNB (✅ ya estás) |
| **Filecoin Foundation** | $10K–$250K | Integrar IPFS/Filecoin en RWA |
| **Arbitrum LTIPP** | $50K–$500K | Migrar/deployar en Arbitrum |
| **European Blockchain Sandbox** | Acceso + visibilidad EU | Caso de uso regulatorio |

---

## FASE 3 — VENTAS B2B (El motor real)

Esta es la clave. Los tokens sin utilidad mueren. BEZ-Coin con clientes reales sube solo.

### 3.1 Pipeline de Clientes Objetivo (España)

Sectores donde BEZ tiene producto hoy:

**Logística / Aduanas (BZ CargoLink + BZ PureScan)**
- Transitarios de Algeciras: Campo Gibraltar tiene el puerto más activo de España
- AEAT / Agencia Tributaria: Traceabilidad aduanera inmutable
- Cámaras de Comercio: Certificación de origen en blockchain

**Alimentación (BZ PureScan)**
- Cooperative agrícolas de Andalucía
- Exportadores de aceite de oliva, vino, pescado
- Supermercados con producto de marca propia (Mercadona, Carrefour)

**Real Estate (RWA)**
- Promotoras inmobiliarias: tokenización de participaciones en proyectos
- Fondos de inversión inmobiliaria alternativos

### 3.2 Estrategia "Caballo de Troya" para CEOs

**Mensaje externo (NUNCA decir "blockchain"):**
> "Le ofrecemos una red empresarial privada donde sus contratos se ejecutan automáticamente, su trazabilidad es inmutable ante la AEAT, y sus pagos internacionales liquidan en tiempo real a coste mínimo. El activo que usa la red para operar se llama BEZ."

**Propuesta de valor por sector:**

| Sector | Dolor | Solución BeZhas | KPI |
|--------|-------|-----------------|-----|
| Logística | Fraude documental, retrasos | BZ CargoLink: contrato auto-ejecutable | -40% tiempo despacho aduanas |
| Alimentación | Retiradas de mercado costosas | BZ PureScan: trazabilidad lote a lote | Cumplimiento UE Reg. 178/2002 |
| Inmobiliario | Liquidez bloqueada en activos | RWA tokenizado: participaciones fraccionadas | Liquidez en 48h vs 6 meses |

### 3.3 Helix — Agente de Ventas Autónomo

Helix ya tiene su framework. Lo que falta es activarlo:

**Canales a automatizar con Helix:**
1. **LinkedIn Sales Navigator** — Prospección CEO/CFO de empresa target
2. **Email outreach** — Secuencia 5 emails (puedo escribirla hoy)
3. **Cold calling script** — Argumentario telefónico por sector
4. **HubSpot CRM** — Pipeline automatizado (ya conectado via MCP)

**Lo que yo puedo hacer ahora:**
- Escribir secuencias de email completas por sector (logística, alimentación, RWA)
- Crear el argumentario de ventas Helix con manejo de objeciones
- Configurar el pipeline en HubSpot
- Crear los documentos de propuesta comercial personalizados

---

## FASE 4 — EXPANSIÓN TÉCNICA (Mes 3–6)

### 4.1 Nuevas integraciones para subir el valor del token

| Integración | Impacto en precio BEZ | Esfuerzo |
|-------------|----------------------|----------|
| **Chainlink Price Feed** | Alto — hace BEZ "legible" para DeFi | Medio |
| **LayerZero bridge** | Alto — BEZ nativo cross-chain | Alto |
| **Aave/Compound colateral** | Muy alto — BEZ como garantía DeFi | Alto |
| **SWIFT ISO 20022 connector** | Diferenciador único B2B | Medio |

### 4.2 Tokenomics upgrade

Si el tokenomics actual no está optimizado para crecimiento, hay que ajustarlo:

**Modelo recomendado:**
- 40% Ecosystem & Ventas (liberación según hitos)
- 20% Team (cliff 12 meses, vesting 36 meses)
- 15% IDO/Public sale
- 10% Seed/Angel (vesting 18 meses)
- 10% Staking rewards (emitidos durante 4 años)
- 5% Liquidez DEX (locked 12 meses)

---

## FASE 5 — MARKETING & COMUNIDAD (Paralelo)

### 5.1 Contenido que yo puedo generar hoy

- **Whitepaper técnico** (30 páginas, EN + ES)
- **Litepaper** (5 páginas, para no-técnicos)
- **Thread de Twitter/X** (15 tweets explicando BeZhas)
- **Artículos Medium** (3 artículos: tecnología, casos de uso, tokenomics)
- **Pitch para podcasts** (crypto/blockchain EN/ES)
- **Press release** para medios especializados (CoinDesk, Decrypt, The Block)

### 5.2 Comunidad

| Canal | Meta mes 1 | Acción |
|-------|-----------|--------|
| Telegram | 500 miembros | Bot de bienvenida + FAQ automatizado |
| Discord | 300 miembros | Canales por sector B2B |
| Twitter/X | 1,000 seguidores | 3 posts/día (puedo generar el calendario) |

---

## PRIORIDAD MÁXIMA — QUÉ HACER ESTA SEMANA

1. **Hoy:** Whitepaper + Litepaper → necesario para TODO lo demás
2. **Día 2–3:** Verificar contrato en Polygonscan + crear pool de liquidez
3. **Día 4–5:** Aplicar a Polygon Village Grants + BNB Chain MVB
4. **Día 5–7:** Pitch deck para angels + aplicar a Lanzadera

---

## LO QUE PUEDO HACER YO (Claude) — MENÚ CONCRETO

Dime cuál quieres primero:

| # | Entregable | Tiempo estimado |
|---|-----------|-----------------|
| A | **Whitepaper completo** (30 págs, EN+ES) | 1 sesión |
| B | **Pitch deck** (12 slides, formato Investor-ready) | 1 sesión |
| C | **Modelo financiero** 3 años en Excel | 1 sesión |
| D | **Secuencias email Helix** por sector (5 emails × 3 sectores) | 1 sesión |
| E | **Formulario Grant** Polygon Village / BNB Chain | 1 sesión |
| F | **Landing page IDO** en HTML/React | 1 sesión |
| G | **Tokenomics document** revisado con tabla de distribución | 1 sesión |
| H | **Script de verificación** contrato Polygonscan + deploy pool DEX | 1 sesión |
| I | **Pipeline HubSpot** configurado con Helix (via MCP) | 1 sesión |
| J | **Calendario de contenido** Twitter/Medium 30 días | 1 sesión |

---

*Plan generado: Junio 2026 — BeZhas Strategic Intelligence*
