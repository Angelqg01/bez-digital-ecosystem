# Plan de Implementación — Simulador Logístico 360° (BeZhas LogiChain)

> Reemplaza `frontend/src/components/logistics/BeZhasLogisticsSimulator.jsx` por una
> simulación continua end-to-end: **Zona Franca de Cádiz → Tránsito Internacional →
> Proceso espejo en destino → Distribuidor Final**, tokenizando todo el ciclo.
>
> Fuentes fusionadas:
> - ZIP `bezhas-logistics-simulator` (React/TS + R3F): escena 3D, motor dinámico
>   `getDynamicStep`, cargas gaditanas, breach de cadena de frío, paneles.
> - TXT Kimi "Zona Franca de Cádiz": 10 etapas ZF, validadores con DIDs, explorer
>   multi-pestaña, B-UID, QR Track & Trace, métricas CO₂.
> - Simulador actual: comparativa "manual vs autónomo" (se conserva como modo intro).

---

## 1. Flujo unificado (3 fases, 16 etapas, 1 timeline)

Cada etapa emite: bloque en cadena simulada + evento B-UID + validaciones + telemetría.

### FASE A — ORIGEN: Zona Franca de Cádiz (del TXT)

| # | Etapa | Validador (DID) | Evento tokenización |
|---|-------|-----------------|---------------------|
| 1 | Fabricación | Fabricante SL `did:ind:fabricante:es` | **MINT DPP NFT (ERC-721)** · B-UID `CREATED` · Escrow `LOCKED` (colateral BEZ) |
| 2 | Embalaje RFID | Operador Logístico `did:log:operador:es` | Vinculación sensores IoT al DPP · **Food Oracle scan inicial** |
| 3 | Transporte a ZF | Transportista Cádiz | Telemetría en vivo (temp/hum/shock) anclada on-chain |
| 4 | Acceso ZF | Consorcio ZF Cádiz `did:zf:cadiz` | Gate check: verificación DID + RFID, entrada a régimen franco |
| 5 | Almacén ZF | Depósito Franco | **Digital Twin activo** · custodia registrada |
| 6 | Validación Aduanera | Agencia Tributaria `did:etr:aduanas:es` | e-SPS + UBL 2.1 + VUA → **Green Lane** on-chain · B-UID `CUSTOMS_CLEARED` |
| 7 | Inspección Física | Inspector Aduanero | **Food Oracle deep-scan** (contaminantes/frescura) sellado en DPP |
| 8 | Muelle Portuario | Autoridad Portuaria `did:port:cadiz:apbc` | Smart Stowage (COG) validado · B-UID `STOWED` |
| 9 | Carga en Buque | Compañía Naviera `did:mar:naviera:es` | **e-BL DCSA tokenizado (NFT)** · traspaso de custodia |
| 10 | Cierre Blockchain ZF | Red de Consenso | Checkpoint multi-validador · B-UID `DEPARTED` |

### FASE B — TRÁNSITO INTERNACIONAL (del ZIP)

| # | Etapa | Evento tokenización |
|---|-------|---------------------|
| 11 | Tránsito marítimo (variante: aéreo) | Oráculo satelital IoT · seguro paramétrico enlazado · **punto de inyección del breach** de cadena de frío |

### FASE C — DESTINO: proceso espejo hasta distribuidor final (del ZIP, invertido)

| # | Etapa | Evento tokenización |
|---|-------|---------------------|
| 12 | Desestiba puerto destino | Grúas smart-port · custodia Naviera → Operador · B-UID `IN_TRANSIT` |
| 13 | Aduana destino | Oráculo fiscal: **liquidación de aranceles en BEZ desde el escrow** · levante on-chain |
| 14 | Almacén / despacho destino | Digital twin sync · Food Oracle scan de verificación post-tránsito |
| 15 | Última milla | e-CMR (eFTI) firmado · GPS geofencing · telemetría frigorífica |
| 16 | Distribuidor Final | **PoD firmado → Escrow `RELEASED`** (o `HALTED/DISPUTE` si hubo breach) · DPP finalizado · **Certificado + QR Track & Trace** · B-UID `DELIVERED` |

Rama de breach (toggle en cualquier momento desde la fase B): telemetría fuera de rango
→ oráculo marca anomalía → etapa 16 congela el escrow, abre disputa L2 y el certificado
sale con informe forense en vez de sello verde.

---

## 2. Arquitectura de datos

- Se conserva el motor `getDynamicStep` del ZIP (agnóstico al flujo).
- `SimulationStep` se extiende con: `phase: 'zf-cadiz' | 'transit' | 'destination'`,
  `validator: { name, did, icon }`, `metrics?: { km, co2, fuel }`.
- Un único array `FLOW_360` (16 pasos) construido por composición:
  `[...ZF_CADIZ_STEPS, ...TRANSIT_STEPS(mode), ...DESTINATION_STEPS]` con
  `mode: 'sea' | 'air'` como variante seleccionable de la fase B.
