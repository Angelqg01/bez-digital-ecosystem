# Capa de seguridad transaccional de BeZhas

Implementa, adaptado a BeZhas (BSC, Polygon y la L2 2708, un VPS de Hostinger con
Docker Compose), el documento de referencia
`BEZHAS-MCP-SECURITY-INFRASTRUCTURE.md`. Cubre los cuatro carriles de valor:
**cripto→cripto, FIAT→cripto, cripto→FIAT y FIAT→FIAT**.

> **El agente puede solicitar. La política puede autorizar. El riesgo puede
> bloquear. Las personas aprueban con su firma. El firmante firma. Ningún
> componente por sí solo puede vaciar una wallet.**

---

## 1. Flujo

```text
Agente / cliente (api-key o credencial de agente bzag_…)
   │  POST /api/gateway/v1/tx/intents        (MCP: bezhas_tx_prepare, nivel 1)
   ▼
txIntent        valida y normaliza: unidades mínimas, checksum, IBAN, red cerrada, caducidad, nonce
   ▼
txSimulator     construye la tx (el backend, no el agente) · contrato del registro · sin approve ilimitado
                · saldo y eth_call contra quórum de RPC · fork en Anvil opcional (detecta tokens con comisión)
   ▼
txRiskEngine    jurisdicción, destino nuevo, velocidad, anomalía, fraccionamiento, VoP, simulación → LOW…CRITICAL
   ▼
txPolicyEngine  kill switch · scopes · plan · agente · KYC/KYB · licencia del proveedor FIAT · límites (el más
                restrictivo) · travel rule · beneficiario → ALLOW | REQUIRE_APPROVAL (n firmas) | DENY
   ▼
Aprobación      firmas EIP-712 de aprobadores (wallet, a poder ser hardware) sobre intentHash + policyHash
   ▼
Ejecución       re-evalúa todo con datos frescos · reclama la intención (una sola ejecución)
   ├─ cripto custodiado → tx-signer (contenedor aislado, clave en KMS) → quórum de RPC → broadcast
   ├─ FIAT → adaptador del proveedor (socio EMI con idempotencia, o instrucción SEPA manual)
   └─ custodia propia → nunca se ejecuta aquí: la firma la wallet del cliente (txSinFirmar)
   ▼
security_audit_log   append-only (trigger), encadenado por hash, anclable en TelemetryAnchor
```

## 2. Carriles y marco regulatorio

| Carril | Origen | Qué exige la política | Marco |
|---|---|---|---|
| `crypto_transfer` | wallet del cliente o tesorería | red cerrada, contrato del registro, travel rule si custodia BeZhas | MiCA · Reglamento (UE) 2023/1113 |
| `fiat_to_crypto` | tarjeta (Stripe), SEPA entrante, socio on-ramp | KYC del receptor; la entrega del token es un `crypto_transfer` aparte, con su aprobación | MiCA · PSD2 (el PSP) |
| `crypto_to_fiat` | wallet del cliente o tesorería | nombre del titular del IBAN, proveedor habilitado | MiCA + PSD2 |
| `fiat_to_fiat` | saldo del cliente en socio, o tesorería | **socio con licencia de pago para fondos de terceros**; verificación del beneficiario | PSD2 · Reglamento de Pagos Inmediatos 2024/886 |

**Regla que no se negocia:** BeZhas sin licencia de pago solo mueve dinero
**propio**. `sepa_ing_propia` (la cuenta de ING) solo sirve cuando el origen es
`bezhas_treasury`; cualquier otra combinación se deniega con
`UNLICENSED_THIRD_PARTY_FUNDS`. Los fondos de clientes van por `emi_partner`
(`FIAT_PARTNER_API_URL` / `FIAT_PARTNER_API_KEY`) o por el on-ramp.

Las listas de jurisdicciones (`TX_BLOCKED_COUNTRIES`,
`TX_ENHANCED_DUE_DILIGENCE_COUNTRIES`) las mantiene cumplimiento, no el código.
La clasificación jurídica final de BeZhas la valida un abogado.

## 3. Qué impide qué

