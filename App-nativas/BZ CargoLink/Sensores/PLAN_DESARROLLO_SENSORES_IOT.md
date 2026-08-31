# PLAN DE DESARROLLO — Sensores IoT + Hub de Ingestión Unificado (BZ CargoLink)

> Estado: **IMPLEMENTADO (las 8 fases) — 2026-07-17**. Migración `032_cargolink_iot_v2.sql`,
> servicios `cargoGeofence` / `cargoIngestHub` / `cargoDisputeOracle` / `cargoTelemetryAnchor`
> / `cargoMqttIngest`, `cargoLinkIot` v2 (pipeline canónico + firmas edge), contrato
> `TelemetryAnchor.sol` (8 tests forge), 43 tests jest nuevos (80 en la batería CargoLink,
> 438 en la suite api completa), frontend actualizado y simulador de ejemplo para clientes
> (`api/scripts/cargolink-device-simulator.js` + `doc/SENSORES_IOT_API.md`).
> Pendiente operativo: ejecutar la migración en la BD, desplegar `TelemetryAnchor`
> (incluido en `DeployAll.s.sol`) y configurar `CARGO_MQTT_URL` si se usa MQTT.
> Fecha de análisis original: 2026-07-17.

---

## 1. Qué YA está implementado ✅

| Idea del documento | Implementación real | Archivo |
| :--- | :--- | :--- |
| Registro de dispositivos IoT bajo BeZhas_ID, ligados a un B-UID | `POST /api/cargolink/v1/iot/devices` (clave de dispositivo `bzd_*` hasheada SHA-256, se entrega una sola vez) | `api/services/cargoLinkIot.js` · migración `020_cargolink_iot.sql` |
| Ingesta de telemetría normalizada (batch `readings[]` o campos planos) | `POST /v1/iot/telemetry` con `normalizeReadings()` | `api/services/cargoLinkIot.js:75` |
| Tipos de sensor | `gps`, `temp`, `shock` (acelerómetro), `rfid`, `multi` | idem |
| Reglas cold-chain / impacto → breach | `checkRule()`: rango temp `[2,8]°C` y `shockMax 5g` configurables por dispositivo | `cargoLinkIot.js:92` |
| Webhook firmado a suscriptores en brecha | Fan-out con **HMAC-SHA256** (`X-BeZhas-Signature`) — eventos `ON_COLD_CHAIN_BREACH` / `ON_SHOCK_ALERT` | `api/services/cargoLinkLifecycle.js:270-312` |
| Anclaje criptográfico a L2 | Anclaje post-commit de transiciones de ciclo de vida a `SupplyTracker`, `CustomsClearanceOracle`, `DeliveryEscrow` (degrada con gracia si no hay env vars) | `api/services/cargoLinkOnChain.js` |
| Smart escrow en BEZ | Lock al crear tx, release en estado terminal (BEZ V1 Polygon como moneda de settlement) | `api/services/cargoLinkLifecycle.js:129-226` |
| UI de telemetría en vivo | Página `Telemetry.jsx` con feed por B-UID, breaches y auto-refresh | `BZ CargoLink/src/pages/Telemetry.jsx` |
| Tests | `cargolink-iot.test.js`, e2e full-flow | `api/__tests__/` |

Además existen **activos reutilizables** en el monorepo:
- **Broker MQTT + simulador edge** (bez-energy): `api/services/vppMqttBroker.js`, `api/scripts/edge-node-simulator.js` — patrón directo para el pilar MQTT de CargoLink.
- **Sensor Hub BLE/NFC/Gateway real** (BZ PureScan): `src/services/sensorHub.js` (Web Bluetooth GATT 0x181A, NDEFReader, gateway LoRaWAN vía API) + `disputeOracle.js` (matriz de severidad → Smart Settlement) — patrón para BLE y para el oráculo de disputas.

## 2. Qué FALTA (gaps vs. los documentos) ❌