- `bUidStage` sigue el ciclo CargoLink: `CREATED → CUSTOMS_CLEARED → STOWED →
  DEPARTED → IN_TRANSIT → DELIVERED` (formato `B-UID:TC-XXXX-CAD-ZFC-YYYY`),
  para poder enchufar datos reales de `api/services/cargoLinkLifecycle.js` más adelante.
- Cargas: las 3 gaditanas del ZIP (arándanos Conil, atún Barbate, vino Jerez) con
  rangos térmicos y límites críticos propios.

## 3. Estructura de archivos

```
frontend/src/components/logistics/simulator/
├── LogisticsSimulator360.tsx        # contenedor + orquestación del timeline
├── engine/
│   ├── types.ts                     # SimulationStep extendido, Phase, BUidStage
│   ├── flows/
│   │   ├── zfCadiz.ts               # etapas 1-10 (del TXT)
│   │   ├── transit.ts               # etapa 11 sea/air (del ZIP)
│   │   └── destination.ts           # etapas 12-16 (del ZIP, espejo)
│   ├── cargos.ts                    # 3 cargas gaditanas
│   ├── getDynamicStep.ts            # motor breach/escrow (del ZIP)
│   └── chain.ts                     # cadena de bloques simulada (hash/bloques del TXT)
├── scene/
│   ├── LogisticsScene3D.tsx         # escena R3F (base ZIP)
│   ├── zones/ZfCadizZone.tsx        # recinto ZF: naves, gate, muelle, grúas (del TXT)
│   ├── zones/OceanZone.tsx          # corredor marítimo/aéreo
│   ├── zones/DestinationZone.tsx    # puerto destino, aduana, distribuidor
│   └── CameraDirector.tsx           # cámara sigue al vehículo y transiciona entre zonas
├── explorer/                        # panel derecho (del TXT)
│   ├── ExplorerPanel.tsx            # tabs: Cadena|Escrow|NFTs|DIDs|Metrics|Logs
│   └── ValidatorNodesBar.tsx        # barra inferior de validadores con estado
├── panels/                          # ventanas flotantes (drag con framer-motion)
│   ├── DigitalTwinPanel.tsx
│   ├── FoodOracleScanner.tsx
│   ├── IoTTelemetryChart.tsx        # recharts
│   ├── CertificateModal.tsx
│   └── QRTrackTrace.tsx
├── intro/ManualVsAutonomous.tsx     # comparativa del simulador actual, como modo intro
└── TimelineProgressBar.tsx          # timeline con las 3 fases marcadas
```

## 4. Fases de trabajo

**F1 — Motor y datos (sin UI)**
Portar `types.ts`, `getDynamicStep`, `cargos.ts` del ZIP; escribir los 10 pasos ZF
(textos/validadores del TXT); componer `FLOW_360`; módulo `chain.ts`.
✔ Criterio: recorrido completo de 16 pasos en un test unitario (vitest ya está en el
frontend), con y sin breach, verificando estados de escrow y B-UID.

**F2 — Escena 3D**
Portar `LogisticsScene3D` del ZIP; añadir zona ZF Cádiz (edificios, gate con barrera,
grúas y buque del TXT recreados con drei); layout de 3 zonas + CameraDirector.
Deps nuevas: `@react-three/fiber`, `@react-three/drei` (pnpm). `React.lazy` para
toda la escena (three no entra en el bundle inicial del Hub).

**F3 — Explorer + validadores**
Panel derecho con las 6 pestañas del TXT en React; barra de validadores con DIDs que
se iluminan al firmar cada etapa; pestaña Metrics con km/CO₂/fuel acumulados.

**F4 — Paneles funcionales**
Digital Twin, Food Oracle Scanner (con sus 3 momentos: inicial, inspección física,
post-tránsito), telemetría IoT (recharts), certificado final y QR Track & Trace.
Ventanas arrastrables con framer-motion `drag` (sin `react-rnd`).

**F5 — Integración y reemplazo**
- `LogisticsPage.jsx`: la pestaña "SDK Simulator" monta `LogisticsSimulator360` (lazy).
- Controles de cabecera: Iniciar/Reset, velocidad, selector de carga, selector
  marítimo/aéreo, toggle breach, botones Twin/Oracle/Cert/QR.
- Eliminar `BeZhasLogisticsSimulator.jsx` (su comparativa pasa a `intro/`) y el
  `BeZhasLogisticsSimulator.txt` suelto en la raíz del Hub.

**F6 — QA**
`pnpm build` del frontend limpio; recorrido completo happy-path y breach-path en
navegador; verificación de bundle (escena solo carga al entrar en la pestaña);
responsive básico (paneles colapsan en móvil como en el TXT).

## 5. Decisiones ya tomadas

- Base de código: ZIP (React/TS). El TXT aporta contenido/estética del explorer y ZF.
- Todo mock/simulado en esta iteración; `useLogisticsContract.js` queda como punto
  de conexión futura a contratos reales (escrow BEZ Polygon) y CargoLink API.
- No se añaden: `react-rnd`, `cobe`, `@google/genai`, `express`, `cheerio`.
- Estética: dark luxury BeZhas (teal `#00D4AA` / gold `#FFD700`), reutilizando los
  tokens visuales del TXT que ya son coherentes con el design system.