| Amenaza | Control | Dónde |
|---|---|---|
| Agente que inventa o altera un destino o un importe | intención estructurada; la calldata la construye el backend y **el firmante la reconstruye** | `txIntent`, `tx-signer/src/verify.js` |
| API comprometida que se autoaprueba | aprobadores y topes en la **configuración del firmante** (solo lectura), no en la base de datos | `tx-signer/config` |
| Cambiar el pago después de aprobarlo | EIP-712 sobre `intentHash` + `policyHash`; el firmante los recalcula | `txApproval`, `verify.js` |
| Aprobar una vez y cobrar dos | `UNIQUE(app_id, idempotency_key)` · ejecución con cerrojo de estado · el firmante recuerda cada `intentHash` firmado (en disco) | `txRepository`, `tx-signer/src/store.js` |
| Una sola persona vacía la tesorería | `minApprovals ≥ 2` obligatorio en producción (el firmante no arranca con menos) | `tx-signer/src/config.js` |
| RPC mentiroso o caído | quórum ≥ 2 proveedores; con uno solo, producción no firma | `rpcQuorum` |
| Token hostil o con comisión | simulación en fork: si el destino recibe menos, `SIMULATION_MISMATCH` → CRITICAL | `txSimulator` (probado en Anvil) |
| Firmante que devuelve otra tx | la API parsea la firmada y compara destino, datos, red y emisor; si no casa, no difunde y eleva el kill switch | `txOrchestrator` |
| Fraude del «cambio de cuenta» | destino nuevo → aprobación + enfriamiento (24 h) | `tx_destinations` |
| Inyección de prompt vía datos | salida del MCP saneada (bidi, invisibles) y etiquetada como dato | `mcp-tools.sanearNoFiable` |
| Cambio silencioso de herramientas MCP | huella del catálogo en la versión del servidor | `mcp-tools.huellaCatalogo` |
| Agente desbocado | credencial `bzag_` propia: scopes ⊂ empresa, carriles, límites, caducidad, `canExecute` | `gateway-auth`, `app_agents` |

## 4. El MCP

| Nivel | Herramientas | Anotaciones |
|---|---|---|
| 0 lectura | token, precio, oráculo, DEX, red, contratos, suscripción, `bezhas_tx_status` | `readOnlyHint: true` |
| 1 preparar | `bezhas_tx_prepare` | escribe una intención, idempotente, **no mueve fondos** |
| 2+ | — | no existen en el MCP. Ejecutar exige firmas humanas fuera del agente |

`bezhas_tx_prepare` nunca acepta `bezhas_treasury` como origen.

## 5. Variables de entorno nuevas

**bezhas-api:** `WALLET_VAULT_SECRET` (≥ 32, distinto de `JWT_SECRET`) ·
`WALLET_VAULT_LEGACY_SECRET` (opcional) · `TX_SIGNER_URL` ·
`TX_SIGNER_REQUEST_KEY` (≥ 32) · `TX_TREASURY_ADDRESS[_<chainId>]` ·
`RPC_URLS_56|137|2708` (coma, ≥ 2) · `ALLOWED_CHAIN_IDS` (vacío = 56,137,2708) ·
`SIMULATOR_FORK_URL_<chainId>` (opcional, Anvil en fork) ·
`FIAT_PARTNER_API_URL|KEY` · `BANK_WEBHOOK_SECRET` (**sin él, `/api/webhooks/bank` responde 503**) ·
`TX_DESTINATION_COOLING_HOURS` · `TX_RATE_LIMIT_PER_MIN` · `SECURITY_ANCHOR_OPERATOR_KEY` (solo gas).

**business-ops:** `OPERANT_TX_AGENT_KEY` (credencial `bzag_`) · `OPERANT_TX_NETWORK`.
Retirar `DISBURSEMENT_WALLET_PRIVATE_KEY` y **rotar esa wallet**.

**tx-signer:** `TX_SIGNER_CONFIG_FILE` (ruta en el VPS, fuera del repo) ·
`TX_SIGNER_REQUEST_KEY` · `TX_SIGNER_AWS_REGION|ACCESS_KEY_ID|SECRET_ACCESS_KEY`
(IAM con **solo** `kms:Sign` y `kms:GetPublicKey` sobre esa clave).

> **Atención con `BEZHAS_CHAIN_ID`:** el compose base lo pone a 31337 por
> defecto. En producción 31337 ya no está permitido: o se define
> `BEZHAS_CHAIN_ID=2708` o se habilita explícitamente con `ALLOWED_CHAIN_IDS`.

## 6. Procedimientos

### 6.1 Poner en marcha el firmante
1. En AWS KMS: clave asimétrica `ECC_SECG_P256K1`, uso `SIGN_VERIFY`, en `eu-central-1`.
2. Usuario IAM con una política que solo permita `kms:Sign` y `kms:GetPublicKey` sobre esa clave.
3. Copiar `tx-signer/config/signer.example.json` a `/etc/bezhas/tx-signer/signer.json`
   en el VPS, poner la dirección real (el firmante no arranca si la clave de KMS
   no corresponde a ella), los aprobadores (hardware wallets), los topes y las redes.
4. `TX_SIGNER_CONFIG_FILE=/etc/bezhas/tx-signer/signer.json` en `.env`.
5. `docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile signer up -d tx-signer`
6. Fondear la cartera operativa **solo con el float necesario**. El grueso de la
   tesorería sigue en la Safe multifirma.