1. **Tipos de sensor incompletos**: sin e-seals (`CONTAINER_UNSEALED`), fotosensores (luz = brecha), barométricos (carga aérea), balizas BLE, AIS/OBD-II. La humedad se almacena pero **no tiene regla** de breach.
2. **Payload unificado incompleto**: no existe la taxonomía `event_type` (`CONTAINER_UNSEALED`, …), ni `data_source.provider`, ni `geofence_verified`, ni `tamper_detected`, ni `security_signature` del documento.
3. **Geofencing**: cero validación de coordenadas contra zonas autorizadas (puertos, recintos aduaneros).
4. **Ingesta de terceros (API-First)**: no hay endpoint inbound para webhooks de DHL/naviera/autoridad portuaria/Ventanilla Única con **verificación HMAC de entrada**. El HMAC actual es solo saliente.
5. **Firmas criptográficas en el edge**: el dispositivo autentica con bearer key, pero el payload no va firmado (sin verificación de firma por hardware/secp256k1/Dilithium).
6. **DIDs**: no hay identidades descentralizadas por actor (la identidad es BeZhas_ID centralizado — aceptable como fase 1, pero no es lo descrito).
7. **MQTT/LoRaWAN para cargo**: el broker MQTT existe solo para bez-energy; CargoLink solo ingiere por REST.
8. **Capa de agentes IA**: la validación es de umbral estático; no hay agente que evalúe reglas de negocio compuestas ("¿el precinto se abrió dentro del geofence del puerto autorizado?").
9. **Anclaje de telemetría**: se anclan transiciones de lifecycle, pero **no** pruebas criptográficas (hash/merkle) de lotes de telemetría ("Ruta Madrid-Frankfurt sin alteraciones").
10. **Escrow no reacciona a brechas**: una brecha solo dispara webhook; no marca la tx en disputa ni retiene el escrow.

---

## 3. Plan de desarrollo por fases

### FASE 1 — Payload Unificado + nuevos tipos de sensor (backend, ~1 sesión)
**Objetivo:** que cualquier evento (hardware propio o tercero) tenga la misma forma canónica.

- [ ] Ampliar `cargolink_devices.type`: añadir `eseal`, `light`, `baro`, `ble`, `humidity` (migración `03X_cargolink_iot_v2.sql`).
- [ ] Ampliar `normalizeReadings()`: métricas `light` (lux), `pressure` (hPa), `door`/`seal` (open/closed), `ble_zone`.
- [ ] Nueva tabla/columnas de **evento canónico**: `event_type` (`CONTAINER_UNSEALED`, `LIGHT_BREACH`, `PRESSURE_LOSS`, `GEOFENCE_EXIT`, `COLD_CHAIN_BREACH`, `SHOCK_ALERT`, `CHECKPOINT_*`), `data_source (provider, device_or_system_id)`, `tamper_detected`, `geofence_verified`.
- [ ] Reglas nuevas en `checkRule()`: humedad (rango), luz (>umbral en estado sellado = tamper), presión (caída brusca), apertura de seal fuera de checkpoint aduanero.
- [ ] Tests unitarios por regla (patrón de `cargolink-iot.test.js`).

### FASE 2 — Geofencing (backend + config por tx, ~1 sesión)
- [ ] Tabla `cargolink_geofences` (nombre, tipo `port|customs|warehouse|route_corridor`, polígono o centro+radio) ligada a B-UID o a plantilla de ruta.
- [ ] `checkGeofence(lat, lng, tx)` en la ingesta: marca `geofence_verified` y emite `GEOFENCE_EXIT`.
- [ ] Regla compuesta clave del documento: **seal abierto + fuera de geofence aduanero = `tamper_detected: true`** → breach crítico.
- [ ] UI: dibujar geofences en `PortsMap.jsx` / `ActiveRoute.jsx`.

### FASE 3 — Hub de Ingestión de Terceros (API-First, ~1-2 sesiones)
**Objetivo:** entradas simétricas — mismo payload canónico venga de donde venga.

- [ ] Tabla `cargolink_providers` (provider_id, tipo `carrier|port_authority|customs|forwarder`, secreto HMAC, mapping JSON).
- [ ] `POST /v1/ingest/:providerId` — webhook inbound con verificación **HMAC-SHA256 de la cabecera** (espejo del fan-out saliente ya existente).
- [ ] Capa de **mapeo por proveedor**: transforma el JSON del tercero al evento canónico de Fase 1 (mapping declarativo en DB, no código por proveedor).
- [ ] Rate-limit + replay protection (timestamp + nonce) en el endpoint inbound.
- [ ] Registrar en `data_source.provider` (`DHL_API`, `PORT_AUTHORITY_API`, `PROPRIETARY_E_SEAL`…).

