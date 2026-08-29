# Plan de fusión — `Landing Nueva/` → Landing Home (`app/(landing)/page.tsx`)

> **Estado: IMPLEMENTADO (2026-08-29).** La Home fusionada esta en
> `control-center/frontend/app/(landing)/page.tsx` con 17 secciones, tema claro/oscuro
> conmutable y disclaimer MiCA. Ver la seccion 10 al final para lo que quedo fuera.
> Fuentes: `Landing Nueva/Landing Nueva.html` (75 KB) y `Landing Nueva/Nueva landing 2.html` (93 KB).
> Destino: `control-center/frontend/app/(landing)/page.tsx` + `app/globals.css` + `api/routes/gateway.js`.

---

## 1. Qué son estos dos archivos

Son **la misma landing**; el segundo es el primero **más un bloque nuevo**. El `diff` da 457 líneas
exclusivas de `Nueva landing 2.html`, y todas pertenecen a un único componente: el
**widget de Oráculo BEZ/USD + tarjetas de contrato desplegado**, insertado dentro de la sección `#token`.

Conclusión operativa: **trabajar solo con `Nueva landing 2.html`**. `Landing Nueva.html` es un
subconjunto y no aporta nada que el segundo no tenga.

### Sistema de diseño que traen

| | Landing Home actual | Landing Nueva |
|---|---|---|
| Fondo | Oscuro `#050711` | **Claro** `#F2F5F5` con sesgo petróleo |
| Display | Space Grotesk / Inter | **Syne** 600–800 |
| Texto | Inter | **Archivo** |
| Datos | — | **JetBrains Mono** (tabular-nums) |
| Acento | Azul `#0d33f2` + cian `#22D3EE` + ámbar | **Teal `#046C7A`** + cian `#22D3EE` (solo sobre oscuro) + violeta `#6D3AE0` + naranja señal `#DC5327` |
| Ritmo | Secciones planas apiladas | Alternancia `slab-white` / `slab-paper` / `slab-deep` + 2 secciones **ancla sticky** |

---

## 2. Contenido nuevo que aportan (y que la Home no tiene)

Verificado contra el repo antes de proponerlo.

### 2.1 Narrativa de problema — **nuevo**
"Ninguna empresa puede certificar su propia cadena." Explica por qué existe BeZhas antes de
enumerar productos. La Home actual salta directa a tarjetas de producto sin plantear el problema.
Acompañado de un **bloque de código con el esquema de atestación real** (`protocol`, `event`,
`evidenceHash`, `jurisdiction`, `signer`, `schema`, `freshness`, `confidence`) y la línea clave:
*"factura, PII y ruta permanecen fuera de la cadena"*.

### 2.2 Cadena de evidencia en 6 pasos — **nuevo, alto valor B2B**
ERP emite → Edge Node valida → Smart Wallet aplica política → MultiSig aprueba lo sensible →
contrato sectorial registra → auditor exporta. Con tags de contratos y roles reales por paso.
Es la respuesta a la pregunta que hace todo CTO: *"¿dónde encaja esto en mi stack?"*.

### 2.3 Siete protocolos verticales con mapa de contratos — **nuevo, el activo más fuerte**
Logística · Manufactura · RWA/finanzas/fiscalidad · Energía y ESG · Salud y bio ·
Seguros y bóvedas DeFi · Legal, IP y gobierno · (+ modelo de oráculo).

> **Verificado: los 35 contratos citados existen en `smart-contracts/src/`.**
> `SupplyTracker`, `CustomsClearanceOracle`, `ClearanceCertificateNFT`, `DigitalTwinRegistry`,
> `MaterialTokenMRP`, `PredictiveMaintenanceLog`, `QualityCertificateNFT`, `LandCadastralRegistry`,
> `LandTitleNFT`, `VehicleIdentityNFT`, `InvoiceFactoring`, `MicroLendingPool`, `TreasuryVault`,
> `SolarFarmToken`, `P2PEnergyMarket`, `CarbonCreditToken`, `ESGScoreOracle`, `HealthRecordSBT`,
> `ClinicalDataMarketplace`, `PharmaTracker`, `HealthInsuranceEscrow`, `PolicyNFT`,
> `ParametricInsurance`, `ClaimAdjuster`, `ReinsurancePool`, `EvidenceVault`, `IPRegistryNFT`,
> `IdentityRegistry`, `GovernanceSystem`, `SmartWalletFactory`, `MultiSigWallet`, `Paymaster`,
> `WarehouseManager`, `ProcurementNFT`, `QualityEscrow` — **35/35 encontrados.**
> El repo tiene **97 ficheros `.sol`**, así que el "30+ contratos" de la landing es conservador.

