# Vendor coverage — BeZhas Edge Gateway

Maps live in `src/mapping/`. The driver + decoder are **vendor-agnostic**; adding
or fixing a device is a JSON change, not code. Two encodings are supported:

- **SunSpec** (`sf` scale-factor registers) — Fronius and any SunSpec device.
- **Gain** (`gain` fixed divisor) — Huawei, Deye, Carlo Gavazzi, etc.

Status legend: **✅ verified-logic** = decode proven by a deterministic test and/or
real Modbus-TCP read in CI scripts (addresses follow the published vendor map —
still confirm against your exact firmware). **🧪 template** = structure correct,
addresses need confirmation against your model's manual. **📋 planned**.

## Inverters

| Vendor | Models | Map file | Encoding | Status |
|---|---|---|---|---|
| **Huawei** | SUN2000 2–6KTL (1ph), 8–10KTL-M1 (3ph hybrid) | `registers.huawei-sun2000.json` | gain | ✅ verified-logic (decode test + real-Modbus e2e) |
| **Fronius** | Primo (1ph), Symo GEN24 (3ph hybrid) | `registers.fronius-sunspec.json` | SunSpec | ✅ verified-logic¹ |
| **Deye** | SUN series (1ph / 3ph hybrid) | `registers.deye-sun.json` | gain | 🧪 template² |
| **Ingeteam** | INGECON SUN 1Play (1ph) | — | SunSpec/gain | 📋 planned³ |
| Generic | any SunSpec inverter | `registers.sunspec.json` (reference) | SunSpec | ✅ verified-logic |

¹ **Fronius**: SunSpec absolute addresses are firmware-dependent. The map carries the
common Symo/Primo layout, but run `pnpm discover --host <ip>` (`scripts/sunspec-discover.js`)
to print the real model base on your unit and adjust `block.start`. The decode logic
is verified by the SunSpec model-walk test.

² **Deye**: two incompatible register generations exist. The template follows the
hybrid map; confirm every address against your unit's manual before production.

³ **Ingeteam INGECON SUN 1Play**: exposes Modbus TCP; newer firmware supports SunSpec
(use the Fronius/generic SunSpec path + `discover`), older uses an Ingeteam-specific
map. Add `registers.ingecon-sun.json` once the target unit's manual is available.

## Batteries (BESS) & gensets

| Device | Model | Map file | Encoding | Status |
|---|---|---|---|---|
| **BESS** | Pylontech / BYD / generic Modbus BMS | `registers.bess-modbus.json` | gain | ✅ verified-logic (decode + real-Modbus e2e) — provides the `soc_pct` the arbitrage agent needs |
| **Genset** | DeepSea DSE / ComAp InteliGen | `registers.genset-modbus.json` | gain | ✅ verified-logic (decode test) |

> Batteries/gensets that ONLY speak CAN bus (not Modbus) need a `canBms` driver
> (Linux `socketcan`) — planned; the Modbus path above covers the many BMS/controllers
> that expose Modbus-TCP or RTU-via-gateway.

## Meters / power analyzers (anti-export & control)

| Vendor | Model | Map file | Encoding | Status |
|---|---|---|---|---|
| **Carlo Gavazzi** | EM24-DIN (3ph) | `registers.carlo-gavazzi-em24.json` | gain | ✅ verified-logic (decode test, signed export) |
| **Huawei** | Smart Power Sensor (DTSU666-H, 1ph/3ph) | `registers.huawei-smart-power-sensor.json` | gain | 🧪 template⁴ |
| **Fronius** | Fronius Smart Meter (TS/IP) | via `registers.fronius-sunspec.json` discovery | SunSpec | 🧪 template⁵ |
| **Circutor** | CDP (anti-vertido) | — | gain/Modbus | 📋 planned⁶ |

⁴ **Huawei Smart Power Sensor**: read through the inverter at 37100+. Voltage/status
offsets are stable; confirm `active_power`/`frequency`/`energy` offsets against firmware.

⁵ **Fronius Smart Meter**: appears as a SunSpec meter model (201/203 or 211/213) — run
`pnpm discover` to find its model base, then add `registers.fronius-meter.json` with the
SunSpec meter offsets (the decoder already handles meter models).

⁶ **Circutor CDP**: Modbus map varies by CDP model (CDP-0, CDP-G). Add
`registers.circutor-cdp.json` from the unit's "Modbus protocol" manual.

## How to add / confirm a device

1. **SunSpec device (Fronius, Ingeteam new):** `pnpm discover --host <ip> --port 502 --unit 1`
   → note the inverter/meter model `data` address → set `block.start` + point addresses.
2. **Gain device (Huawei, Deye, Carlo Gavazzi, Circutor):** copy the closest map, set the
   register `address` + `gain` from the vendor's Modbus manual, map points → canonical
   `metrics`, add a `state` enum if there's a status register.
3. **Verify offline:** add a case to `__tests__/decode.test.js` with known raw registers →
   expected engineering values, then `pnpm test`.
4. **Verify over Modbus:** seed `scripts/verify-vendor-maps.js` (or point at the real
   device) and confirm decoded metrics.

## Canonical metrics (what each map should emit)

`output_kw` · `consumption_kw` · `dc_power_kw` · `voltage_v` · `current_a` ·
`grid_frequency` · `power_factor` · `temp_c` · `soc_pct` (battery) ·
`energy_kwh` · `energy_today_kwh`. The backend ingester reads `output_kw` /
`consumption_kw` / `grid_frequency`; the rest enrich the SCADA diagnostics panel.
