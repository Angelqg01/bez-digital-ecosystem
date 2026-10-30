# API Marketplace — esbozo técnico sobre el Gateway actual

> Estado: **borrador de diseño, sin implementar** (2026-10-30).
> Origen: el plan "BeZhas API Marketplace — Plan de desarrollo, implementación y
> cumplimiento UE / EE. UU." (Claude Docs). Este documento baja ese plan a tablas,
> rutas y contratos sobre lo que ya existe en `api/`. Lo legal sigue pendiente del
> dictamen (fase 0); donde el diseño depende de él, se marca **[dictamen]**.

## Idea en una frase

Un proveedor es **una app más de `app_registry`** que además publica *listings*;
el consumidor llama a `/api/gateway/v1/marketplace/call/<slug>/…` con su api-key
de siempre, el gateway valida, reenvía al servidor del proveedor, mide y emite un
recibo. **El dinero nunca pasa por cuentas de BeZhas**: en fiat cobra el propio
proveedor vía Stripe Connect con `application_fee`; on-chain, un contrato de
reparto *pull* en el que BeZhas no puede mover saldos.

## Qué se reutiliza y qué es nuevo

| Pieza | Ya existe | Uso en el marketplace |
| --- | --- | --- |
| Identidad, api-keys con hash, OAuth, subclaves de agente | `middleware/gateway-auth.js` | Igual para proveedor y consumidor. Sin camino de auth nuevo. |
| Scopes | `requireScope()` | Nuevos: `marketplace:read`, `marketplace:consume`, `marketplace:publish`. |
| Medición en `res.on('finish')`, sólo 2xx | `middleware/gateway-metering.js` | Mismo patrón, pero mide **todos** los planes, no sólo Starter. |
| Ledger + reintento a Stripe | `services/usageBilling.js` (`gateway_usage_ledger`) | Mismo patrón fail-open, contra la cuenta Connect del proveedor. |
| Firma HMAC `X-BeZhas-Signature` | webhooks de pago en `routes/gateway.js` | Mismo formato para firmar las llamadas al proveedor. |
| Anclaje merkle en L2 | `services/operantAnchor.js` + `TelemetryAnchor.sol` | Lotes de recibos con clave `mkt:<listingId>`, sin tocar Solidity. |
| Guardia SSRF | `utils/safeFetch.js` | Toda llamada al `upstream_url` del proveedor. |
| Política de dinero | `services/txPolicyEngine.js` (`UNLICENSED_THIRD_PARTY_FUNDS`) | Impide que un cobro del marketplace salga por `sepa_ing_propia`. |
| KYB | KYC Didit de la rama `feat/kyc-didit` (`routes/kycWebhooks.js`) | Requisito para pasar un proveedor a `live`. |
| Kill switch | `services/killSwitch.js` | Suspender un listing o todo el marketplace. |
| **Nuevo** | — | Tablas `marketplace_*`, router `routes/marketplace.js`, validación OpenAPI, contrato `MarketplaceSettlement.sol`. |

## Modelo de datos (migración 076)

```sql
-- Un proveedor = una app registrada con datos de cobro y de cumplimiento.
CREATE TABLE marketplace_providers (
  app_id            UUID PRIMARY KEY REFERENCES app_registry(id),
  legal_name        TEXT NOT NULL,
  kyb_status        TEXT NOT NULL DEFAULT 'pending',   -- pending | verified | rejected
  stripe_account_id TEXT,                              -- acct_… (Connect, Standard o Express)
  payout_address    TEXT,                              -- para liquidación on-chain
  dpa_signed_at     TIMESTAMPTZ,                       -- sin DPA no hay listing con datos personales
  status            TEXT NOT NULL DEFAULT 'onboarding' -- onboarding | active | suspended
);

CREATE TABLE marketplace_listings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_app_id  UUID NOT NULL REFERENCES marketplace_providers(app_id),
  slug             TEXT UNIQUE NOT NULL,
  version          TEXT NOT NULL,
  upstream_url     TEXT NOT NULL,                 -- https, validado contra la guardia SSRF
  upstream_secret  TEXT NOT NULL,                 -- cifrado con VAULT_KEY; firma las llamadas salientes
  openapi          JSONB NOT NULL,                -- OpenAPI 3.1: contrato de entrada Y de salida
  pricing          JSONB NOT NULL,                -- {model: per_call|subscription|dataset, amount_cents, currency}
  data_categories  TEXT[] NOT NULL DEFAULT '{}',  -- GDPR: qué datos personales declara mover
  writes           BOOLEAN NOT NULL DEFAULT FALSE,-- endpoints que modifican estado en el proveedor
  status           TEXT NOT NULL DEFAULT 'draft'  -- draft | review | live | suspended
);

CREATE TABLE marketplace_subscriptions (
  consumer_app_id  UUID REFERENCES app_registry(id),
  listing_id       UUID REFERENCES marketplace_listings(id),
  stripe_subscription_id TEXT,                    -- en la cuenta Connect del proveedor
  status           TEXT NOT NULL,
  PRIMARY KEY (consumer_app_id, listing_id)
);

-- Una fila por llamada facturable. Es la base del recibo y de las disputas.
CREATE TABLE marketplace_calls (
  id               UUID PRIMARY KEY,              -- lo genera el servidor (ver meterUsage)
  listing_id       UUID NOT NULL,
  consumer_app_id  UUID NOT NULL,
  at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  http_status      INT NOT NULL,
  req_hash         TEXT NOT NULL,                 -- sha256 del cuerpo: prueba sin guardar el dato
  resp_hash        TEXT NOT NULL,
  amount_cents     INT NOT NULL,
  fee_cents        INT NOT NULL,
  reported_at      TIMESTAMPTZ,                   -- enviado a Stripe; NULL = pendiente de reintento
  batch_id         UUID                           -- lote anclado
);

CREATE TABLE marketplace_receipt_batches (
  id UUID PRIMARY KEY, listing_id UUID, merkle_root TEXT, tx_hash TEXT, created_at TIMESTAMPTZ
);
```