Esto convierte la Home de escaparate genérico en **catálogo técnico verificable**, que es
exactamente lo que la nota de CLAUDE.md pide para instituciones y empresas.

### 2.4 AEGIS — seguridad fail-closed — **nuevo**
Ocho controles: ventana de frescura y anti-replay · pausa por capas · separación de funciones
(HSM/KMS, MultiSig, timelock) · revocación sin redespliegue · lo regulado no toca la cadena ·
**MiCA · DAC8 · AEAT · AML/KYC** · aprobación humana obligatoria en agentes IA · paquete
post-incidente. Con la frase de posicionamiento: *"Preferimos una liquidación bloqueada a una
liquidación equivocada."*
Existe respaldo real: directorio `aegis/` con `aegis_dept_agents`, y `EDGE_NODE_ROLE` /
`AUDITOR_ROLE` presentes en los `.sol`.

### 2.5 Integraciones — **nuevo**
Logowall de sistemas empresariales (SAP · Odoo · Salesforce · MES · IoT · **MCP nodo dedicado**) y
de redes (Ethereum L1 · **BeZhas L2 chainId 2708** · Polygon · BNB Chain · IPFS).
`chainId 2708` está confirmado en `deploy-config.json:4`.

### 2.6 Ficha del token — **enriquece lo existente**
`<dl>` con red de asentamiento, capa de ejecución, **supply 3.000.000.000 BEZ** (confirmado en
`api/__tests__/integration/live-chain.test.js:128`), estándar, puentes, gobernanza, marco regulatorio.
Más cuatro usos concretos: gas de la L2 con Paymaster · liquidación entre proveedores vía
`BeZhasPayment`/`QualityEscrow` · acceso al SDK B2B · gobernanza y recompensas de Edge Node (DePIN).
Y el disclaimer MiCA: *"No es un producto de inversión."*

### 2.7 Oráculo BEZ/USD en vivo — **nuevo, solo en `Nueva landing 2.html`**
Es la pieza técnica más valiosa del segundo archivo:
- Tres estados visuales: `live` / `stale` / `down`, con punto de color y etiqueta.
- **Aplica la misma regla fail-closed que la red**: fuera de la ventana de frescura la lectura se
  marca *obsoleta* y no se presenta como vigente. Coherencia narrativa perfecta con AEGIS.
- Tarjeta por cadena (Polygon 137 / BNB 56) con dirección, **botón copiar**, precio, liquidez del par
  y estado del pool, más enlace a Polygonscan / BscScan.
- Polling 30 s, timeout 7 s, `AbortController`, **backoff exponencial** hasta ×8 tras 3 fallos,
  pausa en `visibilitychange`, skeletons `shimmer` mientras carga.
- Degrada con dignidad: sin pool → *"Oráculo pendiente · a la espera del primer par BEZ/USDC"*.

### 2.8 Recursos — **nuevo**
Whitepaper (en preparación) · **Control pack CTO/CISO** · Deck enterprise (enlace ya existente) ·
Developer portal. El "control pack" es un imán de leads institucional que hoy no existe.

### 2.9 Ticker de red — **nuevo**
Cinta continua: chainId 2708 · Ethereum L1 · 3B supply · 7 verticales · 30+ contratos ·
puentes · MiCA/DAC8/AEAT · AEGIS fail-closed.

### 2.10 Capa de interacción — **nuevo**
Canvas de red de nodos en el hero · barra de progreso de scroll · scroll-reveal escalonado ·
contadores animados · **dos paneles ancla sticky** (Misión, AEGIS) que se despliegan con el scroll ·
cursor personalizado · nav que encoge. Todo con guarda `prefers-reduced-motion`.

---

## 3. Lo que la Home actual ya tiene y **no se toca**

Inventario de enlaces a preservar íntegros:

**Rutas internas** — `/solutions` `/token` `/token/buy` `/docs` `/commerce` `/network`
`/enterprise` `/validators` `/developers` `/support` `/demo` `/financial` `/privacy`
`/learn` `/rpc` `/bridges` `/payments` `/dashboard` `/dashboard/farming` `/dashboard/qr`
y las anclas `/developers#hub`, `/developers#defi`, `/developers#vision`.

