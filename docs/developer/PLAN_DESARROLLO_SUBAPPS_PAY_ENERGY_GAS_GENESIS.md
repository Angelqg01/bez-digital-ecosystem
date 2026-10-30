# Plan de desarrollo: BeZhas Pay, BEZ Energy, Gas Tank Manager y BZ Genesis

> **Fecha:** 2026-10-27 · **Rama de análisis:** `fix/auditoria-tests` (Gas Tank: `release/2026-10-24`)
> **Método:** lectura del código de cada SubApp, de sus rutas en `api/` y de los planes previos.
> No se ha ejecutado ninguna app; las estimaciones son para una persona a tiempo completo.

| SubApp | Carpeta | En producción | Estado real | Plan previo |
|---|---|---|---|---|
| **BeZhas Pay** | `App-nativas/bezhas-pay-manager` | Sí, `pay.bezhas.com` | Funcional pero mínima: compra de BEZ real (Stripe y SEPA) y enlaces de cobro. La API ofrece mucho más de lo que muestra la app. | No hay |
| **BEZ Energy** | `App-nativas/bez-energy` | Sí, `energy.bezhas.com` | Software de las 6 fases construido y verificado en local, pero en producción sin equipos conectados y con telemetría aleatoria. | `App-nativas/bez-energy/docs/ARQUITECTURA_REAL_Y_PLAN.md` |
| **Gas Tank Manager** | `App-nativas/gas-tank-manager` | No (sin certificado) | Backend y contratos muy avanzados en la rama `release/2026-10-24`: ledger, recarga Stripe, paymaster ERC-4337 y KMS. Falta desplegar y abrir. | `docs/developer/GAS_TANK_PLAN_DESARROLLO.md` (en `release/2026-10-24`) |
| **BZ Genesis** | `App-nativas/BZ Genesis` | No | Maqueta: una pantalla y un SDK simulado, sin backend. Alcance decidido: salud tokenizada (12 módulos, §4). | Este documento |

## Orden recomendado

1. **Pay, fase 0-1**: ya cobra dinero real en producción, así que sus huecos (webhook sin probar, sin historial de pedidos) son los de más riesgo.
2. **Energy, fase 0**: en producción enseña datos aleatorios como si fueran de planta. Es un arreglo de días.
3. **Gas Tank, despliegue**: es la más avanzada en backend y desbloquea el patrocinio de gas para Hub, Wallet, CargoLink y PureScan.
4. **Energy, piloto con hardware real**.
5. **Genesis**: primero los módulos B2B sin datos de pacientes (G0-G2) y después los del paciente (G3-G5), al ritmo de los permisos.
6. **Pay, fases 2-4** (KYC, comercios, venta), en paralelo con lo anterior cuando haya respuesta legal.

Calendario orientativo: unas 6 semanas para dejar Pay, Energy y Gas Tank en un estado presentable a clientes, y otras 8-10 para el piloto de Energy y la primera versión de Genesis.

---

## 1. BeZhas Pay (`pay.bezhas.com`)

### 1.1 Estado actual (verificado)

**Frontend:** `src/App.jsx`, unas 250 líneas.
- Tiene dos rutas: `/` para comprar BEZ en USD con tarjeta (redirige a Stripe Checkout) o con transferencia SEPA (muestra IBAN y referencia), y `/c/:token`, que redirige a la página de pago alojada por la API.
- Muestra precio, comisión del 2,5 %, idempotencia por pedido y el error `KYC_REQUIRED`.
- Incluye el chat de la plataforma (`AIWorkspaceBar`).

**API ya existente** (`api/routes/gateway.js`), sin pantalla en Pay:
- `GET /payments/:id`: estado de un pedido.
- `GET /payments/history/:address`: historial.
- `POST /payments/sell`: solo inserta una fila `pending`, no ejecuta nada.
- `POST /payments/send`.
- `POST /payments/:id/refund`: solo con la clave de liquidación interna.
- `GET /kyc/status/:address` y `POST /kyc/status`: el nivel lo fija alguien con la clave interna. **No hay proveedor de KYC integrado.**
- `GET /checkout/:token`: estado público de la página `/c/<token>` (`api/routes/checkout.js`).

