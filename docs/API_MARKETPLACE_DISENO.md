# API Marketplace — esbozo técnico sobre el Gateway actual

> Estado: **pasos 1 y 2 implementados** (2026-11-05, sin desplegar; migración 076 sin
> aplicar en producción; proxy apagado salvo `MARKETPLACE_PROXY_ENABLED=true`). Diseño del 2026-10-30. Ver «Estado de implementación» al final.
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
     cabeceras: X-BeZhas-Signature (sha256=HMAC con upstream_secret sobre
                ts.nonce.METHOD.ruta?query.body: firma también método y ruta),
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

## Estado de implementación

| Paso | Estado | Dónde |
| --- | --- | --- |
| 1 | **Hecho** (2026-11-05), sin desplegar | `api/db/migrations/076_marketplace.sql` · `api/config/marketplace.js` · `api/routes/marketplace.js` · tests en `api/__tests__/{config,routes}/marketplace.test.js` |
| 2 | **Hecho** (2026-11-05), sin desplegar ni pentest | `api/services/marketplace/{openapiContract,circuitBreaker,receipts}.js` · proxy y recibos en `api/routes/marketplace.js` · tests en `api/__tests__/routes/marketplace-proxy.test.js` y `api/__tests__/services/marketplace-*.test.js` |
| 3-6 | Pendiente | — |

Lo que hace el paso 1:

- Alta de proveedor (`POST /providers`, `GET`/`PATCH /providers/me`). El proveedor
  sólo puede tocar nombre legal y `payout_address`; `kyb_status`,
  `stripe_account_id` y `dpa_signed_at` los rellenarán Didit, Stripe Connect y la
  firma del DPA, nunca la API del proveedor.
- Listings: crear, listar, editar (sólo en `draft`/`review`; editar en `review`
  vuelve a `draft`), enviar a revisión y rotar el secreto. `upstream_url` pasa por
  `validarDestinoPublico`; el secreto (`mkts_…`) se guarda cifrado con
  `secretVault` y se muestra una sola vez.
- Validación de forma en `config/marketplace.js`: OpenAPI 3.1 estructural (≤ 256 KB,
  rutas sin `..`), precio (`per_call` | `subscription` | `dataset`, EUR/USD,
  céntimos enteros), categorías GDPR de una lista cerrada y coherencia de
  `writes`: un OpenAPI con POST/PUT/DELETE exige `writes = true`.
- Catálogo (`GET /catalog`, `GET /catalog/:slug`) con `marketplace:read` o
  `marketplace:consume`: sólo `live`, sin `upstream_url`, y el `servers` del
  OpenAPI se reescribe al proxy.
- Revisión (`/admin/listings…`) con sesión SuperAdmin. Aprobar vuelve a comprobar
  KYB, cuenta Connect y DPA, por si cambiaron desde el envío.
- El router se monta antes de `bez-markets` y del gateway general, cuyos
  `router.use()` globales atenderían también `/marketplace/*`.

Decisiones tomadas por defecto en el paso 1 (revisables):

- El catálogo exige api-key con scope; no es público (decisión abierta de arriba).
- Las rutas de gestión no se miden como `api_call` del plan Starter.
- El slug no se cambia tras crear el listing: es la ruta pública.
- `health` y `biometric` (art. 9 RGPD) se señalan en la cola de revisión.

Lo que hace el paso 2:

- **Proxy** `GET|HEAD /call/:slug/*` con `marketplace:consume`. Apagado salvo
  `MARKETPLACE_PROXY_ENABLED=true`. Cualquier otro método da 405 y los listings con
  `writes = true` dan 403 hasta el paso 6.
- **Acceso piloto**: sin cobro todavía, sólo llaman los consumidores con una fila
  `active` en `marketplace_subscriptions`, que concede o retira un admin
  (`POST /admin/listings/:id/grants`, `DELETE …/grants/:appId`). En el paso 3 la
  misma tabla pasa a llenarse desde Stripe.
- **Contrato** (`openapiContract.js`, Ajv 2020 + ajv-formats, compilado y cacheado
  por listing): la ruta se casa sin decodificar (un `%2F` no cambia de plantilla),
  se rechazan `.`, `..`, barras y nulos en parámetros de ruta, y la ruta reenviada
  se reconstruye desde la plantilla. Sólo viajan los parámetros de query
  declarados. La respuesta debe ser JSON y cumplir el esquema de su código
  (exacto, `2XX` o `default`); los campos no declarados se quitan. Si no cumple,
  502 sin el cuerpo del proveedor.
- **Al proveedor** viajan `X-BeZhas-Timestamp`, `X-BeZhas-Nonce`,
  `X-BeZhas-Listing`, `X-BeZhas-Consumer` (`c_` + sha256 de listing y app: estable
  por listing, inútil para cruzar listings) y la firma. Nunca la api-key del
  consumidor. `safeFetch` con 10 s y 5 MB.
- Un 4xx del proveedor se devuelve con su código pero **sin su cuerpo**; un 5xx o
  un fallo de red da 502 y cuenta para el **circuit breaker** (5 fallos seguidos →
  30 s abierto, luego una sonda). Límite de 60 llamadas/min por (consumidor,
  listing), configurable con `MARKETPLACE_RATE_LIMIT_PER_MIN`.
- **Registro**: cada 2xx escribe su fila en `marketplace_calls` antes de responder
  (hash de `METHOD ruta?query` y de la respuesta enviada) con **importe 0**, y
  devuelve `X-BeZhas-Receipt`. Si la escritura falla se responde sin recibo; en el
  paso 3, con dinero, pasará a fallar cerrado.
- **Recibos** `GET /receipts/:callId`, sólo para el consumidor o el proveedor de la
  llamada: JWS ES256 con clave propia (`MARKETPLACE_RECEIPT_PRIVATE_KEY` y
  `_PUBLIC_KEY`, PEM o PEM en base64), verificable con la JWKS pública de
  `GET /receipts/keys`. En producción sin claves dan 503; no impiden arrancar la API.
  `anchor` es `null` hasta el paso 4.

Limitaciones conocidas del paso 2, para el pentest y el piloto:

- Quitar campos no declarados (`removeAdditional: 'all'`) rompe los `allOf` que
  reparten propiedades entre subesquemas: el contrato de respuesta debe declararlas
  en un solo objeto.
- El circuit breaker es por instancia de Cloud Run, no global.
- El proxy no reenvía cabeceras de la petición del consumidor (ni las declaradas en
  el OpenAPI).
- Antes de desplegar: crear el par EC P-256 de recibos en Secret Manager y
  declararlo en `deploy/gcp/secrets.list`.
