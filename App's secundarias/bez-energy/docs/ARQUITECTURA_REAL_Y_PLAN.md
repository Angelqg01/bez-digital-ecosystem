# ⚡ BeZhas Energy — Arquitectura del Sistema Real y Plan de Desarrollo

> Documento maestro para llevar **BeZhas Energy (VPP)** de demo simulada a una
> Central Eléctrica Virtual **operando contra hardware físico real** (inversores,
> baterías/BESS, medidores, grupos electrógenos) con liquidación on-chain.
>
> **Estado:** v1.0 · Junio 2026 · Maintainer: Yoel
> **Alcance:** capa física (edge gateway) → ingesta → IA/arbitraje → blockchain → app.

---

## 0. Resumen ejecutivo

Hoy el dashboard funciona **end-to-end pero con datos simulados**. La "tubería"
de datos (broker MQTT, esquema de tópicos, normalizadores, contratos Solidity) ya
existe y está testeada. **El eslabón que falta es el que toca el hardware**: un
*Edge Gateway* que lea inversores/medidores/genset por Modbus/SunSpec/CAN y publique
telemetría firmada al broker.

Este plan cubre **6 fases** para cerrar ese hueco, en orden de dependencia:

| Fase | Entrega | Resultado tangible |
|------|---------|--------------------|
| **F1** | Edge Gateway (Modbus→MQTT) | Un inversor/medidor real publicando telemetría |
| **F2** | Firma de telemetría + verificación | Anti-spoofing real (Aegis deja de ser mock) |
| **F3** | Backend real (BD de series temporales) | `/telemetry` sirve datos físicos, no `Math.random()` |
| **F4** | Despliegue de contratos + bridge on-chain | Auditoría SCADA y CAE/P2P reales en cadena |
| **F5** | Control SCADA físico (write-path) | Comandos que mueven hardware con HITL real |
| **F6** | Agente IA de arbitraje en producción | Decisiones autónomas OMIE→batería con dinero real |

---

## 1. Estado actual — línea base honesta (qué es real vs mock)

### 🔴 Mock / simulado (a reemplazar)
| Componente | Archivo | Naturaleza |
|---|---|---|
| Telemetría de nodos (frontend) | [`src/api.js` → `mockTelemetry()`](../src/api.js) | `Math.random()` |
| Telemetría de nodos (backend) | [`api/routes/energy.js` → `buildTelemetry()`](../../../api/routes/energy.js) | `Math.random()` |
| Alertas del "AI Agent" | `api/routes/energy.js` `/alerts` | array hardcoded |
| Demand Response, staking, Aegis report | `api/routes/energy.js` | respuestas fijas |
| Etiquetas `MQTT/Modbus`, `CAN/MQTT` | telemetría | **decorativas**, no se habla el protocolo |
| Direcciones de contratos energía | `ENERGY_CONTRACTS` | placeholders `0x0…01/02/03` |

### 🟡 Real pero sin dispositivo conectado
| Componente | Archivo | Estado |
|---|---|---|
| Broker MQTT + ingesta | [`api/services/vppMqttBroker.js`](../../../api/services/vppMqttBroker.js) | Funcional (lib `mqtt` v5). Falta emisor físico. |
| Simulador de Edge Node | [`api/scripts/edge-node-simulator.js`](../../../api/scripts/edge-node-simulator.js) | Publica telemetría falsa al broker |
| Contratos Solidity energía | `smart-contracts/src/energy/*.sol` | Escritos + testeados, **no desplegados** |
| Bridge on-chain SCADA | `api/services/vppChainBridge.js` | Code-complete, sin red destino |

### 🟢 Integración real con el mundo (ya funciona)
| Componente | Archivo | Estado |
|---|---|---|
| Precios OMIE (Mercado Diario) | [`api/services/energyFeedService.js`](../../../api/services/energyFeedService.js) | Parser real `marginalpdbc` + HTTP |
| Indicadores ESIOS (REE) | `energyFeedService.js` | Real con `ESIOS_API_KEY` |
| Identidad / RBAC | `api/routes/energy.js` `/me`, `/admin/operators` | Real contra PostgreSQL |

**Conclusión:** no existe **ningún driver de hardware** (Modbus, SunSpec, CAN,
firmware de genset). Solo el simulador. Cerrar ese hueco es el objetivo del plan.