**Huecos:**
- No hay tests.
- El README es la plantilla de Vite.
- La memoria del proyecto dice que falta confirmar el secreto del webhook de Stripe con un evento de prueba.
- Hay una decisión abierta: pedidos en USD contra una cuenta SEPA en EUR.

### 1.2 Fases

**Fase 0 · higiene (2-3 días)**
- [ ] Enviar un evento de prueba desde el panel de Stripe al webhook `api.bezhas.com/api/webhooks/stripe` y confirmar un 200 (no un 400 de firma).
- [x] **Pedidos SEPA en EUR** (decisión del 2026-10-27, hecho). `POST /payments/buy` acepta `amountEUR` con `paymentMethod: bank`. La orden guarda el cambio del BCE (`services/fxService.js`) y el importe EUR exacto en `note.fiat`; internamente sigue en USD para el KYC, las comisiones y el precio del BEZ. Si no hay cambio disponible, responde 503 y no inventa uno. Las instrucciones SEPA, `/payments/:id`, la página `/c/<token>` y la app de Pay muestran EUR. `GET /payments/fx` publica el cambio para el presupuesto previo. Tests en `api/__tests__/routes/gateway-payments-eur.test.js`. La tarjeta (Payment Links de Stripe) sigue en USD.
- [ ] Tests con Vitest del cálculo (recibes, comisión, total), de `mensajeError` y del flujo de `comprar()` con `fetch` simulado.
- [ ] Sustituir el README de plantilla por uno real (qué hace, variables, despliegue).

**Fase 1 · área de cliente (1-2 semanas)**
- [ ] Página **Mis pedidos** sobre `/payments/history/:address`, con filtros por estado.
- [ ] **Detalle del pedido** con sondeo de `/payments/:id`: pendiente → pagado → BEZ entregados, con enlace a la transacción en Polygonscan.
- [ ] Redirección tras pagar: la compra con tarjeta usa Payment Links (`config/stripe-payment-links.js`), cuya vuelta se configura en Stripe; en septiembre algunos aún apuntaban a `hub.bez.digital`, un dominio caducado. Hacer que vuelvan a una pantalla de resultado de Pay (`/pedido/:id`).
- [ ] Recibo descargable o enlace a la factura de Stripe.
- [ ] Mostrar el límite sin KYC y el nivel actual (`/kyc/status/:address`) antes de pagar, no solo cuando falla.

**Fase 2 · KYC real (2-3 semanas)**
- [ ] **Proveedor recomendado: Didit** para empezar, con **Sumsub** como alternativa cuando haga falta la Travel Rule integrada.

  | | Didit | Sumsub |
  |---|---|---|
  | Precio | 500 KYC completos gratis al mes y después 0,33 $; screening AML 0,20-0,30 $; KYB 2 $ | 1,35 $ por verificación (Basic) o 1,85 $ (Compliance, con AML); mínimos de 149 $ y 299 $ al mes |
  | Travel Rule | No incluida | Incluida en los dos planes |
  | Encaje | Empresa de Barcelona, soporte en español, KYC reutilizable; ideal con poco volumen | El estándar en exchanges cripto; mejor si BeZhas pasa a enviar BEZ a wallets de terceros |

  Las páginas de Didit se contradicen (antes decían «KYC gratis ilimitado»): confirmar el precio en el contrato.
- [ ] Su webhook llama a `POST /kyc/status` con la clave interna, que ya existe. Niveles: 0 sin KYC, 1 identidad y prueba de vida, 2 con AML y prueba de domicilio.
- [ ] Flujo dentro de Pay: iniciar verificación, mostrar el estado y desbloquear el límite.
- [ ] Revisar con asesoría si aplica la Travel Rule (Reglamento UE 2023/1113) a las entregas de BEZ.