**Externos** — `STRIPE_PAYMENT_LINKS.tokenPurchase` · Polygonscan del contrato ·
`mailto:info.angelqg@gmail.com` · Deck de Drive · `https://t.me/BeZhasBot` ·
`DEFI_TOKENOMICS_URL` (`NEXT_PUBLIC_BEZHAS_DEFI_URL` → `/financial`).

**Las 5 SubApps del marquee** con sus URLs Cloud Run vivas — `bezhas-hub`, `bezhas-capital/defi`,
`bezhas-purescan`, `bezhas-energy`, `bezhas-cargolink` (`*-o5xep6gbwq-ew.a.run.app`).

**Bloques funcionales** — hook `useOracleTokenPrices` (SWR), tarjetas `nativeApps`,
marquee `subapp-marquee` auto-scroll, `networkStats`, `liveFeed`, `audienceTracks`, `ecosystemCards`.

> ⚠️ La sección **Ecosistema** de la landing nueva enlaza sus 5 apps a `#contacto`.
> Al fusionar hay que **sustituir esos `href="#contacto"` por las URLs Cloud Run reales**
> de `secondaryApps`. Es el punto de mayor riesgo de perder enlaces.

---

## 4. Los tres conflictos reales

### C1 — Tema claro contra tema oscuro
La landing nueva es **claro sobre `#F2F5F5`**; la Home actual es **oscuro sobre `#050711`**, y el
`layout.tsx` de `(landing)` (header con dropdowns + sidebar) está construido para oscuro.
Una Home clara dentro de un chrome oscuro se ve rota.

**Resolución propuesta:** conservar el **hero oscuro actual** (funciona, y es donde vive el widget
de precio y la identidad de marca) y aplicar el sistema claro **de la sección Misión hacia abajo**,
respetando la alternancia `paper / white / deep` del original. La landing nueva ya prevé esto:
tiene `slab-deep` para invertir a oscuro. El resultado es un documento con ritmo, no un cambio
de tema a medias.

### C2 — Nav y footer duplicados
`Nueva landing 2.html` trae su propio `<header class="navbar">` con búsqueda y su propio `<footer>`
de 5 columnas. El proyecto ya tiene ambos en `app/(landing)/layout.tsx`.

**Resolución:** **no importar** el nav ni el footer del HTML. Sí adoptar del footer nuevo el
**disclaimer MiCA/AEAT**, que hoy no existe y es obligación informativa.

### C3 — El widget de oráculo pide un contrato de API que el backend no sirve
| El widget espera | El endpoint devuelve hoy |
|---|---|
| `price` (número plano) | `tokens.BEZ.priceUSD` |
| `change24h` | `tokens.BEZ.change24h` ✅ |
| `updatedAt` | `updatedAt` ✅ |
| `freshnessWindow` (segundos) | **no existe** |
| `markets[]` con `chainId`, `price`, `liquidityUsd`, `pool`, `status` | **no existe** |
| `source` | **no existe** |

`api/routes/gateway.js:1491` (`GET /oracle/token-prices`) tiene memo de 15 s, rate-limit de 120/min
y precio semilla `0.10`. Falta la parte de frescura y de mercados por cadena.

**Resolución:** extender el endpoint de forma **aditiva** (añadir campos, no renombrar los que ya
consume `readOracleToken` en la Home). Ver tarea F1.

---

## 5. Arquitectura de la Home fusionada

Orden propuesto, marcando origen de cada bloque:

| # | Sección | Origen | Nota |
|---|---|---|---|
| 1 | **Hero oscuro** + tarjeta de precio + terminal de red | ACTUAL | se le añade el **canvas de red de nodos** del HTML nuevo |
| 2 | **Ticker** de datos de red | NUEVO | cinta bajo el hero |
| 3 | **Misión** (panel ancla sticky) | NUEVO | Anclar · Validar · Probar |
| 4 | **El problema** + esquema de atestación | NUEVO | claro `slab-white` |
| 5 | **Cadena de evidencia** (6 pasos) | NUEVO | `slab-paper` + 4 contadores |
| 6 | **Ecosistema Chain-Flow** (4 tarjetas) | ACTUAL | enlaces `/commerce` `/network` `/enterprise` `/validators` intactos |
| 7 | **7 protocolos verticales** | NUEVO | `slab-white`; cada tarjeta enlaza a su ruta actual |
| 8 | **AEGIS** (panel ancla sticky) | NUEVO | |
| 9 | **El protocolo falla cerrado** (8 controles + 4 stats) | NUEVO | `slab-deep`, oscuro |
| 10 | **Integraciones** (logowall ×2) | NUEVO | `slab-paper` |
| 11 | **BEZ-Coin**: ficha + 4 usos + **oráculo en vivo** | NUEVO + ACTUAL | conserva Stripe, Polygonscan y `/financial` |
| 12 | **Tres caminos de entrada** | ACTUAL | Empresas / Developers / Comunidad |
| 13 | **Apps Nativas** + marquee de SubApps | ACTUAL | con estilo nuevo; **URLs Cloud Run intactas** |
| 14 | **Feed del ecosistema** | ACTUAL | |
| 15 | **Recursos** (4 tarjetas) | NUEVO | whitepaper, control pack, deck, dev portal |
| 16 | **Contacto / piloto** | NUEVO + ACTUAL | copy nuevo, `contactLinks` actuales |
| 17 | Disclaimer MiCA | NUEVO | |

De 8 secciones actuales a 17. La Home pasa de folleto a documento de venta institucional.

---

## 6. Plan de implementación

### Fase 0 — Preparación (30 min)

**F0.1** Rama: `feat/landing-home-fusion` desde `feat/bez-energy-vpp-iot`.

**F0.2** Fuentes. Añadir en `app/layout.tsx` junto a las que ya hay:
```ts
import { Syne, Archivo, JetBrains_Mono } from "next/font/google";
```
con `variable: '--font-syne' | '--font-archivo' | '--font-mono-data'` y `display: 'swap'`.
Sin `<link>` a `fonts.googleapis.com`: `next/font` autoaloja y evita CLS.

**F0.3** Registrarlas en `tailwind.config.ts` → `theme.extend.fontFamily`.

---

### Fase 1 — Sistema de diseño aislado (2 h)

**F1.1** Crear `app/(landing)/home.module.css` con **todo** el CSS de `Nueva landing 2.html`
(≈1.030 líneas) portado. Un **CSS Module**, no `globals.css`: sus variables (`--paper`, `--ink`,
`--accent`, `--line`…) chocarían con las de Tailwind y con las páginas del dashboard.

**F1.2** Envolver la parte clara en `<div className={s.bzHome}>` y **redefinir ahí** las variables,
no en `:root`. Así el chrome oscuro del layout sigue intacto.

**F1.3** Portar a `globals.css` solo lo verdaderamente global y de una vez:
`prefers-reduced-motion`, `:focus-visible` con `outline: 2px solid var(--accent)`, y `scroll-padding-top`.

**F1.4** Convertir a clases de módulo, sin `!important` y sin CSS global nuevo:
`slab`, `slab-white`, `slab-paper`, `slab-deep`, `wrap`, `grid12`, `sec-head`, `eyebrow`,
`sec-title`, `lede`, `btn` (`btn-solid` / `btn-ghost` / `btn-beam` / `btn-onDark`), `rv`,
`stats`, `stat`, `chain`, `chain-step`, `vcard`, `ctrl`, `logo-chip`, `panel`, `apps`, `res`,
`rcard`, `oracle`, `ccard`, `ticker`, `anchor*`.

---

### Fase 2 — Componentes React (6–8 h)

Todos en `app/(landing)/_components/`. La Home queda como composición legible.

| Componente | Contenido | Props / datos |
|---|---|---|
| `HeroNetCanvas.tsx` | canvas de red de nodos | `'use client'`, cleanup de `rAF` en unmount, corta si `prefers-reduced-motion` o `document.hidden` |
| `NetworkTicker.tsx` | cinta de datos | array de pares `[label, value]` |
| `AnchorPanel.tsx` | panel ancla sticky | `title`, `pills[]`, `art` — sirve para Misión y AEGIS |
| `EvidenceChain.tsx` | 6 pasos | array `steps[]` con `n`, `title`, `desc`, `tags[]` |
| `VerticalProtocols.tsx` | 7+1 tarjetas | `verticals[]` con `icon` (SVG inline), `title`, `desc`, `contracts`, **`href`** |
| `SecurityControls.tsx` | 8 controles + 4 stats | `controls[]`, `stats[]` |
| `IntegrationsWall.tsx` | 2 logowalls | `groups[]` |
| `TokenFacts.tsx` | `<dl>` + lista de usos | estático |
| `OraclePanel.tsx` | **widget de oráculo** | usa `useOracleTokenPrices`, no `fetch` crudo |
| `ResourceCards.tsx` | 4 recursos | `resources[]` |
| `Reveal.tsx` | wrapper scroll-reveal | `IntersectionObserver`, `--i` para escalonar |
| `Counter.tsx` | contador animado | `to`, `suffix` |
| `ScrollProgress.tsx` | barra de progreso | |