---

## 2. Arquitectura objetivo (4 capas)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  CAPA 4 · APPLICATION            bez-energy SPA (React/Vite, puerto 3019)   │
│  Dashboard · Wallet · SCADA · Operadores · P2P · CAE                       │
└───────────────▲──────────────────────────────────────────────────────────┘
                │ REST  /api/energy/*   (JWT, RBAC, normalizado camelCase)
┌───────────────┴──────────────────────────────────────────────────────────┐
│  CAPA 3 · AI ORCHESTRATION       BeZhas Energy Agent (OpenClaw)            │
│  energyArbitrageAgent · energyFeedService(OMIE/ESIOS) · alertas IA         │
│  HITL (human-in-the-loop) · Aegis (anomalías/anti-spoof)                   │
└───────────────▲───────────────────────────────────────────┬──────────────┘
                │ lee telemetría / despacha control          │ liquida
┌───────────────┴───────────────────────────┐   ┌────────────▼──────────────┐
│  CAPA 1 · INGESTA (API Gateway)            │   │ CAPA 2 · BLOCKCHAIN (L2)  │
│  vppMqttBroker (sub telemetry/pub control) │   │ BeZhasVPP · EnergyOracle  │
│  energyLedgerService · TimescaleDB         │   │ EnergyCAEToken · P2PMarket│
└───────────────▲────────────────────────────┘   │ vppChainBridge (audit)    │
                │ MQTT (TLS, firmado)             └───────────────────────────┘
┌───────────────┴──────────────────────────────────────────────────────────┐
│  CAPA 0 · PHYSICAL · EDGE GATEWAY  (NUEVO — el eslabón que falta)          │
│  Raspberry Pi / PLC industrial junto al equipo                            │
│  ├─ Modbus TCP/RTU  → inversor solar (SunSpec), medidor, genset           │
│  ├─ CAN bus         → BMS de batería (BESS)                               │
│  ├─ Firma HW        → ATECC608A / TPM 2.0 (telemetría anti-spoof)         │
│  └─ Buffer offline  → store-and-forward si cae la red                     │
└──────────────────────────────────────────────────────────────────────────┘
        ▲ Modbus/CAN/SunSpec
   [ Inversor ]  [ BESS/BMS ]  [ Medidor ]  [ Grupo electrógeno / genset ]
```

**Principio de diseño clave (ya respetado en el código):** el backend prioriza
telemetría viva del broker y **cae a simulado solo si no hay datos**
([`energy.js:260`](../../../api/routes/energy.js) `vppBroker.getLatestTelemetry() || buildTelemetry()`).
Por tanto, **al conectar un Edge Gateway real el dashboard pasa a datos reales sin
tocar el frontend.**

---

## 3. Contratos de datos (esquema canónico)

### 3.1 Telemetría: Edge Gateway → Broker
- **Tópico:** `bezhas/edge/<nodeId>/telemetry` (QoS 1, retained=false)
- **Transporte:** MQTT sobre TLS (puerto 8883 en prod), auth por cliente.
- **Payload** (lo que [`ingest()`](../../../api/services/vppMqttBroker.js) espera hoy):

```jsonc
{
  "type": "SOLAR | WIND | HYDRO | BATTERY | LOAD | GENSET",
  "name": "Array Alpha",
  "status": "ONLINE | DEGRADED | OFFLINE",
  "protocol": "SunSpec/Modbus-TCP",        // real, no decorativo
  "metrics": {                              // se aplana sobre el nodo
    "output_kw": 18.42,                     // generación (negativo = consumo/carga)
    "consumption_kw": 0,                    // solo LOAD
    "grid_frequency": 50.01,                // Hz (medidor de cabecera)
    "voltage_v": 231.4, "irradiance": 870,  // específicos por tipo
    "soc_pct": 76.3, "temp_c": 33.1,        // BATTERY (BMS/CAN)
    "fuel_pct": 64, "rpm": 1500             // GENSET
  },
  "ts": "2026-06-24T10:15:00.000Z",         // ISO-8601 del Edge
  "seq": 84213,                             // contador anti-replay (NUEVO F2)
  "sig": "0x…"                              // firma ECDSA secp256r1 (NUEVO F2)
}
```

> **Nota de compatibilidad:** `seq` y `sig` son **aditivos**. `ingest()` ya ignora
> campos extra, así que se pueden empezar a emitir antes de implementar la
> verificación, sin romper nada.

### 3.2 Control SCADA: API → Edge Gateway
- **Tópico:** `bezhas/edge/<nodeId>/control` (QoS 2, retained=false)
- **Payload** (lo que [`publishControl()`](../../../api/services/vppMqttBroker.js) emite):

```jsonc
{
  "command": "CHARGE_BATTERY | DISCHARGE_BATTERY | SHED_LOAD | ISLANDING_MODE | EMERGENCY_STOP | SET_REACTIVE_POWER",
  "params": { "powerKw": 50, "durationMin": 30, "kvar": 100 },
  "ts": "2026-06-24T10:16:00.000Z",
  "jobId": "scada_…",                       // correlación con auditoría on-chain
  "sig": "0x…"                              // firma del backend (NUEVO F5)
}
```
- **ACK obligatorio (NUEVO F5):** el Edge responde en
  `bezhas/edge/<nodeId>/control/ack` con `{ jobId, accepted, applied, error?, ts }`.

### 3.3 Auditoría on-chain (BeZhasVPP.sol)
Cada comando despachado se registra con `vppChainBridge.logCommandOnChain(jobId, nodeId, command, params, powerKw)` → tx inmutable. La verificación de telemetría
(hash + firma) se ancla en `EnergyOracle.sol`.

---

## 4. Plan de desarrollo por fases

> Cada fase indica: **objetivo · archivos a crear/editar · criterio de aceptación (DoD)**.
> Las fases F1–F3 desbloquean "datos reales en pantalla"; F4–F6 añaden control y dinero.

### ✅ FASE 1 — Edge Gateway (Modbus/SunSpec → MQTT) · CONSTRUIDA
**Objetivo:** un dispositivo real publicando telemetría verídica al broker.

**Estado: implementada y verificada** en `D:/BeZhas-Blockchain/edge-gateway/`
(paquete standalone; `pnpm install --ignore-workspace`). Núcleo dirigido por datos:
driver → `decode.js` → `publisher.js` → MQTT `bezhas/edge/<nodeId>/telemetry`
(forma exacta que `vppMqttBroker.ingest()` espera).

- **Implementado:**
  - `src/decode.js` — decodificación pura: SunSpec (`sf`) **y** gain (divisor fijo),
    enteros 16/32-bit, `wordSwap`, multi-bloque. Sin dependencias.
  - `src/drivers/modbusSunspec.js` — driver Modbus-TCP genérico (jsmodbus, multi-bloque,
    holding/input). Alias `modbusHuawei`/`modbusDeye`/`modbusMeter`/`modbusTcp`.
  - `src/publisher.js` — payload §3.1 + `seq` monótono (anti-replay F2) + buffer.
  - `src/buffer.js` — store-and-forward NDJSON (backfill tras corte de red).
  - `src/index.js` — `startGateway()` + CLI (`--config`, `--dry-run`).
  - **Mapas de registros reales por fabricante** (`src/mapping/`):
    `registers.huawei-sun2000.json` (✅), `registers.fronius-sunspec.json` (✅¹),
    `registers.carlo-gavazzi-em24.json` (✅), `registers.huawei-smart-power-sensor.json` (🧪),
    `registers.deye-sun.json` (🧪), `registers.sunspec.json` (referencia). Matriz: `VENDORS.md`.
  - `scripts/sunspec-discover.js` — descubre la base SunSpec en el equipo real
    (Fronius/Ingeteam: direcciones absolutas dependen del firmware).
  - **Banco de pruebas sin hardware:** `scripts/modbus-sim.js`, `scripts/verify-edge-pipeline.js`
    (e2e SunSpec + MQTT), `scripts/verify-vendor-maps.js` (lectura Modbus real del mapa Huawei).
- **Librerías:** `jsmodbus` + `mqtt` (PURE JS, sin native build → corre en Raspberry/Windows).
- **DoD (verificado):**
  - [x] `pnpm test` → 11 tests verdes (decode SunSpec + Huawei + EM24 + walk SunSpec).
  - [x] `pnpm verify` → lectura Modbus real → decode → MQTT → recibido (rango físico OK).
  - [x] `pnpm verify:vendors` → mapa Huawei SUN2000 sobre Modbus-TCP real → métricas correctas.
  - [x] Reconexión automática + buffer offline implementados (`buffer.js`, retry en `pollOnce`).
- **PENDIENTE para producción:** apuntar a un equipo físico real (Huawei SUN2000 o EM24),
  confirmar `unitId` y mapa contra el manual del modelo; drivers RTU/CAN/genset (siguiente).

¹ Fronius: ejecutar `pnpm discover --host <ip>` para fijar `block.start` real.

### ✅ FASE 2 — Firma de telemetría + verificación (Aegis real) · CONSTRUIDA
**Objetivo:** que Aegis deje de ser un informe fijo y verifique integridad real.

**Estado: implementada y verificada e2e.** Algoritmo **ECDSA P-256 (secp256r1) /
SHA-256** — exactamente lo que computa el secure element **ATECC608A / TPM 2.0**,
así que la clave migra de software (dev) a hardware (prod) sin cambiar el protocolo.

- **Edge** (`edge-gateway/`):
  - `src/security/signer.js` — firma canónica (claves ordenadas, `sig` excluida),
    `keyId` incluido en la firma. `createSoftwareSigner` hoy; mismo contrato para HW.
  - `publisher.js` añade `keyId`+`sig` (aditivos) si hay firmante; `seq` ya existía.
  - `scripts/keygen.js` — provisiona clave por nodo e imprime la pública a registrar.
- **Backend** (`api/`):
  - `services/telemetrySecurity.js` — verificación P-256 con **misma canonicalización
    byte-a-byte** que el Edge (probado con `verify:signing`); registro de claves por
    `keyId` (`VPP_NODE_KEYS` / `VPP_KEYS_DIR`); enforcement gateado por
    `VPP_REQUIRE_SIGNED_TELEMETRY`.
  - `services/aegisAnomalyEngine.js` — reglas reales: `SPOOFING_ATTEMPT` (firma
    inválida/no firmada-si-enforced), `REPLAY` (`seq` no creciente), `SEQUENCE_GAP`,
    `IMPLAUSIBLE_VALUE` (fuera de límites físicos: V, Hz, SoC, °C…). Buffer de eventos.
  - `vppMqttBroker.ingest()` editado **aditivamente**: evalúa antes de confiar; HIGH
    (spoof/replay) → rechaza y **conserva el último dato bueno**; WARNING → acepta
    `DEGRADED`. Telemetría sin firma sigue aceptándose (simulador intacto).
  - `GET /api/energy/compliance/aegis` reescrito → stats + eventos reales del motor.
- **DoD (verificado):**
  - [x] `pnpm verify:signed` → Modbus real → firmado en Edge → MQTT → backend verifica
        e ingiere; copia manipulada (`output_kw=999`) → **rechazada** + `SPOOFING_ATTEMPT`.
  - [x] `pnpm verify:signing` → canonicalización Edge↔backend idéntica.
  - [x] Backend: 13 tests jest Aegis + 7 broker existentes = 20 verdes (simulador no roto).
- **PENDIENTE (siguiente sub-paso):** anclar el hash de telemetría firmada en
  `EnergyOracle.sol` periódicamente (parte de F4); persistir eventos Aegis en BD (F3).

### ✅ FASE 3 — Backend real con base de datos de series temporales · CONSTRUIDA (lógica)
**Objetivo:** persistir telemetría y servir histórico/analytics reales.

**Estado: implementada y testeada con `query` mock.** Falta SOLO correr la migración
contra un Postgres vivo para el e2e (no disponible en esta sesión).

- **BD:** migración `api/db/migrations/023_energy_telemetry.sql` — `telemetry_logs`
  (columnas escalares calientes + `metrics` JSONB, `seq`/`signed`/`key_id`) y
  `aegis_events`. Convierte `telemetry_logs` en **hypertable TimescaleDB** si la
  extensión está disponible (retención 90 d), con **fallback a Postgres plano**
  (bloque `DO $$ … EXCEPTION` → no-op si no hay TimescaleDB).
- **Persistencia:** `api/services/energyTelemetryStore.js` — cola en memoria +
  flush por lotes (no bloquea el handler MQTT); `capture()`, `flush()`, `start/stop`,
  `getHistory()`, `getAnalytics()`, `getAegisEvents()`. `query` inyectable para test.
- **Ingesta:** `vppMqttBroker.ingest()` llama un **sink opcional** (`setTelemetrySink`)
  best-effort tanto en aceptación como en rechazo → persiste telemetría + eventos Aegis.
  Cableado en `index.js` PASO 6 (`telemetryStore.start()` + carga de claves Fase 2).
- **Lecturas:** nuevos `GET /api/energy/telemetry/:nodeId/history?hours=&limit=` y
  `GET /api/energy/analytics?nodeId=&hours=` → alimentan `src/pages/Analytics.jsx`.
- **DoD:**
  - [x] Lógica capture→batch→flush→SQL + history/analytics testeada (8 tests, mock query).
  - [x] Broker invoca el sink en accept y reject (test wiring).
  - [ ] **PENDIENTE (requiere Postgres):** `cd api && node db/migrate.js` (migración 023)
        → reinicio del API conserva histórico; página Analytics muestra kWh reales.
  - [ ] `GET /nodes` desde BD real (sigue hardcoded — sub-paso menor pendiente).

### ✅ FASE 4 — Anclaje on-chain de telemetría firmada · CONSTRUIDA y VERIFICADA on-chain
**Objetivo:** que el dato físico firmado tenga prueba inmutable en cadena.

**Estado: implementada y verificada en una L2 real (Anvil).** Cierra el lazo
**dato físico → firmado (F2) → merkle root → prueba inmutable en `EnergyOracle.sol`**.
No requirió cambiar Solidity: `submitProof(...,string dataURI)` ya documentaba
`dataURI` como "telemetry merkle root".

- **Bridge** (`api/services/vppChainBridge.js`) extendido con `EnergyOracle`:
  `registerNodeOnChain()`, `anchorTelemetryOnChain(proofId,nodeId,account,kWh,period,root)`
  (→ `submitProof` GENERATION), `getProofOnChain()` (lee `dataURI` de vuelta).
  Refactor `_buildSigner()` compartido (NonceManager); gateado por
  `ENERGY_ORACLE_ADDRESS`/`CONTRACT_ENERGY_ORACLE` + `VPP_RPC_URL` + `VPP_OPERATOR_PK`.
- **Anclaje** (`api/services/telemetryAnchor.js`): merkle root **SHA-256** (sin ethers
  → testeable) de la telemetría firmada (hoja = canonical(payload con `sig`));
  `observe()` acumula desde el sink del broker; `buildBatch()` calcula root + Δ kWh +
  período; `anchorPending()` registra nodo + ancla; auto-anchor opt-in
  (`VPP_ANCHOR_AUTO=true`, intervalo `VPP_ANCHOR_INTERVAL_MS`).
- **Cableado** (`index.js`): sink compuesto `telemetryStore.capture + telemetryAnchor.observe`.
- **DoD (verificado):**
  - [x] `node scripts/verify-telemetry-anchor.js` → despliega `EnergyOracle` en Anvil,
        ancla telemetría firmada (Δ 25 kWh), lee la prueba: `dataURI == merkle root`,
        `kWh == 25`, cuenta correcta. **Tamper en una lectura cambia el root.**
  - [x] 9 tests jest del anclaje (merkle determinista/tamper-evidente + orquestación).
- **PENDIENTE producción:** deploy real a **Amoy** con `DeployEnergyVPP.s.sol`
  (`DEPLOYER_PRIVATE_KEY=0x… forge script … --rpc-url https://rpc-amoy.polygon.technology --broadcast`),
  rellenar `ENERGY_CONTRACTS` reales vía env (**sin tocar CLAUDE.md sin confirmación**),
  `sync-daemon.js --once` (ABI→frontend). Conectar `energyLedgerService` a contratos reales.

### ✅ FASE 5 — Control SCADA físico (write-path con HITL real) · CONSTRUIDA y VERIFICADA e2e
**Objetivo:** que un comando mueva hardware de verdad, con seguridad.

**Estado: implementada y verificada de extremo a extremo.** Un comando firmado por
el backend **escribe el registro real del equipo**; comandos manipulados o fuera de
límite son rechazados por el Edge sin tocar hardware.

- **Edge** (`edge-gateway/`):
  - `src/control/dispatcher.js` — verifica firma del backend → valida límites (defensa
    en profundidad) → escribe set-point por Modbus (`map.control`) → ACK firmado.
  - `src/drivers/modbusSunspec.js` `writeRegister()` (jsmodbus `writeSingleRegister`).
  - Sección `control` en los mapas (`SET_REACTIVE_POWER`→reg, `CHARGE/DISCHARGE_BATTERY`,
    `EMERGENCY_STOP`). `publisher.js` se suscribe a `…/control` y publica ACK en
    `…/control/ack`; cableado en `index.js` (`config.control.backendPublicKeyFile`).
- **Backend** (`api/`):
  - `services/controlSecurity.js` — FIRMA cada comando (ECDSA P-256); `GET /control/pubkey`
    expone la clave que el Edge usa para verificar.
  - `services/hitlQueue.js` — cola HITL real (PENDING→APPROVED/REJECTED/EXPIRED→APPLIED/FAILED),
    correlación de ACK. Reemplaza el passthrough.
  - `routes/energy.js`: comandos `requiresApproval` → `hitlQueue.submit`; nuevos
    `GET /control/pending`, `POST /control/:jobId/approve` (firma+despacha), `/reject`,
    `POST /control/ack`. Despacho directo ahora FIRMADO (`publishSignedControl`).
- **DoD (verificado):**
  - [x] `pnpm verify:control` → comando firmado `SET_REACTIVE_POWER kvar=100` → **reg40=100
        escrito en el equipo**; `EMERGENCY_STOP` → reg42=1; ACK firmado por el Edge.
  - [x] Comando manipulado (params cambiados tras firmar) → `invalid_signature`, no aplicado.
  - [x] Comando fuera de límite (kvar 999>200) → rechazado por el Edge.
  - [x] 9 tests jest HITL (state machine + ACK). Backend VPP suite = 46 verdes.
- **PENDIENTE producción:** notificación al operador (UI/push) para aprobar pendientes;
  enlazar el `POST /control/ack` real (hoy el Edge publica ACK por MQTT; un suscriptor
  backend puede reenviarlo a la cola).

### ✅ FASE 6 — Agente IA de arbitraje en producción · CONSTRUIDA y VERIFICADA e2e
**Objetivo:** decisiones autónomas OMIE/ESIOS + telemetría → batería, con seguridad.

**Estado: implementada y verificada de extremo a extremo.** El agente actúa **solo
por el write-path firmado de F5**, con modo *shadow* por defecto y tres controles de
riesgo de producción.

- **`energyArbitrageAgent.js`** (refactor producción): `evaluate()` puro intacto
  (OMIE real ya estaba); nuevo `dispatchDecision()` con:
  - **Modo `shadow`** (por defecto, `VPP_ARBITRAGE_MODE`): recomienda + registra P&L
    nocional, **nunca actúa** → validar antes de operar con dinero.
  - **Gate HITL por €**: exposición > `VPP_ARBITRAGE_HITL_EUR` (def. 500) → `hitlQueue`
    (aprobación humana), no despacho automático.
  - **Kill-switch Aegis**: nodo con anomalía HIGH reciente (spoofing/replay) → no opera.
  - **Despacho FIRMADO**: `controlSecurity.signCommand` + `publishSignedControl` (F5)
    + auditoría on-chain. `estimateEur()`, `getPnlSummary()`, `getDecisionLog()`.
  - `GET /api/energy/arbitrage/pnl` para la validación shadow.
- **DoD (verificado):**
  - [x] `pnpm verify:arbitrage` → agente *live* decide CHARGE → firma → MQTT → **Edge
        escribe `CHARGE_BATTERY` (reg41=100)**; €750 → HITL PENDING (no despacha);
        anomalía Aegis → kill-switch bloquea; *shadow* → no-op.
  - [x] 17 tests jest del agente (decisión + seguridad de producción).
- **PENDIENTE producción:** correr 7 días en *shadow* y revisar `getPnlSummary` antes de
  `VPP_ARBITRAGE_MODE=live`; sustituir `/alerts` hardcoded por salida del agente;
  enlazar € realizados a `energyLedgerService` → wallet.

> **Nota infra (resuelto en esta sesión):** el `mqtt` del paquete `api` tenía una
> extracción pnpm corrupta (`fast-unique-numbers` sin `factories/cache.js`) que
> **impedía al backend conectar al broker MQTT**. Reparado copiando el paquete íntegro
> desde `edge-gateway`. `node -e "require('mqtt')"` → OK.

---

## 5. Hardware del Edge Gateway (BOM de referencia)

| Elemento | Recomendación | Función |
|---|---|---|
| Cómputo | Raspberry Pi 4/5 (4 GB) o PLC industrial (Revolution Pi) | Drivers + MQTT |
| Modbus | Adaptador USB-RS485 (RTU) / Ethernet (TCP) | Inversor, medidor, genset |
| CAN | MCP2515 / PiCAN2 HAT | BMS de la batería (BESS) |
| Seguridad HW | **ATECC608A** (I²C) o TPM 2.0 | Clave privada de firma (no extraíble) |
| Conectividad | Ethernet + 4G de respaldo | Enlace al broker |
| Almacenamiento | SD industrial / eMMC | Buffer store-and-forward |

**Protocolos por equipo:**
- **Inversores solares:** SunSpec sobre Modbus-TCP (estándar de facto: SMA, Fronius,
  Huawei, Ingeteam).
- **Medidores:** Modbus RTU/TCP (DIN-rail, p. ej. Eastron SDM, Schneider iEM).
- **Baterías/BESS:** CAN (BMS) o Modbus según fabricante (Pylontech, BYD).
- **Grupos electrógenos:** Modbus sobre controlador (DeepSea DSE, ComAp InteliGen).

---

## 6. Seguridad y cumplimiento (transversal)

- **Anti-spoofing (RD 88/2026, Agregador Independiente):** firma HW de telemetría
  (F2) + anclaje on-chain (F2/F4). Sin firma válida, el dato no liquida.
- **MQTT seguro:** TLS 8883, credenciales por dispositivo, ACL por tópico
  (`bezhas/edge/<nodeId>/#` solo el dueño).
- **HITL real (F5):** comandos críticos requieren operario humano; auditado on-chain.
- **Secretos:** claves de firma **nunca a disco** del backend; en el Edge, dentro del
  secure element. Cumple regla `JWT/keys in-memory` del proyecto.
- **Defensa en profundidad:** límites físicos validados en backend **y** en Edge.

---

## 7. Dependencias, riesgos y orden recomendado

**Camino crítico:** F1 → F3 → (F2 en paralelo) → F4 → F5 → F6.
Los **precios de mercado ya son reales**, así que el agente (F6) solo espera a tener
SoC/telemetría reales (F1/F3) y write-path (F5).

| Riesgo | Mitigación |
|---|---|
| Acceso a un inversor/medidor real para pruebas | Empezar con simulador Modbus (`modpoll`/`dislave`) → mismo código |
| Variedad de fabricantes/registros | Mapa de registros por vendor (`registers.<vendor>.json`), driver agnóstico |
| Seguridad del control físico | F5 detrás de HITL + firma + límites duros; nunca exponer write-path sin F2 |
| Coste de gas on-chain | Batch de anclajes de telemetría; auditoría por evento, no por muestra |
| Regresión del demo | Mantener el simulador y el fallback `||  buildTelemetry()` intactos |

---

## 8. Próximos pasos inmediatos (sprint 0)

1. Crear el scaffold `edge-gateway/` (estructura F1) + `config.example.json`.
2. Levantar un broker local (`docker run -p 1883:1883 eclipse-mosquitto`) y validar
   el pipeline con `edge-node-simulator.js` (ya existe) como banco de pruebas.
3. Implementar el primer driver real (`modbusSunspec.js`) contra un simulador Modbus.
4. Diseñar la migración `telemetry_logs` (TimescaleDB) — F3.
5. Confirmar con Yoel el **primer equipo objetivo** (modelo de inversor/medidor) para
   fijar el mapa de registros.

---

*Generado a partir de auditoría del código real (junio 2026): `routes/energy.js`,
`services/vppMqttBroker.js`, `services/energyFeedService.js`, `scripts/edge-node-simulator.js`,
`src/api.js`, `smart-contracts/src/energy/*.sol`.*