**Fase 3 · cobros para empresas (2-3 semanas)**
- [ ] Panel de comercio: crear enlaces de cobro reutilizando `services/bezPayOrders.js` (el mismo servicio que la herramienta MCP `bezhas_checkout_prepare`), listarlos y ver su estado.
- [ ] Ruta de reembolso para el propio comercio, con permisos de organización. Hoy solo existe con la clave interna.
- [ ] Webhooks del pedido hacia el comercio y conciliación SEPA por referencia.
- [ ] Widget o botón incrustable para webs de terceros.

**Fase 4 · venta y envío de BEZ (bloqueada por decisión legal)**
- [ ] La venta de BEZ a fiat (off-ramp) y el envío a terceros convierten a BeZhas en proveedor de servicios de criptoactivos según MiCA. No exponerlos en la app hasta tener la respuesta legal. Mientras tanto, `/payments/sell` debería responder «no disponible» en lugar de crear filas pendientes que nadie procesa.

**KPIs:** pedidos creados frente a pagados, tiempo hasta la entrega de BEZ, porcentaje de pedidos bloqueados por KYC y reembolsos.

---

## 2. BEZ Energy (`energy.bezhas.com`)

### 2.1 Estado actual (verificado)

El documento `ARQUITECTURA_REAL_Y_PLAN.md` marca las 6 fases como construidas y verificadas en local:
- edge gateway Modbus/SunSpec → MQTT,
- firma de telemetría y Aegis,
- base de datos de series temporales,
- anclaje on-chain,
- control SCADA con aprobación humana,
- agente de arbitraje.

Los precios OMIE y ESIOS son reales. Hay 8 páginas en el frontend y más de 30 rutas en `api/routes/energy.js`.

**En producción no hay ningún equipo conectado**, y por eso:
- `GET /telemetry` responde con `buildTelemetry()` (`Math.random()`), marcado `simulated: true`, y el panel lo pinta como si fuera de una planta.
- OMIE y ESIOS tienen también un respaldo aleatorio si falla el feed.
- `GET /nodes` mezcla los nodos reales del usuario con una lista fija.
- Las direcciones de los contratos de energía son marcadores (`0x…01`, `0x…02`, `0x…03`): `smart-contracts/src/energy/*.sol` está escrito y probado, pero no desplegado en Polygon.
- **Error:** `ENERGY_CONTRACTS.STAKING` usa por defecto `0x3EfC…e3a8`, que es la QualityEscrow/Safe, no un `StakingPoolV2`.
- El documento aún da por pendiente la migración 023; las de producción están al día hasta la 071, así que conviene marcarla como aplicada tras comprobarlo.

### 2.2 Fases

**Fase 0 · que producción no muestre datos inventados (hecha el 2026-10-28)**
- [x] Telemetría de demostración: ya llegaba marcada `simulated: true` y la app la señala con `SourceBadge` y la salida a «conectar planta» (Dashboard, SCADA, Aegis). Se mantiene para que la app sea navegable sin planta.
- [x] OMIE y REE/ESIOS sin respaldo aleatorio: sin feed, 503 (`OMIE_UNAVAILABLE`, `GRID_UNAVAILABLE`), sin cachear el fallo; la app muestra «SIN DATOS».
- [x] `/arbitrage/status` ya no inventa estado de carga ni precio: sin batería, `NO_BATTERY` con SoC y rendimiento `null`.
- [x] `/demand-response`: sin ahorros aleatorios; nodos elegibles = cargas propias; la orden aprobada dice `dispatched: false`.
- [x] `GET /nodes` ya salía de la BD con nodos propios; la demo solo aparece sin ellos y marcada.
- [x] `ENERGY_CONTRACTS` sin direcciones de relleno ni la QualityEscrow como staking: `null` sin variable; auditoría «solo en BD»; Aegis `onchain_audit_coverage: not_deployed`.
- [x] Documento de arquitectura actualizado (§1 y fase 3). Tests: `api/__tests__/routes/energy-no-fake-data.test.js`.
- [ ] Pendiente para la fase 1: guardar «hora del último dato bueno» de OMIE para enseñarla cuando el feed caiga.

