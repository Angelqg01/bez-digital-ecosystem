# Sistema de Tesorería BeZhas - Documentación Completa

## 📋 Tabla de Contenidos

1. [Descripción General](#descripción-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Componentes del Sistema](#componentes-del-sistema)
4. [Configuración](#configuración)
5. [Gestión de Fondos](#gestión-de-fondos)
6. [Seguridad Multi-Firma](#seguridad-multi-firma)
7. [Integración de Pagos](#integración-de-pagos)
8. [Auditoría y Transparencia](#auditoría-y-transparencia)
9. [Guía de Uso](#guía-de-uso)
10. [API Reference](#api-reference)

---

## Descripción General

El **Sistema de Tesorería BeZhas** es una solución integral para la gestión de fondos de la plataforma, que combina tecnología blockchain con sistemas bancarios tradicionales. Permite a los administradores:

- ✅ Configurar wallets de blockchain (Ethereum/Polygon)
- ✅ Configurar cuentas bancarias para conversión fiat
- ✅ Gestionar retiros con sistema multi-firma
- ✅ Monitorear estadísticas financieras en tiempo real
- ✅ Auditar todas las transacciones
- ✅ Integrar procesadores de pago (Stripe, PayPal)

### Flujo de Dinero

```
Usuarios Compran BEZ Tokens
         ↓
    Smart Contract
    (TokenSale.sol)
         ↓
   Treasury Wallet ← [CONFIGURADO AQUÍ]
         ↓
    ┌─────────────┐
    │   Opciones  │
    └─────────────┘
         ↓
    ┌───────┬───────┐
    │       │       │
    v       v       v
Blockchain  Banco  Liquidez
   Hold    Convert   Pool
```

---

## Arquitectura del Sistema

### Stack Tecnológico

**Frontend:**
- React 18.2.0 + Vite
- Ethers.js v6 (blockchain interaction)
- TailwindCSS (UI)
- Lucide Icons
- React Hot Toast (notificaciones)

**Backend:**
- Node.js + Express
- MongoDB + Mongoose
- Axios (HTTP client)
- JWT Authentication

**Blockchain:**
- Solidity 0.8.24
- OpenZeppelin (security)
- Hardhat (deployment)

### Estructura de Archivos

```
bezhas-web3/
├── frontend/
│   └── src/
│       └── components/
│           └── admin/
│               └── TreasuryManagement.jsx (990 líneas)
├── backend/
│   ├── routes/
│   │   └── treasury.routes.js (380 líneas)
│   └── middleware/
│       └── admin.middleware.js
└── docs/
    └── TREASURY_SYSTEM.md (este archivo)
```

---

## Componentes del Sistema

### 1. Frontend: TreasuryManagement.jsx

**Secciones Principales:**

#### 📊 Overview (Resumen)
- **Balance Total ETH**: Fondos actuales en blockchain
- **Total Recibido**: Histórico de ingresos
- **Total Retirado**: Fondos usados
- **Comisiones**: Fees acumulados
- **Gráfico de Distribución**: Planificación de uso de fondos
- **Acciones Rápidas**: Botones para retiros y auditoría

#### ⚙️ Configuration (Configuración)
- **Wallet Configuration**:
  - Dirección Ethereum para recibir fondos
  - Validación de formato (0x...)
  - Link directo a Etherscan

- **Bank Account Configuration**:
  - Nombre de cuenta
  - Número de cuenta (encriptado en DB)
  - Banco
  - País
  - SWIFT/IBAN (internacional)
  - Visibilidad controlada (botón mostrar/ocultar)

- **Security Settings**:
  - Límite diario de retiros (ETH)
  - Número de firmas requeridas (1-5)
  - Toggle para multi-firma obligatoria

#### 💸 Withdrawals (Retiros)
- **Lista de Solicitudes**:
  - Cantidad y moneda (ETH/BEZ/USD)
  - Estado: pending → approved → completed
  - Razón/descripción del retiro
  - Firma de solicitante
  - Conteo de firmas (2/3, etc.)
  - Link a transaction hash (Etherscan)

- **Crear Nueva Solicitud**:
  - Modal con formulario
  - Selección de moneda
  - Tipo de destino (wallet/banco)
  - Dirección de wallet o datos bancarios
  - Razón obligatoria
  - Validación contra límites diarios

#### 📝 Audit Log (Auditoría)
- Registro de todas las acciones
- Timestamp y usuario que ejecutó
- Tipo de acción (config_update, withdrawal_created, etc.)
- Detalles completos

### 2. Backend: treasury.routes.js

**Mongoose Schemas:**

#### TreasuryConfig
```javascript
{
  treasuryWalletAddress: String (validación Ethereum),
  bankAccount: {
    accountName: String,
    accountNumber: String (encriptado),
    bankName: String,
    swiftCode: String,
    iban: String,
    country: String
  },
  paymentProcessors: {
    stripe: { enabled: Boolean, accountId: String },
    paypal: { enabled: Boolean, email: String }
  },
  limits: {
    dailyEthLimit: Number,
    monthlyEthLimit: Number,
    minSignatures: Number (default: 2),
    requireMultiSig: Boolean
  },
  authorizedSigners: [String] (direcciones Ethereum),
  auditLog: [{
    action: String,
    performedBy: String,
    timestamp: Date,
    details: Object
  }]
}
```

#### WithdrawalRequest
```javascript
{
  amount: Number,
  currency: String (ETH/BEZ/USD),
  destination: {
    type: String (wallet/bank),
    address: String
  },
  reason: String,
  requestedBy: String,
  status: String (pending/approved/completed/rejected),
  signatures: [{
    signer: String,
    signedAt: Date,
    txHash: String
  }],
  requiredSignatures: Number,
  executedAt: Date,
  txHash: String,
  createdAt: Date
}
```

**Endpoints API:**

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| GET | `/api/treasury/config` | Obtener configuración actual | Admin JWT |
| PUT | `/api/treasury/config` | Actualizar configuración | Admin JWT |
| GET | `/api/treasury/stats` | Estadísticas blockchain | Admin JWT |
| GET | `/api/treasury/withdrawals` | Lista de retiros paginada | Admin JWT |
| POST | `/api/treasury/withdrawals` | Crear solicitud de retiro | Admin JWT |
| POST | `/api/treasury/withdrawals/:id/sign` | Firmar retiro (multi-sig) | Admin JWT |
| POST | `/api/treasury/withdrawals/:id/execute` | Ejecutar retiro aprobado | Admin JWT |
| GET | `/api/treasury/audit-log` | Registro de auditoría | Admin JWT |

---

## Configuración

### Paso 1: Configurar Wallet de Blockchain

1. Acceder a **AdminDashboard → Tesorería → Configuración**
2. Hacer clic en **"Editar"**
3. Ingresar dirección Ethereum válida (0x...)
4. Ejemplo: `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb`
5. Hacer clic en **"Guardar"**

**Importante:**
- Esta dirección recibirá todos los ETH de las compras de tokens
- Debe ser una wallet que controles (MetaMask, hardware wallet)
- Se recomienda usar wallet multi-sig (Gnosis Safe)

### Paso 2: Configurar Cuenta Bancaria

1. En la misma sección, hacer clic en **"Mostrar"** en "Bank Account Configuration"
2. Completar formulario:
   - **Nombre de Cuenta**: BeZhas S.A.
   - **Número de Cuenta**: 1234567890
   - **Banco**: Banco Nacional
   - **País**: España
   - **SWIFT** (opcional): BSCHESMMXXX
   - **IBAN** (opcional): ES91 2100 0418 4502 0005 1332
3. Hacer clic en **"Guardar"**

**Seguridad:**
- Los números de cuenta se encriptan en la base de datos
- Solo visibles para admins autorizados
- Se registra cada acceso en audit log

### Paso 3: Configurar Seguridad Multi-Firma

1. En **Security Settings**:
   - **Límite Diario**: 10 ETH (ejemplo)
   - **Firmas Requeridas**: 2 (de 3 administradores)
   - Activar: **"Requerir múltiples firmas"**
2. Guardar cambios

**Workflow Multi-Firma:**
```
Admin A crea retiro de 5 ETH
       ↓
Estado: PENDING (requiere 2 firmas)
       ↓
Admin B firma → 1/2 firmas
       ↓
Admin C firma → 2/2 firmas
       ↓
Estado: APPROVED (listo para ejecutar)
       ↓
Cualquier admin ejecuta
       ↓
Estado: COMPLETED (transacción en blockchain)
```

---

## Gestión de Fondos

### Ver Estadísticas en Tiempo Real

**Overview Section muestra:**
- **Balance Total**: Fondos disponibles actualmente
- **Total Recibido**: Suma de todas las compras de tokens
- **Total Retirado**: Fondos extraídos de tesorería
- **Comisiones**: Fees de transacciones (2% typical)

**Valores en Tiempo Real:**
- Se actualizan desde blockchain cada 30 segundos
- Conversión automática ETH → USD (precio actual)
- Gráficos de distribución planificada

### Crear Retiro a Wallet

1. Hacer clic en **"Retirar a Wallet"** (botón cyan)
2. Completar modal:
   - **Cantidad**: 2.5
   - **Moneda**: ETH
   - **Tipo de Destino**: Wallet (Blockchain)
   - **Dirección de Wallet**: 0xabc...def
   - **Razón**: "Pago a proveedor de servicios cloud"
3. Clic en **"Crear Solicitud"**

**Validaciones Automáticas:**
- ✅ Cantidad no excede límite diario
- ✅ Dirección es válida (formato Ethereum)
- ✅ Balance suficiente en tesorería
- ✅ Razón no está vacía

### Crear Retiro a Banco

1. Hacer clic en **"Retirar a Banco"** (botón verde)
2. Completar modal:
   - **Cantidad**: 5000
   - **Moneda**: USD
   - **Tipo de Destino**: Cuenta Bancaria
   - **Razón**: "Pago de nómina equipo BeZhas"
3. Usar cuenta bancaria configurada automáticamente
4. Clic en **"Crear Solicitud"**

**Proceso de Conversión:**
1. Sistema calcula ETH equivalente a USD solicitado
2. Crea orden en exchange (Coinbase/Kraken)
3. Convierte ETH → USD
4. Transfiere USD a cuenta bancaria configurada
5. Actualiza registro con txHash y timestamp

### Aprobar Retiros (Multi-Firma)

**Si eres firmante autorizado:**

1. Ir a **Withdrawals tab**
2. Ver solicitud con estado **"pending"**
3. Hacer clic en botón **"Firmar"** (si estás autorizado)
4. Confirmar transacción en MetaMask
5. Esperar confirmación blockchain
6. Sistema actualiza conteo: **2/3 firmas**

**Cuando se alcanzan firmas requeridas:**
- Estado cambia a **"approved"**
- Aparece botón **"Ejecutar Retiro"**
- Cualquier admin puede ejecutar
- Se envía transacción final desde treasury wallet

### Ejecutar Retiro Aprobado

1. Hacer clic en **"Ejecutar Retiro"**
2. Confirmar en MetaMask
3. Esperar confirmación (15-30 segundos)
4. Sistema actualiza:
   - Estado: **"completed"**
   - txHash: link a Etherscan
   - executedAt: timestamp

---

## Seguridad Multi-Firma

### Configuración de Firmantes

**En TreasuryConfig:**
```javascript
authorizedSigners: [
  "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb", // Admin Principal
  "0x1234567890abcdef1234567890abcdef12345678", // CTO
  "0xabcdefabcdefabcdefabcdefabcdefabcdef"      // CFO
]
```

**Requisitos:**
- Mínimo 2 firmantes
- Máximo 5 firmantes
- Direcciones Ethereum válidas
- Deben tener rol de admin en plataforma

### Niveles de Seguridad

| Cantidad Retiro | Firmas Requeridas | Tiempo Espera |
|-----------------|-------------------|---------------|
| < 1 ETH | 1 firma | Inmediato |
| 1-10 ETH | 2 firmas | 1 hora |
| 10-50 ETH | 3 firmas | 24 horas |
| > 50 ETH | 4 firmas | 48 horas |

**Time-Locks (opcional):**
```javascript
// En smart contract
if (amount > 10 ether) {
  require(block.timestamp > request.createdAt + 1 days);
}
```

---

## Integración de Pagos

### Stripe Integration

**Habilitar en AdminDashboard:**
```javascript
paymentProcessors: {
  stripe: {
    enabled: true,
    accountId: "acct_1234567890ABCDEF",
    secretKey: process.env.STRIPE_SECRET_KEY // En backend
  }
}
```

**Uso:**
- Conversión automática ETH → USD vía Stripe
- Transferencias ACH a cuenta bancaria
- Fees: 2.9% + $0.30 por transacción

### PayPal Integration

**Habilitar en AdminDashboard:**
```javascript
paymentProcessors: {
  paypal: {
    enabled: true,
    email: "treasury@bezhas.com",
    clientId: process.env.PAYPAL_CLIENT_ID
  }
}
```

**Uso:**
- Retiros directos a cuenta PayPal
- Conversión automática crypto → fiat
- Fees: 3.5% internacional

---

## Auditoría y Transparencia

### Audit Log Automático

**Todas estas acciones se registran:**
- ✅ Cambios en configuración de wallet
- ✅ Cambios en cuenta bancaria
- ✅ Creación de retiros
- ✅ Firmas de retiros
- ✅ Ejecución de retiros
- ✅ Cambios en límites de seguridad
- ✅ Adición/remoción de firmantes

**Formato de Registro:**
```javascript
{
  action: "WITHDRAWAL_EXECUTED",
  performedBy: "0x742d35Cc...",
  timestamp: "2024-01-15T14:30:00Z",
  details: {
    withdrawalId: "65a1b2c3d4e5f6...",
    amount: "5 ETH",
    destination: "0xabc...def",
    txHash: "0x123...456"
  }
}
```

### Exportar Registros

1. Ir a **Audit Log tab**
2. Hacer clic en **"Download CSV"**
3. Se descarga archivo con todos los registros
4. Formato compatible con Excel/Google Sheets

### Blockchain Transparency

**Verificación Pública:**
- Todos los retiros visibles en Etherscan
- Link directo desde AdminDashboard
- Cualquier persona puede auditar
- No se puede modificar histórico (inmutabilidad blockchain)

**Ejemplo:**
```
Ver en Etherscan:
https://etherscan.io/address/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

---

## Guía de Uso

### Caso de Uso 1: Configuración Inicial

**Objetivo:** Configurar tesorería por primera vez

**Pasos:**
1. Login como administrador
2. Ir a AdminDashboard → Tesorería
3. Hacer clic en "Configuración"
4. Editar y guardar:
   - Wallet address: Tu wallet Gnosis Safe
   - Bank account: Cuenta corporativa
   - Límites: 10 ETH diario, 50 ETH mensual
   - Firmas requeridas: 2 de 3
5. Activar multi-sig
6. Guardar todo

**Resultado:**
- Sistema listo para recibir fondos
- Retiros protegidos con multi-firma
- Auditoría automática activada

### Caso de Uso 2: Retiro para Pago de Proveedor

**Objetivo:** Pagar 3 ETH a proveedor de infraestructura

**Pasos:**
1. Admin A crea retiro:
   - Cantidad: 3 ETH
   - Destino: Wallet del proveedor
   - Razón: "Pago mensual AWS"
2. Admin B recibe notificación
3. Admin B firma retiro (1/2)
4. Admin C firma retiro (2/2)
5. Estado: APPROVED
6. Admin A ejecuta retiro
7. Fondos transferidos en 30 segundos

**Verificación:**
- Ver txHash en Etherscan
- Confirmar recepción con proveedor
- Registrar en contabilidad

### Caso de Uso 3: Conversión a Fiat

**Objetivo:** Convertir 10 ETH a USD para nómina

**Pasos:**
1. Crear retiro:
   - Cantidad: 10 ETH
   - Destino: Banco
   - Razón: "Pago de nómina enero 2024"
2. Sistema calcula: 10 ETH × $2,000 = $20,000 USD
3. Proceso multi-firma (2/3)
4. Ejecutar retiro
5. Sistema:
   - Transfiere ETH a exchange
   - Vende ETH por USD
   - Deposita USD en banco configurado
6. Tiempo total: 1-3 días hábiles

**Tracking:**
- Ver progreso en Withdrawals tab
- Notificaciones por email
- Confirmación bancaria

---

## API Reference

### GET /api/treasury/config

**Descripción:** Obtener configuración actual de tesorería

**Headers:**
```
Authorization: Bearer {admin_jwt_token}
```

**Response 200:**
```json
{
  "treasuryWalletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "bankAccount": {
    "accountName": "BeZhas S.A.",
    "accountNumber": "****5678",
    "bankName": "Banco Nacional",
    "country": "España"
  },
  "limits": {
    "dailyEthLimit": 10,
    "minSignatures": 2,
    "requireMultiSig": true
  },
  "authorizedSigners": ["0x..."]
}
```

### PUT /api/treasury/config

**Descripción:** Actualizar configuración

**Body:**
```json
{
  "treasuryWalletAddress": "0x...",
  "bankAccount": {
    "accountName": "...",
    "accountNumber": "...",
    "bankName": "...",
    "country": "..."
  },
  "limits": {
    "dailyEthLimit": 10,
    "minSignatures": 2
  }
}
```

**Response 200:**
```json
{
  "message": "Configuración actualizada",
  "config": { ... }
}
```

### POST /api/treasury/withdrawals

**Descripción:** Crear solicitud de retiro

**Body:**
```json
{
  "amount": 5,
  "currency": "ETH",
  "destination": {
    "type": "wallet",
    "address": "0xabc...def"
  },
  "reason": "Pago a proveedor"
}
```

**Response 201:**
```json
{
  "message": "Solicitud creada",
  "withdrawal": {
    "_id": "65a1b2c3...",
    "amount": 5,
    "status": "pending",
    "signatures": [],
    "requiredSignatures": 2
  }
}
```

### POST /api/treasury/withdrawals/:id/sign

**Descripción:** Firmar retiro (multi-sig)

**Body:**
```json
{
  "signature": "0x...",
  "txHash": "0x..."
}
```

**Response 200:**
```json
{
  "message": "Firma agregada",
  "withdrawal": {
    "signatures": [
      { "signer": "0x...", "signedAt": "..." }
    ],
    "status": "approved"
  }
}
```

---

## Mejores Prácticas

### ✅ Seguridad

1. **Usar wallet multi-sig** (Gnosis Safe)
2. **Activar 2FA** en cuentas de admin
3. **Revisar audit log** semanalmente
4. **Límites conservadores** (10 ETH/día máximo)
5. **Mínimo 2 firmas** siempre
6. **Backup de claves** en lugar seguro

### ✅ Operaciones

1. **Documentar cada retiro** con razón clara
2. **Coordinar con equipo** antes de retiros grandes
3. **Verificar direcciones** 3 veces antes de enviar
4. **Monitorear gas fees** (esperar gas bajo)
5. **Confirmar en Etherscan** después de cada tx

### ✅ Compliance

1. **Mantener registros** de todas las transacciones
2. **Exportar audit log** mensualmente
3. **Declarar impuestos** correctamente
4. **Cumplir KYC/AML** en conversiones fiat
5. **Auditoría externa** anual

---

## Troubleshooting

### Problema: "Insufficient balance"

**Causa:** No hay suficiente ETH en treasury wallet

**Solución:**
1. Verificar balance en Etherscan
2. Si realmente falta ETH, esperar más ventas de tokens
3. O transferir ETH manualmente desde otro wallet

### Problema: "Multi-sig not approved"

**Causa:** Faltan firmas para ejecutar retiro

**Solución:**
1. Ver cuántas firmas faltan (ej: 1/2)
2. Contactar a otros admins para firmar
3. Esperar a que firmen
4. Luego ejecutar retiro

### Problema: "Daily limit exceeded"

**Causa:** Retiro excede límite diario configurado

**Solución:**
1. Esperar 24 horas
2. O dividir retiro en 2 días
3. O aumentar límite (requiere multi-sig)

---

## Soporte

**Documentación Adicional:**
- [Smart Contracts Guide](./SMART_CONTRACTS.md)
- [Admin Dashboard Guide](./ADMIN_DASHBOARD.md)
- [Security Best Practices](./SECURITY.md)

**Contacto:**
- Email: dev@bezhas.com
- Discord: BeZhas Dev Server
- GitHub Issues: bezhas/bezhas-web3

---

## Changelog

### v1.0.0 (2024-01-15)
- ✅ Sistema completo de tesorería
- ✅ Multi-firma integrado
- ✅ Configuración wallet + banco
- ✅ Audit log completo
- ✅ API REST completa
- ✅ Integración AdminDashboard
- ✅ Documentación completa

---

**Última actualización:** 2024-01-15
**Versión:** 1.0.0
**Mantenedor:** Equipo BeZhas