### 6.2 Kill switch
- **Elevar** (una persona basta):
  `POST /api/security/kill-switch/raise` con `x-internal-key`, o con una firma
  EIP-712 `SecurityAction{action:"raise"}` de un aprobador `security`.
- **Rebajar** (dos personas): `POST /api/security/kill-switch/lower` con dos
  firmas `SecurityAction{action:"lower"}` de aprobadores `security` distintos,
  con caducidad ≤ 15 min y nonce de un solo uso.
- **Firmante:** `touch /var/lib/docker/volumes/<proyecto>_tx-signer-data/_data/LOCKDOWN`
  lo para aunque la API esté comprometida.

### 6.3 Aprobadores
Solo por backoffice (clave interna) tras KYB: `POST /api/security/approvers`.
Los roles `treasury` y `security` son globales. Para los pagos desde la tesorería
lo que cuenta es la lista del firmante; la de la base de datos solo decide si la
API acepta la firma.

### 6.4 Rotar la clave del vault de wallets
1. `WALLET_VAULT_KEYS="3:<nuevo>,2:<actual>"` y reiniciar.
2. Ejecutar `walletVaultService.reencryptAll()` hasta que `pendientesLeidas` sea 0.
3. Retirar la versión antigua del llavero.

### 6.5 Migraciones
API: `058_tx_security_fabric.sql` y `059_fiat_delivery_indexes.sql` (Postgres del VPS,
después de la 057). Hub: `020_bezpay_entrega_intencion.sql`. Probadas en Postgres 16:
aplican, son idempotentes y los triggers bloquean UPDATE/DELETE/TRUNCATE.

### 6.6 Entregas de BEZ por pagos FIAT
1. Crear en `app_registry` la app interna de tesorería (scope `treasury`) y poner su id en
   `BEZPAY_TREASURY_APP_ID`.
2. Crear para el Hub una credencial de agente con carril `crypto_transfer` y `canExecute`
   (`POST /api/gateway/v1/tx/agents` con la clave de esa app) → `BEZPAY_TX_AGENT_KEY`.
3. Las entregas aparecen como intenciones `awaiting_approval`: dos aprobadores de tesorería
   firman; el liberador (API) o el seguimiento (Hub) las ejecutan en el siguiente barrido.

## 7. Pendiente (no es código)

- Rotar el webhook de Discord (estaba escrito en el código y en git) y los secretos que pasaron por `.env`.
- Revisar en el panel de Stripe los tres endpoints de webhook (ver §8).
- Tesorería principal en Safe multifirma 3 de 5 con timelock; el firmante solo maneja float.
- Auditoría externa de contratos y pentest del MCP (inyección de prompt, abuso de agentes).
- Corregir el texto del Payment Link de compra de BEZ en Stripe: anuncia «€0.00075» y el precio real es 0,0075 USD.
- Dependencias con avisos altos que exigen salto de versión mayor, todas de desarrollo o build:
  hardhat-toolbox (undici 5, adm-zip, serialize-javascript), vite 5 y vitest 1 del frontend del Hub,
  deepmerge-ts (CLI de Prisma) y las fuentes Solidity de OpenZeppelin 4.7.3 que trae Chainlink.
  Ninguna se ejecuta en el servidor.
- Claves de operador que siguen en la API (anclas, CargoLink, L1, VPP, despliegue): sólo pagan gas.
  `hotKeyGuard` las inventaría al arrancar y retira las que controlen la tesorería; vigilar que no acumulen saldo.

## 9. BEZ solo existe en Polygon

`0xEcBa…11A8`, verificado en Sourcify y Blockscout y confirmado el 2026-09-18. En BSC no hay
contrato ni en `0x8a1e…5b55` ni en `0xEcBa…11A8` (tres RPC). Corregido en: registro de la API
y del firmante, `PRODUCTION_CHAINS` y `BEZ_MARKETS` del Gateway (ya no se publica un mercado
BSC), `smart-contracts/deployments/56.json` (`NOT_DEPLOYED`) y la tabla de CLAUDE.md.

## 10. Entrega de BEZ por pagos FIAT (API y Hub, misma regla)

Precio único: **0,0075 USD por BEZ** (`BEZ_PRICE_USD`, `api/config/bez-price.js`, en micro-USD
con BigInt). Antes convivían 0,10 USD, 0,07 USD (entero de céntimos) y 1,24 USD (un token ajeno
de CoinGecko en el Hub).