**Fase 1 · piloto con un grupo electrógeno real (3-4 semanas)**
- [x] **Decisión de Yoel (2026-10-27):** el piloto se hace sobre el grupo electrógeno más usado en España.
  - No hay estadísticas públicas de cuota por marca.
  - **Himoinsa** (Murcia, grupo Yanmar, más de 100.000 grupos fabricados) es el fabricante de referencia en el mercado español, junto con Genesal.
  - La centralita más extendida entre marcas es la de **Deep Sea Electronics (DSE 73xx/74xx/86xx)**.
  - Equipo objetivo: un grupo diésel de 100-200 kVA con centralita DSE. Si es un Himoinsa con centralita propia CEM7/CEA7, hay que pedir su tabla Modbus a Himoinsa.
- [x] Mapa `edge-gateway/src/mapping/registers.dse-gencomm.json` (protocolo GenComm: potencia trifásica sumada, tensión, corriente, frecuencia, rpm, temperatura, combustible, presión de aceite y batería) con test de decodificación. Es una **plantilla**: confirmar las direcciones con la tabla oficial de DSE para el modelo y el firmware del piloto.
- [ ] Conseguir el grupo: cliente piloto (nave, obra o centro con grupo de respaldo en el Campo de Gibraltar) o alquiler de un grupo DSE. Conexión por RS-485 con pasarela a Modbus TCP, o con el módulo DSE855 o DSE890.
- [ ] Emplazamiento: el edge gateway (BOM de §5 del documento de arquitectura) en el cuadro del grupo, con 4G si no hay red.
- [ ] **Broker MQTT en producción.** Cloud Run solo sirve HTTP/gRPC, así que el broker necesita una VM de Compute Engine, un servicio gestionado (HiveMQ Cloud o EMQX Cloud) o MQTT sobre WebSockets. Decidir esto antes de tocar hardware.
- [ ] Instalar `edge-gateway/` con el BOM de referencia (§5 del documento de arquitectura), dar de alta la planta desde la pantalla SCADA y registrar la clave de firma del edge.
- [ ] Una semana de telemetría real firmada, sin control: solo lectura, con alertas.

**Fase 2 · contratos en cadena (2-3 semanas)**
- [ ] Desplegar `EnergyOracle` y `BeZhasVPP` en Amoy y probar el anclaje por lotes con la telemetría del piloto.
- [ ] Auditoría y despliegue en Polygon (requiere confirmación). Actualizar `deployments/137.json`, el sync-daemon, CLAUDE.md y las variables `CONTRACT_*` de la API.

**Fase 3 · control y arbitraje con el piloto (2-3 semanas)**
- [ ] Activar el control SCADA con aprobación humana sobre el equipo real, empezando por consignas inocuas como la potencia reactiva y con límites duros en el edge.
- [ ] Agente de arbitraje en modo **recomendación**: decide y lo registra, pero un operador aprueba. Comparar su resultado con el real durante un mes.

**Fase 4 · producto comercial (sujeta a decisiones legales)**
- [ ] **CAE:** los Certificados de Ahorro Energético los emite el sistema del MITECO a través de un verificador acreditado. `EnergyCAEToken` solo puede representar CAE ya emitidos, nunca crearlos.
- [ ] **Mercado P2P:** vender energía entre terceros exige ser comercializadora o actuar mediante una. Validarlo antes de abrir `P2PEnergyMarket`.
- [ ] **Arbitraje con dinero real:** operar en OMIE requiere ser agente de mercado o tener un representante. El agente decide; la orden la ejecuta el representante.

**KPIs:** plantas conectadas, horas de telemetría firmada, desviaciones detectadas, € ahorrados o ganados por el agente frente a la estrategia base.

---

## 3. Gas Tank Manager (`gas.bezhas.com`, pendiente)

### 3.1 Estado actual