Nunca se guardan cuerpos de petición ni de respuesta: sólo sus hashes. Así BeZhas
no trata los datos que pasan por el proxy más allá del tránsito, lo que también
apoya la neutralidad que pide la Data Governance Act **[dictamen]**.

## Rutas (`/api/gateway/v1/marketplace`)

| Quién | Método y ruta | Qué hace |
| --- | --- | --- |
| Proveedor | `POST /providers` | Alta: crea la fila, lanza el KYB (Didit) y devuelve el enlace de onboarding de Stripe Connect. |
| Proveedor | `POST /listings` · `PUT /listings/:id` | Crea o edita un borrador: upstream, OpenAPI, precio y categorías de datos. |
| Proveedor | `POST /listings/:id/submit` | Pasa a `review`. Se rechaza si falta KYB, cuenta Connect activa o DPA (cuando hay datos personales). |
| Proveedor | `GET /listings/:id/usage` · `GET /payouts` | Uso, ingresos netos y comisiones (lectura del ledger y de Stripe). |
| Consumidor | `GET /catalog` · `GET /catalog/:slug` | Catálogo de listings en `live` y su OpenAPI. Público con `marketplace:read`. |
| Consumidor | `POST /listings/:id/subscribe` | Suscripción o compra de dataset (Checkout en la cuenta del proveedor). |
| Consumidor | `ANY /call/:slug/*` | El proxy (ver flujo). |
| Consumidor | `GET /receipts/:callId` | Recibo firmado y prueba de inclusión merkle cuando el lote está anclado. |
| Admin | `POST /admin/listings/:id/{approve,suspend}` | Revisión manual y suspensión. Va por `admin-auth`, no por el gateway. |

Todos los recursos de proveedor comprueban `provider_app_id = req.registeredApp.id`
en la propia consulta (BOLA), no sólo en el handler.

## Flujo de una llamada

```
consumidor ──x-api-key──▶ gateway
  1. authenticateApp + requireScope('marketplace:consume')        (existente)
  2. listing live + kill switch + suscripción o método de pago      (nuevo)
  3. rate limit por (consumidor, listing) + circuit breaker del upstream
  4. validar la petición contra listing.openapi (ajv)               → 400 sin tocar al proveedor
  5. safeFetch(upstream_url): sólo https, DNS resuelto y fijado, sin IP privada,
     timeout 10 s y respuesta máx. 5 MB                             (nuevo, ver Seguridad)
     cabeceras: X-BeZhas-Signature (HMAC con upstream_secret sobre ts.nonce.body),
                X-BeZhas-Timestamp, X-BeZhas-Nonce, X-BeZhas-Consumer (id opaco)
  6. validar la respuesta contra el OpenAPI y quitar campos no declarados
  7. res.on('finish'): si 2xx → fila en marketplace_calls → meter event en Stripe
     (cuenta del proveedor) con el id de llamada como identifier
  ◀── respuesta + X-BeZhas-Receipt: <callId>
```

El consumidor nunca ve la `upstream_url` ni el secreto; el proveedor nunca ve la
api-key del consumidor.

## Dinero

### Fiat: Stripe Connect con *direct charges*

- El cargo se crea **en la cuenta conectada del proveedor**, con
  `application_fee_amount` para la comisión de BeZhas. El proveedor es el
  comerciante; BeZhas cobra su fee y nunca tiene los fondos del consumidor en saldo.
  Es la variante más defendible como "no custodia" ante PSD2 **[dictamen]**.