**Regla dura para `VerticalProtocols`:** cada vertical **debe** llevar `href` a una ruta que ya
existe. Mapeo propuesto:

| Vertical | `href` |
|---|---|
| Logística global | `/commerce` |
| Manufactura industrial | `/solutions` |
| RWA, finanzas y fiscalidad | `/financial` |
| Energía y ESG | `https://bezhas-energy-o5xep6gbwq-ew.a.run.app` |
| Salud y bio | `/solutions` |
| Seguros y bóvedas DeFi | `/financial` |
| Legal, IP y gobierno | `/enterprise` |
| Modelo de oráculo | `/network` |

**Nota sobre `OraclePanel`:** **no** portar el `fetch` + `setTimeout` del HTML. El proyecto ya
tiene SWR con polling de 30 s y deduplicación. Se reimplementa la **lógica de frescura** (que sí es
nueva y valiosa) sobre los datos del hook:

```ts
const stale = Date.now() - Date.parse(updatedAt) > (freshnessWindow ?? 900) * 1000;
const state = price == null ? 'down' : stale ? 'stale' : 'live';
```
Se conserva del HTML: el **botón copiar** con fallback `execCommand`, los skeletons, los
formatos `fmtPrice` / `fmtUsd` / `ago`, y los tres estados visuales.

---

### Fase 3 — Backend del oráculo (2–3 h)

**F3.1** Extender `GET /oracle/token-prices` en `api/routes/gateway.js:1491` de forma **aditiva**:
```jsonc
{
  "success": true,
  "tokens": { "BEZ": { … } },        // se mantiene, lo consume readOracleToken
  "bezCoinPriceUSD": 0.10,            // se mantiene
  "bezCoinChange24h": 0,              // se mantiene
  "updatedAt": "…",                   // se mantiene
  "freshnessWindow": 900,             // NUEVO — desde ORACLE_FRESHNESS_WINDOW_S
  "source": "bezhas-oracle",          // NUEVO — "seed" cuando cae al precio semilla
  "markets": [                        // NUEVO
    { "chainId": 137, "price": 0.10, "liquidityUsd": 0, "pool": "QuickSwap V3", "status": "pending" },
    { "chainId": 56,  "price": null, "liquidityUsd": 0, "pool": "PancakeSwap V3", "status": "pending" }
  ]
}
```

**F3.2** Fuente de `markets`: tabla nueva `token_market_cache` (`chain_id`, `pool`, `price_usd`,
`liquidity_usd`, `status`, `updated_at`) o, si aún no hay pools, **constante servida con
`status: "pending"`**. Honesto y suficiente: el widget ya pinta *"Pendiente de pool"* sin romperse.

**F3.3** Nueva variable en `.env.example`: `ORACLE_FRESHNESS_WINDOW_S=900`.

**F3.4** Tests en `api/__tests__/routes/gateway-oracle-prices.test.js`: presencia de los campos
nuevos, que `markets` sea siempre array, y que el precio semilla venga con `source: "seed"`.

---

### Fase 4 — Ensamblado de la Home (3–4 h)

**F4.1** Reescribir `app/(landing)/page.tsx` con las 17 secciones. Mantener arriba **todas** las
constantes actuales (`secondaryApps`, `nativeApps`, `contactLinks`, `liveFeed`, `networkStats`,
`ecosystemCards`, `audienceTracks`, `tokenMarkets`) sin tocar un solo `href`.

**F4.2** Portar la sección **Ecosistema** de la landing nueva **fusionándola con `secondaryApps`**:
se queda el diseño nuevo (`.app` con `pulse` de "En producción") y los `href` Cloud Run actuales.
Sustituye visualmente al marquee o convive con él — decisión de diseño, no de datos.

**F4.3** Adoptar el disclaimer MiCA del footer nuevo al final de la Home.