El plan completo está en `docs/developer/GAS_TANK_PLAN_DESARROLLO.md`, en la rama `release/2026-10-24` (no en esta). Partió de ≈25-30 % el 24/10 y desde entonces, en esa rama, ya están hechos:
- ledger con reserva, liquidación e idempotencia;
- recarga por Stripe y auto-recarga con tope;
- `treasuryWatch` en lugar del `gasMonitor` que movía fondos;
- contratos `BeZhasVerifyingPaymaster` y `GasTankVault` con 27 + 11 tests contra el EntryPoint v0.8 real;
- adaptador ERC-7677 en `/api/rpc/paymaster`;
- firma por Cloud KMS: clave HSM creada, firmante `0x80b8…5c7C`, que nunca debe recibir fondos;
- panel de políticas con simulador.

En la base de datos de producción **faltan las migraciones 072 y 073**, y en `bezhas-api` falta `GAS_PAYMASTER_KMS_KEY`. El dominio no se puede publicar porque el proyecto tiene la **cuota de certificados al 10/10**. El frontend está en esta rama con `Recharge.jsx` y 4 páginas; Alerts y Members no están hechos.

### 3.2 Lo que queda, por orden

**Fase A · desplegar lo hecho (1 semana)**
- [ ] Fusionar `release/2026-10-24` (o `feat/gas-tank-fase-1`) en `main`.
- [ ] Aplicar las migraciones 072 y 073 (lo hace `deploy/gcp/deploy.sh`) y fijar `GAS_PAYMASTER_KMS_KEY` en `bezhas-api`.
- [~] **Certificados (2026-10-27).** Prueba hecha con `deploy/gcp/03b-certificate-map.sh test` en el proyecto:

  | Opción | Límite medido | SubApps nuevas posibles |
  |---|---|---|
  | Certificados clásicos (uno por dominio) | 10 por proyecto (10/10 en uso) y 15 por proxy, fijo | 0 hoy; 5 como mucho aunque se amplíe la cuota |
  | Clásico compartido (varios dominios) | 100 dominios por certificado | Sí, pero cada alta rehace el certificado y necesita un hueco libre, que no hay |
  | **Comodín `*.bezhas.com` en Certificate Manager** | 1.000 certificados, 100 mapas, 5.000 entradas | **Ilimitadas**, sin tocar certificados |

  **Elegido: el comodín.** Ya está activada la API de Certificate Manager. El script `03b-certificate-map.sh` hace el resto en pasos:
  1. `prepare`: autorización DNS, certificado y mapa, sin tocar el proxy.
  2. `dns`: escribe el CNAME `_acme-challenge` en Hostinger.
  3. `attach`: engancha el mapa solo si el comodín está ACTIVE.
  4. `cleanup`: libera los 10 certificados clásicos.

  `03-load-balancer.sh` respeta el mapa cuando está enganchado. **Pendiente:** ejecutar los pasos. La creación de recursos desde esta sesión quedó bloqueada por permisos y el paso `dns` necesita el token de Hostinger.
- [ ] Añadir `gas` a `SUBAPPS` en `deploy/gcp/config.env` y desplegarlo con `deploy-subapps.sh gas`.
- [ ] Revisar en Cloud Logging si `[GasMonitor] Recarga exitosa` llegó a ejecutarse en producción (pendiente desde la fase 0).

**Fase B · cerrar la fase 1 del plan (1-2 semanas)**
- [ ] Rutas `/gateway/v1/gas/{balance,activity,estimate,recharge/checkout}` con el scope `gas`.
- [ ] Modo relayer a través del `tx-signer` para los anclajes de CargoLink y PureScan, con el coste real cargado al tanque.
- [ ] Pantallas Alerts y Members.

**Fase C · patrocinio on-chain (2-4 semanas, con bloqueos externos)**
- [ ] Despliegue en **Amoy**. El último commit de esta rama ya deja un RPC de Amoy que funciona; falta una clave de pruebas con POL. Antes, actualizar en CLAUDE.md que la testnet de Polygon es Amoy (80002), no Mumbai.
- [ ] Intención `paymaster.sign` en el `tx-signer` con topes propios.
- [ ] Tokenización RWA en un clic desde el Hub y transferencias patrocinadas en BEZ Wallet.
- [ ] **Bloqueos para mainnet:** revisión legal MiCA del modelo de créditos, auditoría externa de los contratos y un multisig con umbral ≥ 2 como administrador (el Safe actual es 1 de 3).