- Por llamada: un Billing Meter y un precio medido **por cuenta conectada**, en
  lugar del `bezhas_api_credits` global. Suscripción y dataset: Checkout en la
  cuenta conectada.
- La alternativa, *destination charges*, convierte a BeZhas en comerciante. Es más
  sencilla de facturar, pero es exactamente lo que el plan quiere evitar.
- `fiatPayout` no interviene. Si algo intentara pagar a un proveedor por la cuenta
  de ING, `txPolicyEngine` ya lo para con `UNLICENSED_THIRD_PARTY_FUNDS`.

### On-chain: contrato nuevo, no `BeZhasCommissionSplitter`

`BeZhasCommissionSplitter.sol` **no sirve tal cual**. Lo dispara `SETTLER_ROLE`
(el backend) moviendo tokens con la allowance del pagador, y el admin puede cambiar
la comisión. Es decir, BeZhas tiene capacidad de ejecutar transacciones, que es
el criterio de Florida Cap. 560 y de FinCEN.

`MarketplaceSettlement.sol` (nuevo, en `smart-contracts/src/core/`):

- `pay(listingId, amount)` lo llama **el consumidor**. Acredita
  `balance[provider] += amount - fee` y `balance[treasury] += fee` en la misma
  transacción.
- `withdraw()`: cada uno retira lo suyo (pull payment, `ReentrancyGuard`, CEI).
- Comisión máxima `immutable` en el despliegue. El admin sólo puede bajarla, nunca
  tocar saldos.
- `pause()` sólo bloquea `pay`; `withdraw` sigue abierto siempre.
- Token: **BEZ en Polygon**, el único desplegado. El "BZH" del plan no existe y es
  una decisión de tokenomics aparte.
- v1 sólo para suscripción y dataset (un pago por compra). El pago por llamada
  on-chain exige prepago más recibos firmados por el consumidor y se deja para
  después de las auditorías.

### Comisión

`api/config/marketplace-fees.js`, fuente única como `operant-services.js`: tramos
del 10 al 20 % por volumen y descuento si el consumidor paga con BEZ. Un test
falla si un tramo sale de [10 %, 20 %] o si supera el máximo del contrato.

## Seguridad: lo que falta hoy

1. **Guardia SSRF**: ya existe `utils/safeFetch.js` (2026-10-30). Sólo https,
   todas las IPs públicas, comprobación al conectar (anti DNS rebinding), sin
   redirecciones y con tamaño acotado. La usan los webhooks (gateway, CargoLink,
   canales, config), la sincronización POS y, para clasificar IPs, el
   `services/erp/httpGuard.js` de los conectores ERP. El proxy del marketplace la
   aplica al guardar `upstream_url` y en cada llamada.
2. **Validación OpenAPI** con `ajv` (+ `ajv-formats`), con el esquema compilado y
   cacheado por versión de listing.
3. **Listings con `writes = true`**: escritura en el sistema del proveedor. Exigen
   scope extra (`marketplace:consume:write`), idempotency key obligatoria y, en una
   fase posterior, mTLS hacia el proveedor.
4. **Secretos del upstream** cifrados con `VAULT_KEY`, rotables y nunca devueltos
   tras crearse, como el secreto de los webhooks.
5. **Datos personales**: si `data_categories` no está vacío, se exige DPA antes de
   `live`, y los logs del proxy no registran cuerpos.

## Orden propuesto

| Paso | Contenido | Puerta |
| --- | --- | --- |
| 1 | Migración 076, catálogo y listings en borrador (sobre `safeFetch`, ya hecho) | — |
| 2 | Proxy de sólo lectura, validación OpenAPI, ledger y recibos | Pentest de API |
| 3 | Stripe Connect *direct charges*, pago por llamada y suscripción, con 2 proveedores piloto | **Dictamen UE** sobre no custodia |
| 4 | Anclaje de recibos en L2 (`mkt:<listingId>`) | — |
| 5 | `MarketplaceSettlement.sol` para suscripción y dataset en BEZ | 2 auditorías externas |
| 6 | Listings con escritura y mTLS | Pentest de conectores |

## Decisiones abiertas

- Stripe Connect Standard frente a Express. Standard deja al proveedor como
  comerciante pleno, pero da peor experiencia de onboarding.
- Si el catálogo es público sin api-key, como escaparate de la Landing, o sólo para
  clientes.
- Si el marketplace es un módulo contratable por plan, como OPERANT, o abierto a
  cualquier app con KYB.
- Entidad separada para la intermediación de datos (Data Governance Act): afecta a
  qué cuenta de Stripe es la plataforma **[dictamen]**.
