# Plan de Desarrollo e Implementación de Automatizaciones BeZhas

## Índice
- [1. Logística (Puertos, Aduanas, Rutas)](#logistica)
- [2. Inmobiliarias](#inmobiliarias)
- [3. Recursos Humanos](#recursos-humanos)
- [4. Medicina y Biología](#medicina-biologia)
- [5. Gestoría y Seguridad](#gestoria-seguridad)
- [6. Fiscalidad](#fiscalidad)
- [7. Instalación en Plataforma de Clientes](#instalacion-clientes)
- [8. Funcionamiento y Seguridad de la Blockchain BeZhas](#blockchain)
- [9. Comparativa de Personal Suplido](#comparativa-personal)

---


## <a name="logistica"></a>1. Logística (Puertos, Aduanas, Optimización de Rutas)

### Automatizaciones Disponibles
- **Trazabilidad de mercancías:** Registro y consulta on-chain de cada envío.
- **Certificación digital:** Emisión y validación de certificados de origen/calidad.
- **Integración IoT:** Sensores conectados a blockchain para trazabilidad en tiempo real.
- **Recompensas a operadores:** Incentivos automáticos a nodos logísticos.
- **Pagos automáticos:** SmartWallets/MultiSig para pagos entre agentes.
- **Aduanas y clearance:** Solicitud, validación y emisión de clearance aduanero vía oráculos y NFT.
- **Certificados NFT de clearance:** Prueba digital de despacho aduanero.
- **Consulta de tarifas y aranceles:** Cálculo automático de aranceles y gestión de plataformas aduaneras.
- **Registro y consulta de checkpoints:** Seguimiento granular de envíos y eventos IoT.

### Por Desarrollar
- Algoritmos de optimización de rutas integrados.
- Automatización avanzada de inspecciones aduaneras vía IA y oráculos.
- Dashboards de monitoreo en tiempo real y alertas automáticas.

### Estructura Técnica
- Contratos: `SupplyTracker`, `TrackingToCustomsGateway`, `CustomsClearanceOracle`, `ClearanceCertificateNFT`, `SupplierScoreOracle`, `WarehouseManager`, `ProcurementNFT`.
- Backend API: Endpoints `/v1/supply/customs/clear`, `/v1/supply/shipments`, `/v1/supply/checkpoints`, `/v1/supply/certificates`, `/v1/supply/tariffs`.
- SDK: SupplyChainModule con métodos para clearance, certificados, tarifas, tracking y checkpoints.
- Frontend: Paneles de control, dashboards y agentes AI para monitoreo y automatización.

### Especificación de Integración SDK/API (Aduanas y Oráculos)

**SupplyChainModule (SDK):**

- `async clearCustoms(customsData)`
  - Solicita clearance aduanero para un envío (integra CustomsClearanceOracle y TrackingToCustomsGateway).
  - Params: `{ shipmentId, hsCode, value, documents }`
  - Endpoint: `/v1/supply/customs/clear`

- `async getClearanceDetails(shipmentId)`
  - Consulta el estado y detalles del clearance aduanero.
  - Endpoint: `/v1/supply/customs/clearance/{shipmentId}`

- `async getTariffInfo(hsCode)`
  - Consulta tarifas y requisitos para un código HS.
  - Endpoint: `/v1/supply/tariffs/{hsCode}`

- `async issueClearanceCertificate(shipmentId)`
  - Emite NFT de clearance si el despacho es aprobado.
  - Endpoint: `/v1/supply/certificates/issue`

- `async getCertificate(tokenId)`
  - Consulta metadatos y validez de un certificado NFT de clearance.
  - Endpoint: `/v1/supply/certificates/{tokenId}`

- `async addCheckpoint(shipmentId, checkpointData)`
  - Registra un nuevo checkpoint IoT o de proceso en el envío.
  - Endpoint: `/v1/supply/checkpoints/add`

- `async getShipmentCheckpoints(shipmentId)`
  - Consulta todos los checkpoints registrados para un envío.
  - Endpoint: `/v1/supply/checkpoints/{shipmentId}`

**Notas de Seguridad:**
- Todos los endpoints requieren autenticación y roles (operador, aduana, auditor).
- Los pagos de aranceles e integración se realizan en BEZCoin y se distribuyen entre tesorería y plataformas.
- Los certificados NFT son intransferibles salvo autorización explícita.

### Implementación
1. Despliegue de contratos en la blockchain BeZhas.
2. Exposición de endpoints API RESTful para clearance, certificados, checkpoints y tarifas.
3. Extensión del SDK SupplyChainModule con métodos para cada función.
4. Integración de paneles y agentes AI para monitoreo y automatización.
5. Capacitación de usuarios y documentación técnica.

---

## <a name="inmobiliarias"></a>2. Inmobiliarias

### Automatizaciones Disponibles
- **Registro y transferencia de propiedad:** NFTs para inmuebles.
- **Marketplace de activos:** Compra/venta/alquiler tokenizado.
- **Pagos y depósitos en garantía:** SmartWallets y QualityEscrow.

### Por Desarrollar
- Automatización de contratos de alquiler.
- Integración con registros públicos.

### Estructura Técnica
- Contratos: `BeZhasLogisticsNFT`, `NFTMarketplace`, `QualityEscrow`, `SmartWallet`.
- Backend API: Módulos para gestión de activos y pagos.

### Implementación
1. Tokenización de propiedades.
2. Integración con sistemas inmobiliarios.
3. Capacitación y soporte.

---

## <a name="recursos-humanos"></a>3. Recursos Humanos

### Automatizaciones Disponibles
- **Gestión de pagos y nóminas:** SmartWallets para empleados.
- **Certificación de skills:** Certificados verificables on-chain.
- **Votaciones internas:** Gobernanza digital.

### Por Desarrollar
- Automatización de onboarding/offboarding.
- Integración con sistemas de RRHH externos.

### Estructura Técnica
- Contratos: `SmartWallet`, `CertificationManager`, `GovernanceSystem`.
- Backend API: Módulos para nómina y certificaciones.

### Implementación
1. Creación de wallets para empleados.
2. Integración con sistemas de nómina.
3. Capacitación.

---

## <a name="medicina-biologia"></a>4. Medicina y Biología

### Automatizaciones Disponibles
- **Trazabilidad de muestras/medicamentos:** Registro y seguimiento on-chain.
- **Certificación de laboratorios/resultados:** Certificados digitales.
- **Gestión de consentimientos:** Acceso seguro a datos.

### Por Desarrollar
- Automatización de ensayos clínicos.
- Integración con sistemas hospitalarios.

### Estructura Técnica
- Contratos: `TraceabilityEngine`, `CertificationManager`, `SmartWallet`.
- Backend API: Módulos para gestión de muestras y consentimientos.

### Implementación
1. Integración con laboratorios y hospitales.
2. Capacitación de personal.

---

## <a name="gestoria-seguridad"></a>5. Gestoría y Seguridad

### Automatizaciones Disponibles
- **Gestión de poderes/autorizaciones:** MultiSigWallet y roles.
- **Auditoría y trazabilidad:** Logging on-chain.
- **Pagos/cobros automáticos:** SmartWallets.

### Por Desarrollar
- Flujos automáticos de compliance.
- Integración con firma electrónica.

### Estructura Técnica
- Contratos: `MultiSigWallet`, `SmartWallet`, `QualityEscrow`.
- Backend API: Módulos para gestión de poderes y auditoría.

### Implementación
1. Configuración de wallets multi-firma.
2. Integración con sistemas de gestión documental.

---

## <a name="fiscalidad"></a>6. Fiscalidad

### Automatizaciones Disponibles
- **Registro y trazabilidad de transacciones:** Todo movimiento queda registrado on-chain.
- **Pagos automáticos de impuestos:** SmartWallets programables.
- **Auditoría y reporting:** Extracción de datos para informes fiscales.

### Por Desarrollar
- Automatización de cálculo y retención de impuestos.
- Integración con autoridades fiscales.

### Estructura Técnica
- Contratos: `SmartWallet`, `QualityEscrow`, `GovernanceSystem`.
- Backend API: Módulos para reporting y cálculo fiscal.

### Implementación
1. Integración con sistemas contables.
2. Capacitación de personal fiscal.

---

## <a name="instalacion-clientes"></a>7. Instalación en Plataforma de Clientes

1. **Requisitos:** Docker, Node.js, acceso a la red BeZhas.
2. **Despliegue:**
   - Clonar repositorio y configurar variables de entorno.
   - Ejecutar `docker compose up -d` para levantar servicios.
   - Desplegar contratos vía scripts Foundry.
   - Configurar integración con sistemas internos (APIs, IoT, ERPs).
3. **Soporte:** Capacitación, documentación y soporte remoto.

---

## <a name="blockchain"></a>8. Funcionamiento y Seguridad de la Blockchain BeZhas

- **Tecnología:** OP Stack (Optimistic Rollup), token nativo BEZ.
- **Seguridad:**
  - Control de acceso por roles (AccessControl).
  - Pausa global y circuit breakers.
  - Recovery social y multi-firma.
  - Trazabilidad y auditoría on-chain.
  - No-custodial: el usuario controla sus claves.

- **Estado de desarrollo (SDK/Onboarding/Validación testnet):**
  - SDK: se agregó `ValidatorClient` en `sdk/modules/ValidatorClient.js` para interactuar con `ValidatorRegistry` y `EdgeNodeRewards` (on-chain, requiere `signer`). También permite `addressesOverride` por si `deployments/<chainId>.json` aún no incluye esos contratos.
  - Onboarding operativo: se agregaron scripts CLI `scripts/register-validator.js` y `scripts/validator-status.js` para registrar/heartbeat/consultar estado, con flags `--bezAddress/--validatorRegistryAddress/--edgeNodeRewardsAddress`.
  - Onboarding UI: se agregó una página mínima `control-center/frontend/app/onboarding/page.tsx` (wizard) para mostrar tiers/direcciones y generar el comando CLI a ejecutar.
  - Pipeline de direcciones: `smart-contracts/script/parse-deployment.js` se actualizó para incluir `ValidatorRegistry`, `EdgeNodeRewards`, `SequencerRotation` y `SlashingManager` en `deployments/<chainId>.json`.
  - Para regenerar direcciones sin depender de overrides: se añadió `scripts/redeploy-local-validation.js` (Anvil) y `scripts/deploy-testnet-validation.js` (testnet) para correr DeployAll, parsear deployments y opcionalmente sembrar la DB.
- **Funciones posibles:**
  - Pagos instantáneos y programables.
  - Certificación digital y trazabilidad.
  - Gobernanza y votaciones.
  - Integración IoT y automatización de procesos.
  - Marketplace de activos y servicios.

---

## <a name="comparativa-personal"></a>9. Comparativa de Personal Suplido

| Sector         | Tareas Automatizadas                        | Personal Suplido (aprox.) |
|----------------|---------------------------------------------|---------------------------|
| Logística      | Registro, pagos, certificación, monitoreo   | 30-50% (operadores, admin)|
| Inmobiliarias  | Registro, pagos, contratos, marketplace     | 40% (gestores, admin)     |
| RRHH           | Nómina, certificación, votaciones           | 30% (admin, payroll)      |
| Medicina/Bio   | Trazabilidad, certificación, consentimientos| 25-40% (admin, técnicos)  |
| Gestoría       | Poderes, pagos, auditoría                   | 30% (gestores, admin)     |
| Fiscalidad     | Reporting, pagos, auditoría                 | 30-50% (contables, admin) |

*La integración reduce errores, acelera procesos y permite escalar sin aumentar plantilla.*

---

**¿Deseas un plan detallado para un sector específico o ayuda con la integración técnica?**