**Fases D-F:** las fases 3 a 5 del plan original (apertura a terceros, paymaster en BEZ y session keys, L2 propia), sin cambios.

**KPIs:** los definidos en §7 del plan original.

---

## 4. BZ Genesis · Salud tokenizada (pendiente)

> **Decisión de Yoel (2026-10-27):** alcance máximo en salud tokenizada.
> Esta sección recoge todo lo que se puede construir y también lo que **no** se debe construir, porque la regulación sanitaria es la que marca el límite.

### 4.1 Estado actual (verificado)

El código es mínimo: `src/App.jsx` (333 líneas, una pantalla con pestañas) y `src/lib/bezhas-sdk.js`, un SDK **simulado**:
- Los CID de IPFS se inventan con `Math.random()`.
- Los hashes de transacción son aleatorios.
- La cadena de frío oscila con `Math.random()`.
- El «broker» devuelve una oferta escrita a mano.
- Llama a `POST /api/v1/agents/chat`, **que no existe en `api/`**.
- No hay backend.

Hay tres problemas que hay que quitar antes de nada:
1. **Datos de salud en claro:** envía el texto clínico del paciente sin autenticación a un LLM para «desidentificarlo». Los datos de salud son categoría especial (art. 9 RGPD).
2. **Datos de salud en IPFS:** es inmutable y público por diseño, incompatible con el derecho de supresión.
3. **Token «BZ-BIO» a cambio de USDC:** sería otra oferta de criptoactivos sujeta a MiCA.

### 4.2 Principios (no negociables)

- **Nada de datos de salud en cadena ni en IPFS.** En cadena solo van hashes, estados de consentimiento, permisos de acceso y registros de auditoría. Los datos van cifrados en almacenamiento de la UE y se pueden borrar.
- **El paciente controla sus claves.** Usa la wallet de BeZhas como llave y nadie lee sus datos sin un permiso que pueda revocar.
- **Formato estándar:** HL7 FHIR R4 para datos clínicos e identidad europea (EUDI Wallet, eIDAS 2) para credenciales.
- **La IA no diagnostica.** Una IA que interpreta datos clínicos para decidir es un producto sanitario (MDR, clase IIa o superior) y necesita marcado CE. Genesis solo usa IA administrativa: resúmenes, informes de desviación y citas.
- **Sin tokens especulativos.** Los pagos van en € o BEZ. Los tokens de Genesis son no transferibles (consentimientos, credenciales) o representan activos reales a través de la RWAFactory.

### 4.3 Mapa de módulos