**F4.4** `metadata.ts`: actualizar `description` con la nueva propuesta de valor
("estándar digital entre la empresa y la cadena de bloques") y añadir keywords
`AEGIS`, `MiCA`, `DAC8`, `RWA`, `trazabilidad`, `Edge Node`, `ERP blockchain`.

---

### Fase 5 — Verificación (2 h)

**F5.1** `pnpm build` sin errores ni avisos nuevos.

**F5.2** **Auditoría de enlaces**: script que extraiga todo `href` de la Home anterior y confirme
que sigue presente en la nueva. Es la comprobación que blinda el requisito del encargo.

**F5.3** Lighthouse. Objetivo: no bajar del score actual. Vigilar CLS por las fuentes nuevas y
LCP por el canvas del hero.

**F5.4** Accesibilidad: `prefers-reduced-motion` desactiva canvas, reveal, contadores, ticker y
cursor; foco visible en todo; contraste AA en teal `#046C7A` sobre `#F2F5F5`
(ratio ≈ 5.9:1, cumple).

**F5.5** Responsive en 375 / 768 / 1280 con el Browser pane. Los paneles ancla sticky son lo más
frágil en móvil: si el `scroll-driven` se atasca, degradar a estáticos por debajo de 768 px.

**F5.6** Widget de oráculo en los tres estados: con precio fresco, con `updatedAt` viejo (→ obsoleto)
y con la API caída (→ *"Oráculo pendiente"*).

---

## 7. Riesgos y decisiones que requieren tu criterio

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | **Peso de la página.** ~1.030 líneas de CSS + canvas + 3 fuentes nuevas | CSS Module (se hace *tree-shake* por ruta), `next/font` autoalojado, canvas solo en desktop sin reduced-motion |
| R2 | **Ruptura de enlaces** al portar la sección Ecosistema (`href="#contacto"` en el HTML) | F5.2 lo detecta; F4.2 lo previene |
| R3 | **Choque de variables CSS** con Tailwind y el dashboard | Todo bajo `.bzHome` en CSS Module, nunca en `:root` |
| R4 | **`ERC-3643` en la ficha del token no existe en el repo** (grep sin resultados) | Quitarlo, o marcarlo *"en hoja de ruta"*. Es una afirmación de cumplimiento — no conviene publicarla sin contrato detrás |
| R5 | Los verticales prometen **7 protocolos completos**; hay contratos, no necesariamente suites de test por vertical | Antes de publicar, verificar `forge test` por carpeta y ajustar el copy si algún vertical está a medias |
| R6 | "5 agentes de IA bajo aprobación humana" | Confirmar contra `aegis/aegis_dept_agents/agents` antes de publicar la cifra |
| R7 | **Paneles ancla sticky** en Safari iOS | Fallback estático < 768 px |
| R8 | Dos secciones oscuras (`slab-deep`) dentro de página clara | Es intencional en el diseño original; validar visualmente |

---

## 8. Esfuerzo

| Fase | Horas |
|---|---|
| F0 Preparación | 0,5 |
| F1 Sistema de diseño | 2 |
| F2 Componentes React | 7 |
| F3 Backend del oráculo | 2,5 |
| F4 Ensamblado | 3,5 |
| F5 Verificación | 2 |
| **Total** | **≈ 17,5 h** (2–3 jornadas) |

Ruta corta si hace falta enseñar algo antes: **F0 → F1 → F2 (solo `VerticalProtocols`,
`EvidenceChain`, `SecurityControls`) → F4 parcial**. Son ~6 h y ya entregan el 70 % del valor
comercial: el problema, la cadena de evidencia, los 7 verticales y AEGIS. El oráculo en vivo
(F3) puede ir después.

---

## 9. Orden de commits sugerido

1. `feat(landing): fuentes Syne/Archivo/JetBrains Mono via next/font`
2. `feat(landing): sistema de diseño claro aislado en home.module.css`
3. `feat(landing): componentes Reveal, Counter, ScrollProgress, NetworkTicker`
4. `feat(landing): cadena de evidencia y 7 protocolos verticales`
5. `feat(landing): AEGIS — controles de seguridad fail-closed`
6. `feat(landing): integraciones y ficha ampliada de BEZ-Coin`
7. `feat(api): oracle/token-prices publica freshnessWindow, source y markets`
8. `feat(landing): panel de oráculo en vivo con estados live/stale/down`
9. `feat(landing): hero canvas, paneles ancla y recursos`
10. `chore(landing): auditoría de enlaces y disclaimer MiCA`