### FASE 4 — MQTT/LoRaWAN para cargo (reutilizar bez-energy, ~1 sesión)
- [ ] Generalizar `vppMqttBroker.js` → `mqttIngestBroker.js` compartido, con namespace de topics `cargolink/{deviceId}/telemetry`.
- [ ] Adaptar `edge-node-simulator.js` a perfiles de sensor logístico (e-seal, reefer, tracker GPS) para test e2e sin hardware.
- [ ] Puente ChirpStack (LoRaWAN): documentar el webhook de ChirpStack → `POST /v1/ingest/chirpstack` (usa la Fase 3, no requiere código nuevo de transporte).

### FASE 5 — Firmas edge + verificación (seguridad, ~1 sesión)
- [ ] Campo `security_signature` en el payload: firma secp256k1 (o ML-DSA-65 híbrida — ya existe `PQCManager` en el repo) del hash del batch, con clave pública registrada en `cargolink_devices.pubkey`.
- [ ] Verificación en la ingesta: firma inválida → rechazo + evento `SIGNATURE_INVALID`.
- [ ] Mantener bearer key como fallback para dispositivos sin secure element (marcar `trust_level: 'key' | 'signed'` en la telemetría).
- [ ] DIDs: **posponer** — el BeZhas_ID + pubkey por dispositivo cubre el 90% del valor; documentar como fase futura.

### FASE 6 — Capa de validación por agentes + oráculo de disputas (~1-2 sesiones)
- [ ] Servicio `cargoDisputeOracle.js` portando la **matriz de severidad** de PureScan (`disputeOracle.js`) a logística: severidad = f(tipo de breach, etapa del lifecycle, valor del escrow).
- [ ] Acciones según severidad: `ALERT_ONLY` → webhook (actual) · `HOLD_ESCROW` → `escrow_status = 'DISPUTED'` (no release en estado terminal) · `AUTO_CLAIM` → propuesta de settlement.
- [ ] Hook opcional a OpenClaw/agente para reglas compuestas en lenguaje natural (config del despacho aduanero) — detrás de flag, la matriz determinista es el default.
- [ ] Migración: `escrow_status` admite `DISPUTED`; `advanceTransaction()` bloquea release si hay disputa abierta.

### FASE 7 — Anclaje criptográfico de telemetría (on-chain, ~1 sesión)
- [ ] Job de consolidación: cada N horas o al cierre de etapa, calcular **merkle root** del lote de telemetría del B-UID.
- [ ] Anclar el root vía `cargoLinkOnChain.js` (extender `SupplyTracker` o añadir `TelemetryAnchor.sol` con `anchorBatch(bUid, merkleRoot, fromTs, toTs)` + tests forge).
- [ ] Endpoint `GET /v1/iot/proof/:bUid` — devuelve root + prueba de inclusión para una lectura concreta (verificable por terceros).
- [ ] ZK proofs: **posponer** (coste/beneficio); el merkle root cubre la inmutabilidad descrita.

### FASE 8 — Frontend (~1 sesión)
- [ ] `Telemetry.jsx`: iconos/colores para las métricas nuevas (`light`, `pressure`, `seal`, `ble_zone`), badge `trust_level`, badge `geofence`.
- [ ] `TransactionDetail.jsx`: timeline de eventos canónicos con `data_source.provider` y estado de disputa del escrow.
- [ ] Panel de registro de dispositivos y proveedores en `DeveloperIntegration.jsx` (mostrar la device key una sola vez).
- [ ] `CargoFingerprint.jsx`: enlazar al merkle proof de Fase 7.

---

## 4. Orden recomendado y dependencias

```
FASE 1 (payload + sensores) ──► FASE 2 (geofence) ──► FASE 6 (oráculo/escrow)
        │                                                   ▲
        └──► FASE 3 (ingesta terceros) ──► FASE 4 (MQTT)    │
        └──► FASE 5 (firmas edge) ──────────────────────────┘
FASE 7 (anclaje) tras 1; FASE 8 (UI) al final o en paralelo.
```

Prioridad de valor comercial (según el propio documento, expansión API-First):
**1 → 3 → 2 → 6 → 8**, dejando 4, 5 y 7 para cuando haya hardware/cliente real.

## 5. Decisiones tomadas en los documentos que este plan respeta

- Hub de Ingestión Unificado con **entradas simétricas** (hardware propio y terceros → mismo evento canónico).
- Nada de telemetría cruda a blockchain: solo pruebas (merkle root) y transiciones.
- HMAC-SHA256 para terceros; firma criptográfica en el edge para hardware propio.
- Agentes locales como filtro previo al anclaje L2 (matriz determinista primero, IA opcional).