| # | Módulo | Qué hace | Reutiliza | Riesgo regulatorio | Fase |
|---|---|---|---|---|---|
| 1 | **Cadena de frío farmacéutica** | Lotes de medicamentos y vacunas con sensores (2-8 °C, -20 °C, -70 °C), excursiones e informes de Buenas Prácticas de Distribución (GDP) | IoT de CargoLink (migración 032, `TelemetryAnchor`) | Bajo | G1 |
| 2 | **Notarización de ensayos clínicos** | El hash del documento (protocolo, CRF, informe) se calcula en el navegador y se ancla. Da un certificado verificable de integridad (ALCOA+) | Anclaje de PureScan y CargoLink | Medio (validación GxP si se usa para fines regulatorios) | G1 |
| 3 | **Trazabilidad de muestras de biobanco** | Cadena de custodia de muestras con identificadores seudónimos y temperatura | Módulo 1 + 2 | Medio (Ley 14/2007 de investigación biomédica) | G1 |
| 4 | **Credenciales de profesionales sanitarios** | Títulos, colegiación y formación como credenciales verificables W3C, revocables y compatibles con la EUDI Wallet | Identidad del Gateway, `credentialIssuance` | Bajo-medio (los colegios deben ser los emisores) | G2 |
| 5 | **Activos sanitarios tokenizados (RWA)** | Equipos médicos (TAC, resonancias) en leasing, clínicas y residencias: financiación fraccionada | RWAFactory `0xa7e6…0d9A` y Gas Tank | Medio-alto (MiFID/folleto si dan rentabilidad: hacerlo con plataforma autorizada o dentro de exenciones) | G2 |
| 6 | **Consentimiento dinámico tokenizado** | Cada consentimiento es un token no transferible (SBT) del paciente, revocable con un clic. El investigador ve el estado en cadena, nunca los datos | Wallet, firma, `contracts-abi` | Medio (consentimiento explícito, art. 9.2.a RGPD) | G3 |
| 7 | **Bóveda clínica del paciente** | Historia clínica en FHIR, cifrada en la UE, con la clave en manos del paciente. Permisos de lectura temporales para médicos y clínicas, con registro de cada acceso | Módulo 6, `_shared/bezhas-pqc.js` | **Alto** (evaluación de impacto obligatoria, ENS si hay sector público, alineación con el Espacio Europeo de Datos Sanitarios) | G3 |
| 8 | **Mercado de datos para investigación (compute-to-data)** | El investigador paga por ejecutar consultas aprobadas sobre datos consentidos. Los datos nunca salen; solo salen resultados agregados. El paciente recibe parte del pago | Módulos 6-7, OPERANT | **Alto** (EHDS de uso secundario, que se aplica por fases entre 2027 y 2031; evitar que el pago parezca compra de consentimiento) | G4 |
| 9 | **Programas de adherencia y bienestar** | Recompensas en BEZ por objetivos (adherencia a tratamiento, actividad) pagadas por empresas o aseguradoras | Wallet, Pay | Medio (no condicionar nunca la asistencia; las recompensas no compran datos) | G4 |
| 10 | **Financiación de I+D (DeSci)** | Proyectos de investigación con NFT de propiedad intelectual y donaciones o micromecenazgo | RWAFactory | Alto si da derechos económicos (Reglamento europeo de crowdfunding o MiFID): hacerlo con un socio autorizado | G5 |
| 11 | **Seguros y reembolsos paramétricos** | Pago automático de pólizas con pruebas verificables (alta hospitalaria firmada, evento de cadena de frío) | Oráculos, Pay | Alto (requiere aseguradora autorizada por la DGSFP como socia) | G5 |
| 12 | **Asistente IA administrativo** | Resúmenes de documentos de ensayo, informes de desviación y CAPA, gestión de citas. Solo con datos sin identificar o con permiso del paciente | Chat de la plataforma, OPERANT, Ollama local | Medio (sin diagnóstico; ver principios) | G1 → G3 |

**Fuera de alcance:** guardar o vender datos de salud identificables; IA de diagnóstico sin marcado CE; el token BZ-BIO; sustituir la verificación de medicamentos del sistema europeo (SEVeM en España), que solo se puede complementar.

### 4.4 Fases

**G0 · limpieza y base legal (2 semanas)**
- [ ] Retirar `lib/bezhas-sdk.js`, el envío de texto clínico y el broker de BZ-BIO. Poner el `BezhasAuthProvider` compartido y estados vacíos «Beta privada».
- [ ] Crear `api/routes/genesis.js` en el Gateway con scope `health` y tabla de organizaciones sanitarias (hospital, CRO, distribuidor, biobanco, aseguradora).
- [ ] Nombrar delegado de protección de datos, encargar la evaluación de impacto marco y contratar asesoría en derecho sanitario.

**G1 · módulos B2B sin datos de pacientes (6-7 semanas)**
- [ ] Módulo 1: perfiles de temperatura por producto, excursiones con informe automático, anclaje por lote y página pública de verificación por número de lote.
- [ ] Módulo 2: notarización con hash en el navegador, certificado con sello de tiempo y verificación pública.
- [ ] Módulo 3: cadena de custodia de muestras sobre los módulos 1 y 2.
- [ ] Módulo 12, versión mínima: informes de desviación a partir del módulo 1.