---

## 10. Lo que se implemento (2026-08-29)

Se ejecuto el plan completo, no solo la ruta corta, con una desviacion sobre lo
propuesto: en vez de dejar la Home clara dentro de un chrome oscuro, se construyo
un **tema doble conmutable** que cubre Home y chrome a la vez.

### Tema claro / oscuro

| Pieza | Fichero |
| :---- | :---- |
| Provider y `useTheme` | `lib/theme-context.tsx` |
| Interruptor en cabecera | `components/ThemeToggle.tsx` |
| Script anti-flash | `app/layout.tsx` (inline en `<head>`) |
| Tokens del chrome | `app/globals.css` (`--bz-chrome-*`) |
| Tokens de la Home | `app/(landing)/home.module.css` |

El tema vive en `data-bz-theme` sobre `<html>`, lo fija un script inline antes del
primer pintado y se persiste en `localStorage`. Sin eleccion previa sigue a
`prefers-color-scheme`. **Sin dependencias nuevas** (no se instalo `next-themes`).

El oscuro no invierte el claro: reinterpreta los roles. El acento salta de teal
`#046C7A` a beam `#2AD4EF` porque el teal sobre `#060F13` da 2,4:1 y no pasa ni AA
grande. Contraste medido en las dos variantes — el minimo es **5,58:1**, sobre el
4,5:1 que exige AA.

### Las 17 secciones

Hero oscuro (con canvas de red) · ticker · Mision (ancla) · el problema + esquema de
atestacion · cadena de evidencia · Ecosistema Chain-Flow · 7 protocolos verticales ·
AEGIS (ancla) · falla cerrado · integraciones · BEZ-Coin + oraculo en vivo · tres
caminos · SubApps + Apps Nativas · feed · recursos · contacto · **disclaimer MiCA**.

### Backend

`GET /oracle/token-prices` publica ahora `freshnessWindow`, `source` y `markets[]`
de forma aditiva (`api/routes/gateway.js`). `markets` sale de `token_market_cache`
si la tabla existe y de una constante en `pending` si no. Nueva variable
`ORACLE_FRESHNESS_WINDOW_S` en `.env.example`.

### Un bug encontrado por el camino

El div raiz de `app/(landing)/layout.tsx` llevaba `overflow-x-hidden`. `hidden` en
un eje obliga al otro a `auto`, lo que convertia ese div en contenedor de scroll y
dejaba **inservible cualquier `position: sticky`** debajo — incluidos los paneles
ancla. Cambiado a `overflow-x-clip`, que recorta igual sin crear contexto de scroll.

### Verificacion

- `pnpm build` limpio; `pnpm lint` 0 errores (353 avisos, todos preexistentes en estilo).
- Frontend **180/180**; API **840 pasan, 31 saltados, 0 fallan**.
- Nuevos: 9 tests de `OraclePanel` (live/stale/down, ventana configurable, payload
  sin `markets`) y 6 del tema. 8 tests nuevos del endpoint.
- **Auditoria de enlaces: 0 perdidos**, 6 anadidos (`/bridges`, `/financial`,
  `/privacy`, `/rpc` y dos `mailto:` con asunto).
- Navegador: 17 secciones, 0 enlaces vacios, sin desbordamiento horizontal a 375 px,
  paneles ancla en estado estatico en movil y sticky funcionando a 1280 px.

### Lo que quedo fuera, y por que

- **`ERC-3643`** no se cita en la ficha del token: `grep` sobre `smart-contracts/`
  no devuelve nada. Es una afirmacion de cumplimiento sin contrato detras. La ficha
  dice `ERC-20 · BEP-20`, que si es cierto.
- **`prefers-reduced-motion`** esta implementado en CSS y en los tres componentes
  con `matchMedia`, pero **no se pudo verificar en navegador**: el panel del
  entorno no permite emular esa preferencia.
- **Capturas de pantalla**: no disponibles en esta sesion (el panel del navegador
  no compone frames). La verificacion visual se hizo por estilos computados.
- **Lighthouse**: no ejecutado.
- El marquee horizontal de SubApps se sustituyo por la rejilla `.apps` del diseno
  nuevo. Las cinco URLs de Cloud Run son las mismas.
