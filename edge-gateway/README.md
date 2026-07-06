# ⚡ BeZhas VPP Edge Gateway

The **physical-layer** piece of BeZhas Energy: it runs on a device next to the
hardware (Raspberry Pi / industrial PLC), reads real field equipment over their
native protocols, and publishes **canonical telemetry** to the MQTT broker that
the BeZhas Energy backend already ingests.

> This is **Phase 1** of [`../App's secundarias/bez-energy/docs/ARQUITECTURA_REAL_Y_PLAN.md`](../App's%20secundarias/bez-energy/docs/ARQUITECTURA_REAL_Y_PLAN.md).
> The backend (`api/services/vppMqttBroker.js`) prioritises live broker data and
> falls back to simulated values, so **running this gateway against real hardware
> makes the dashboard show real data with no other changes.**

## What it does

```
[ Inverter / Meter / BESS / Genset ]
        │ Modbus-TCP (SunSpec) / RTU / CAN
        ▼
[ driver ] → [ decode → canonical metrics ] → [ publisher ]
        │ store-and-forward buffer if offline
        ▼ MQTT  bezhas/edge/<nodeId>/telemetry
[ MQTT broker ] → backend vppMqttBroker → /api/energy/telemetry → dashboard
```

Published payload (`docs/ARQUITECTURA_REAL_Y_PLAN.md §3.1`):

```jsonc
{
  "type": "SOLAR", "name": "Array Alpha", "status": "ONLINE",
  "protocol": "SunSpec/Modbus-TCP",
  "metrics": { "output_kw": 18.42, "voltage_v": 231.4, "grid_frequency": 50.01, "energy_kwh": 1234.4, ... },
  "ts": "2026-06-24T10:15:00.000Z",
  "seq": 84213
  // sig: added in Phase 2 (ATECC608A/TPM hardware signature)
}
```

## Quick start (no hardware needed)

```bash
cd edge-gateway
pnpm install

# 1) Pure decode unit tests (offline, no deps needed at runtime):
pnpm test

# 2) Full end-to-end proof in ONE process (sim Modbus + in-proc broker):
pnpm verify

# 2b) Prove the Huawei vendor map over a real Modbus-TCP read:
pnpm verify:vendors

# 3) Run the simulator + gateway separately:
pnpm sim                    # terminal A — SunSpec inverter simulator on :1502
cp config.example.json config.json
pnpm start                  # terminal B — gateway polls sim, publishes to MQTT
#   (or `pnpm dry-run` to log payloads without a broker)
```

## Configuration

Copy `config.example.json` → `config.json`:

| Field | Meaning |
|---|---|
| `broker.url` | MQTT broker (prod: `mqtts://…:8883` with TLS) |
| `publishIntervalMs` | Poll + publish cadence per node |
| `buffer` | Store-and-forward (NDJSON) for offline backfill |
| `nodes[]` | One entry per device: `nodeId`, `type`, `driver`, `modbus{host,port,unitId}`, `map` |

## Register maps (per vendor)

The driver + decoder are **vendor-agnostic** — adding a device is a JSON change.
Two encodings: SunSpec scale-factors (`sf`) and fixed `gain` divisors. Full
coverage matrix + status in [`VENDORS.md`](./VENDORS.md).

| Device | Map | Encoding |
|---|---|---|
| Huawei SUN2000 (1ph/3ph) | `registers.huawei-sun2000.json` | gain |
| Fronius Primo / Symo GEN24 | `registers.fronius-sunspec.json` | SunSpec |
| Deye SUN (template) | `registers.deye-sun.json` | gain |
| Carlo Gavazzi EM24 meter | `registers.carlo-gavazzi-em24.json` | gain |
| Huawei Smart Power Sensor | `registers.huawei-smart-power-sensor.json` | gain |
| Generic SunSpec reference | `registers.sunspec.json` | SunSpec |

For **SunSpec** devices (Fronius, newer Ingeteam) absolute addresses are
firmware-dependent — discover them on the real unit:

```bash
pnpm discover --host 192.168.1.50 --port 502 --unit 1   # prints each model's base address
```

## Drivers

The Modbus-TCP driver is fully map-driven; config aliases (`modbusSunspec`,
`modbusHuawei`, `modbusDeye`, `modbusMeter`, `modbusTcp`) all resolve to it and
select behaviour via the map (SunSpec vs gain, single vs multi-block, word order).

| Driver | Status | Target |
|---|---|---|
| `modbusSunspec` / `modbusHuawei` / `modbusMeter` (Modbus-TCP) | ✅ this phase | SunSpec + gain inverters & meters over TCP |
| `modbusRtu` (serial RS485) | ⏳ next | RTU meters/inverters without a TCP gateway |
| `canBms` | ⏳ next | Battery BMS over CAN bus |
| `gensetModbus` | ⏳ next | Diesel/gas genset controllers (DSE/ComAp) |

## Telemetry signing (Phase 2 — anti-spoofing) ✅

Every payload is signed so the backend can prove it came from the registered
device and was not tampered with. Algorithm: **ECDSA P-256 (secp256r1) / SHA-256**
— exactly what an **ATECC608A / TPM 2.0** secure element computes natively, so the
key moves from software (dev) to hardware (prod) with no protocol change.

```bash
pnpm keygen --keyId edge-key-1 --out ./keys/edge-key-1.pem   # provision a node key
#   → prints the PUBLIC key to register on the backend (VPP_NODE_KEYS / VPP_KEYS_DIR)
# add to config.json:  "security": { "keyId": "edge-key-1", "privateKeyFile": "./keys/edge-key-1.pem" }
```

Signed payloads gain `keyId` + `sig` (both additive). The backend
(`api/services/telemetrySecurity.js` + `aegisAnomalyEngine.js`) verifies the
signature, sequence (`seq`) for replay, and physical plausibility:

| Anomaly | Severity | Action |
|---|---|---|
| invalid/unknown-key signature | HIGH | **reject** (spoofing) |
| `seq` not increasing | HIGH | **reject** (replay) |
| large `seq` gap | WARNING | accept, mark DEGRADED |
| metric out of physical range | WARNING | accept, mark DEGRADED |

Enforcement is gated: unsigned telemetry is accepted by default (simulator
stays usable); set `VPP_REQUIRE_SIGNED_TELEMETRY=true` on the backend to require
signatures. The fake Aegis report is now driven by real events
(`GET /api/energy/compliance/aegis`).

Verify the whole chain:
```bash
pnpm verify:signing   # Edge signer ↔ backend verifier canonicalization match
pnpm verify:signed    # real Modbus → Edge-signed → MQTT → backend ingest; tamper rejected
pnpm verify:all       # everything above + decode tests + vendor map e2e
```

## Roadmap (this gateway)

- **Phase 5** — subscribe to `bezhas/edge/<nodeId>/control`, verify backend
  signature, apply set-points, ACK on `…/control/ack`.

See the full plan in the architecture doc linked above.