**G2 · credenciales y activos sanitarios (4-5 semanas)**
- [ ] Módulo 4: emisión y verificación de credenciales W3C. Buscar un colegio profesional piloto como emisor (por ejemplo, un colegio de médicos o de farmacéuticos de Andalucía).
- [ ] Módulo 5: plantilla de tokenización de equipos médicos en leasing sobre la RWAFactory, patrocinada por el Gas Tank, con revisión legal de cada oferta.

**G3 · paciente (8-10 semanas, con la evaluación de impacto aprobada)**
- [ ] Módulo 6: contrato `HealthConsentSBT` (no transferible, revocable, sin datos personales) con tests de Foundry; auditoría antes de Polygon.
- [ ] Módulo 7: bóveda FHIR cifrada en una región de la UE con borrado real, cifrado poscuántico opcional (`bezhas-pqc.js`), permisos temporales y registro de accesos anclado.
- [ ] Piloto con una clínica privada (Campo de Gibraltar o Cádiz) y 50-100 pacientes voluntarios.

**G4 · investigación y programas (8 semanas, tras la respuesta legal)**
- [ ] Módulo 8: entorno compute-to-data (consultas aprobadas, salida solo agregada, umbral mínimo de cohortes), pago al paciente desde el pago del investigador.
- [ ] Módulo 9: programas de adherencia patrocinados por empresas.

**G5 · socios regulados (según acuerdos)**
- [ ] Módulo 10 con una plataforma de crowdfunding autorizada; módulo 11 con una aseguradora.

Calendario orientativo: G0-G2 en unos 3 meses (ingresos B2B sin datos de pacientes); G3-G5 entre 6 y 9 meses más, al ritmo de los permisos.

**KPIs:** lotes y excursiones (G1), documentos notarizados, credenciales emitidas, € financiados en activos sanitarios, pacientes con bóveda activa, consentimientos activos y revocados, consultas de investigación ejecutadas.

---

## 5. Transversal

- **Certificados:** el límite de 10 bloquea Gas y Genesis. La solución elegida es el comodín `*.bezhas.com` de Certificate Manager (ver §3.2, fase A, y `deploy/gcp/03b-certificate-map.sh`). Una vez enganchado, una SubApp nueva solo necesita su línea en `SUBAPPS` y su registro DNS.
- **Redespliegue de SubApps:** desde el 24/10 las SubApps siguen en su imagen anterior a la espera de aprobación. Los cambios de la fase 0 de Pay y Energy necesitan ese redespliegue.
- **Tests:** Pay, Gas Tank (frontend) y Genesis no tienen ninguno; Energy tiene uno en el frontend (el backend sí tiene suites). Objetivo mínimo: Vitest para la lógica de cada app y un test de integración contra la API local con `scripts/dev/test-profile.sh`.
- **Contratos:** cualquier despliegue nuevo (Energy, Gas Tank) sigue el checklist de CLAUDE.md: `deployments/<chainId>.json`, sync-daemon y tabla de contratos. No sobrescribir direcciones sin confirmación.

## 6. Decisiones

**Tomadas el 2026-10-27:**
- Pay: pedidos SEPA en EUR (hecho).
- KYC: Didit recomendado, pendiente de confirmar.
- Energy: piloto en un grupo electrógeno con centralita DSE.
- Certificados: comodín de Certificate Manager.
- Genesis: salud tokenizada con el alcance máximo.

**Abiertas:**
1. **Pay:** confirmar el proveedor de KYC (Didit o Sumsub) y si se abren la venta y el envío de BEZ antes de la respuesta legal sobre MiCA.
2. **Energy:** cliente o alquiler del grupo piloto, y dónde vive el broker MQTT (VM o servicio gestionado).
3. **Gas Tank:** cuándo se fusiona `release/2026-10-24` en `main`.
4. **Genesis:** clínica y colegio profesional piloto, y asesoría en derecho sanitario.