```text
cobro (Payment Link, BezPay, transferencia SEPA)
  → compra RETENIDA, BEZ congelado al precio del momento. Nada se entrega en el webhook.
  → cardFundsVerifier (fichero IDÉNTICO en api/ y en el Hub; un test lo exige):
      importe y moneda exactos · sin reembolso ni disputa · autorizado · Radar sin riesgo elevado
      · 3-D Secure (o Apple/Google Pay) · retención mínima · fondos DISPONIBLES en Stripe
      · incluidos en un payout PAGADO a la cuenta bancaria
    (la transferencia SEPA confirmada por el HMAC del banco entra ya como fondos confirmados)
  → intención crypto_transfer desde tesorería (política, simulación, travel rule con el titular)
  → dos aprobaciones EIP-712 de tesorería → tx-signer → difusión → compra completada
  disputa o reembolso en cualquier punto antes de firmar → se cancela la intención y no sale nada
```

- La vía antigua de acuñar con una clave en la API (`mintBezTokens`) está apagada
  (`LEGACY_HOT_MINT_ENABLED`); `hotKeyGuard` retira sus claves del entorno en producción.
- El Hub ya no entrega desde su hot wallet salvo `BEZPAY_DELIVERY_MODE=hot_wallet`, y sin
  `STRIPE_SECRET_KEY` no entrega (antes el verificador decía que sí).
- Las sesiones de Stripe sin orden BezPay ya no se entregan en el acto: van a conciliación manual.

Variables nuevas. API: `BEZ_PRICE_USD`, `BEZPAY_TREASURY_APP_ID`, `BEZPAY_TREASURY_PLAN`,
`BEZPAY_DELIVERY_NETWORK`, `CARD_HOLD_HOURS`, `CARD_REQUIRE_BANK_PAYOUT`, `CARD_REQUIRE_3DS`,
`CARD_SETTLEMENT_INTERVAL_MS`, `SECURITY_AUDIT_ANCHOR_INTERVAL_MS`. Hub: `BEZPAY_TX_AGENT_KEY`,
`BEZHAS_API_URL`, `BEZPAY_DELIVERY_MODE`, `BEZPAY_REQUIRE_BANK_PAYOUT`, `BEZPAY_REQUIRE_3DS`,
`BEZ_PRICE_USD`, `BEZ_COINGECKO_ID` (sólo si hay feed propio).

## 8. Incidente Stripe «Webhook processing failed» (2026-09)

- **Origen de la alerta en Discord:** `App-nativas/Bezhas-Hub/backend/tests/stripe.service.test.js`
  llamaba al manejador del webhook con una firma falsa sin simular el notificador.
  Cada ejecución de la suite publicaba una alerta HIGH real
  (`STRIPE WEBHOOK ERROR · Webhook processing failed · Unable to extract timestamp and signatures from header`)
  usando la URL de Discord **escrita en el código**. Reproducido contra un servidor local.
- **Arreglado:** notificador sin URL por defecto y apagado en tests; firma inválida ≠
  fallo de procesamiento; test con aserción real; URL retirada de la documentación.
- **Encontrado de paso:**
  - Los tres endpoints de Stripe apuntan a sitios sin manejador: `api.bez.digital/webhooks/stripe`
    acababa en el frontend (nginx corregido: ahora va a `/api/webhooks/stripe`), y
    `bezhas.com` y `bezhas.com/home` son páginas web.
  - El manejador de la API solo leía `metadata.walletAddress`. Los Payment Links piden
    la wallet en un campo personalizado (`wallettosendthebezcoin` /
    `walletaddresstosendbezcoin`), así que las compras por enlace quedaban cobradas y sin BEZ.
    Arreglado, y además se convierten EUR→USD, que antes se trataban 1:1.
  - `/api/webhooks/bank` aceptaba peticiones sin HMAC si faltaba `BANK_WEBHOOK_SECRET`, y el
    compose no lo pasaba. Ahora falla en cerrado (503) y el compose lo pasa.

## 11. Otros arreglos (2026-09-19)

- **2FA del Hub:** los secretos TOTP se cifraban con una clave derivada de `JWT_SECRET` (o del
  literal `'default-key'`) y sal fija. Ahora v2 con clave propia `TOTP_ENCRYPTION_KEY` (≥ 32,
  distinta de `JWT_SECRET`, HKDF); en producción sin ella no se cifra. Los registros v1 se leen.
- **Frontend del Hub:** retirado `secureStorage.js` (sin uso, con clave de cifrado escrita en el
  código; una clave en el navegador es pública de todas formas).
- **Dependencias:** `pnpm audit --prod` sin avisos altos ni críticos en API, OPERANT y firmante;
  en el Hub quedan los de §7 (sólo desarrollo/build o fuentes Solidity).
- **Índices** para los barridos de entregas (migración API 059, Hub 020).
