# BZ CargoLink — API de Sensores IoT y Hub de Ingestión Unificado

> Guía de integración para clientes. Todo lo descrito aquí es **real** y está en
> producción de código (`api/routes/cargolink.js`). El script
> `api/scripts/cargolink-device-simulator.js` es el **ejemplo ejecutable** de
> todo este documento: úsalo como referencia de tu integración.

Base URL: `https://api.bez.digital/api/cargolink` (dev: `http://localhost:3001/api/cargolink`)

## Concepto

Hardware propio (e-seals, reefer loggers, trackers) y sistemas externos (carriers,
autoridades portuarias, aduanas) entran por **el mismo pipeline canónico**:

```
[Dispositivo / Webhook externo]
        │  normalización (payload unificado)
        ▼
[Reglas: cadena de frío · shock · luz · presión · humedad · e-seal · geocercas]
        │  brechas
        ▼
[Oráculo de disputas — matriz de severidad 0-3]
        │  Leve → webhook  ·  Moderado/Crítico → escrow BEZ DISPUTED + propuesta
        ▼
[Webhooks firmados HMAC a tus sistemas] + [Anclaje merkle on-chain]
```

## 1. Dispositivos propios

### Registrar (rol `pos`/`admin`, clave `bzk_…`)

```http
POST /v1/iot/devices
Authorization: Bearer bzk_live_…
{
  "type": "eseal",              // gps | temp | humidity | shock | rfid | multi | eseal | light | baro | ble
  "bUid": "BZ-LOG-…",           // envío al que se vincula (opcional)
  "label": "E-seal contenedor 7",
  "signerAddress": "0x…",       // OPCIONAL: exige firma secp256k1 en cada payload
  "config": { "tempMin": 2, "tempMax": 8, "shockMax": 5, "lightMaxLux": 50,
              "humidityMax": 85, "pressureMinHpa": 750 }
}
→ { "device": {...}, "deviceKey": "bzd_…" }   // la deviceKey se muestra UNA vez
```

### Enviar telemetría (el dispositivo autentica con su `bzd_…`)

Forma plana (sensores sencillos):

```http
POST /v1/iot/telemetry
Authorization: Bearer bzd_…
{ "bUid": "BZ-LOG-…", "temperature": 4.2, "humidity": 62, "shock": 0.4,
  "light": 3, "pressure": 1013, "seal": "closed", "bleZone": "WAREHOUSE-A3",
  "lat": 36.1408, "lng": -5.4386 }
```

Forma `readings[]` (batch, obligatoria si el dispositivo firma):

```json
{
  "bUid": "BZ-LOG-…",
  "recordedAt": "2026-07-17T10:00:00.000Z",
  "readings": [
    { "metric": "temperature", "value": 4.2, "unit": "°C" },
    { "metric": "seal", "state": "open", "lat": 36.1408, "lng": -5.4386 }
  ],
  "signature": "0x…"   // ver §1.1
}
```

Respuesta: lecturas almacenadas + `breaches[]` + `verdict` del oráculo +
`dispute` (si retuvo el escrow) + `webhookDeliveries`.

#### 1.1 Firma edge (secure element)

Si registraste `signerAddress`, cada payload DEBE ir firmado (EIP-191 /
`personal_sign`) sobre exactamente este JSON:

```js
const canonical = JSON.stringify({ deviceId, bUid, recordedAt, readings });
const signature = await wallet.signMessage(canonical);   // ethers v6
```

Firma inválida o ausente → `401 SIGNATURE_INVALID`. La telemetría verificada se
marca `trust_level: "signed"`.

#### 1.2 MQTT (conexiones intermitentes)

Mismo body + `deviceKey` dentro del JSON, publicado a:

```
bezhas/cargo/<deviceId>/telemetry
```

(Broker: `CARGO_MQTT_URL`; el pipeline es idéntico al HTTP.)

## 2. Geocercas

```http
POST /v1/geofences        (rol pos/admin)
{ "name": "Aduana Algeciras", "kind": "customs",   // port | customs | warehouse | route_corridor
  "bUid": "BZ-LOG-…",                              // opcional (global si se omite)
  "centerLat": 36.1408, "centerLng": -5.4386, "radiusM": 2000,
  "polygon": [[lat,lng],…],                        // alternativa al círculo
  "enforce": false }                               // true en route_corridor → GEOFENCE_EXIT fuera de él
GET  /v1/geofences?bUid=…
DELETE /v1/geofences/:id
```

Reglas compuestas clave:

| Evento | Condición | Severidad |
| :--- | :--- | :--- |
| `CONTAINER_UNSEALED` + tamper | e-seal abierto **fuera** de toda zona port/customs/warehouse | Crítica (escrow retenido, propuesta reembolso 100 %) |
| `CONTAINER_UNSEALED` | abierto **dentro** de zona autorizada | Inspección legítima (solo evento) |
| `LIGHT_BREACH` | luz > umbral antes del despacho aduanero | Crítica / Moderada después |
| `GEOFENCE_EXIT` | GPS fuera de todo corredor `enforce` | Moderada |
| `COLD_CHAIN_BREACH` | desviación ≤5°C → Leve · >5°C → Moderada | según desviación |
| `PRESSURE_LOSS` (aéreo) | fuera de `pressureMinHpa`/`MaxHpa` | Moderada |

## 3. Sistemas externos (API-First)

### Registrar proveedor

```http
POST /v1/providers        (rol pos/admin)
{ "name": "DHL_API", "kind": "carrier",   // carrier | port_authority | customs | forwarder | network_server
  "mapping": {
    "buidField": "shipment.reference",
    "eventField": "status",
    "events": { "SEAL_OPEN": "CONTAINER_UNSEALED", "POD": "CHECKPOINT_DELIVERED" },
    "systemIdField": "device.id",
    "timestampField": "occurred_at",
    "telemetryFields": { "location.lat": "lat", "location.lng": "lng", "sensors.temp_c": "temperature" },
    "config": { "tempMax": 8 }            // umbrales opcionales para este feed
  } }
→ { "provider": {...}, "secret": "bzp_…", "ingestUrl": "/api/cargolink/v1/ingest/prv_…" }
```

El `mapping` es declarativo (rutas con puntos): el payload del proveedor se
normaliza al evento canónico sin código a medida. Para LoRaWAN, apunta el
webhook de tu network server (p. ej. ChirpStack) a la misma `ingestUrl`.

### Enviar un webhook (lado proveedor)

```
firma = HMAC_SHA256(secret, `${timestamp}.${nonce}.${rawBody}`)

POST {ingestUrl}
X-BeZhas-Timestamp: <unix seconds>   (ventana ±300 s)
X-BeZhas-Nonce: <único por petición> (anti-replay: un solo uso)
X-BeZhas-Signature: sha256=<hex>
<rawBody JSON>
```

La firma cubre los **bytes exactos** del body — no re-serialices.

## 4. Disputas y escrow BEZ

Brecha moderada/crítica ⇒ el escrow `LOCKED` pasa a `DISPUTED` (la entrega
terminal ya **no** lo libera) y se abre una disputa con propuesta de settlement.

```http
GET  /v1/disputes?bUid=…
POST /v1/disputes/:id/resolve    { "resolution": "release" | "refund" | "partial" }
```

Webhooks: `ON_DISPUTE_OPENED`, `ON_DISPUTE_RESOLVED`, `ON_COLD_CHAIN_BREACH`,
`ON_SHOCK_ALERT`, `ON_TELEMETRY_ALERT` — firmados `X-BeZhas-Signature:
sha256=HMAC(secret, body)`.

## 5. Anclaje criptográfico (merkle)

```http
POST /v1/iot/anchor/:bUid     → consolida lo no anclado en un merkle root sha256
                                (sorted pairs) y lo ancla en TelemetryAnchor.sol
GET  /v1/iot/anchors?bUid=…
GET  /v1/iot/proof?bUid=…&readingId=…   → { leaf, proof[], root, verified, anchor }
```

Cualquier tercero puede verificar la prueba off-chain o con
`TelemetryAnchor.verify(bUid, index, leaf, proof)` on-chain.

## 6. Demo completa en 2 minutos

```bash
export CARGOLINK_ACTOR_KEY=bzk_live_…
node api/scripts/cargolink-device-simulator.js setup     # tx + geocerca + devices + provider
node api/scripts/cargolink-device-simulator.js run       # telemetría normal (Ctrl+C)
node api/scripts/cargolink-device-simulator.js breach    # 14°C → disputa moderada, escrow retenido
node api/scripts/cargolink-device-simulator.js tamper    # e-seal abierto en Sevilla → crítica (firmado)
node api/scripts/cargolink-device-simulator.js provider  # webhook DHL con HMAC
node api/scripts/cargolink-device-simulator.js anchor    # merkle root + prueba de inclusión
node api/scripts/cargolink-device-simulator.js status    # resumen
```
