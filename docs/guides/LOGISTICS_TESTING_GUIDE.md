# 🧪 Script de Prueba - Sistema de Logística

## Test Manual del Endpoint

### 1. Verificar que los servidores estén corriendo

**Backend:**
```powershell
Test-NetConnection -ComputerName localhost -Port 3001
```

**Frontend:**
```powershell
Test-NetConnection -ComputerName localhost -Port 5173
```

---

### 2. Test de GET - Obtener Envíos Actuales

```powershell
# PowerShell
Invoke-RestMethod -Uri "http://localhost:3001/api/logistics/shipments" -Method GET | ConvertTo-Json -Depth 10
```

**Salida Esperada:**
```json
[
  {
    "id": 1,
    "origin": "Puerto de Valencia, ES",
    "destination": "Madrid Centro, ES",
    "status": "IN_TRANSIT",
    "cargoType": "Electrónica",
    "payout": "150"
  },
  {
    "id": 2,
    "origin": "Barcelona, ES",
    "destination": "Lyon, FR",
    "status": "PENDING",
    "cargoType": "Farmacéuticos",
    "payout": "450"
  }
]
```

---

### 3. Test de POST - Crear Nuevo Envío

#### **A. Envío Público**

```powershell
$body = @{
    origin = "Madrid, ES"
    destination = "Berlín, DE"
    cargoType = "Electrónica"
    weight = "500kg"
    payout = 150
    visibility = "public"
    accessFee = 0
    shipper = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/api/logistics/create" -Method POST -Body $body -ContentType "application/json" | ConvertTo-Json -Depth 10
```

**Salida Esperada:**
```json
{
  "id": 3,
  "origin": "Madrid, ES",
  "destination": "Berlín, DE",
  "cargoType": "Electrónica",
  "weight": "500kg",
  "payout": 150,
  "status": "PENDING",
  "carrier": null,
  "recipient": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "visibility": "public",
  "accessFee": 0,
  "history": [...]
}
```

---

#### **B. Envío con Acceso Restringido (Members Only)**

```powershell
$body = @{
    origin = "París, FR"
    destination = "Amsterdam, NL"
    cargoType = "Farmacéuticos"
    weight = "300kg"
    payout = 250
    visibility = "members"
    accessFee = 50
    shipper = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
    minTemp = 2
    maxTemp = 8
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/api/logistics/create" -Method POST -Body $body -ContentType "application/json" | ConvertTo-Json -Depth 10
```

**Salida Esperada:**
```json
{
  "id": 4,
  "origin": "París, FR",
  "destination": "Amsterdam, NL",
  "cargoType": "Farmacéuticos",
  "weight": "300kg",
  "payout": 250,
  "status": "PENDING",
  "carrier": null,
  "recipient": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "visibility": "members",
  "accessFee": 50,
  "minTemp": 2,
  "maxTemp": 8,
  "history": [...]
}
```

---

#### **C. Envío Privado (Draft Mode)**

```powershell
$body = @{
    origin = "Roma, IT"
    destination = "Viena, AT"
    cargoType = "Arte"
    weight = "150kg"
    payout = 400
    visibility = "private"
    accessFee = 0
    shipper = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/api/logistics/create" -Method POST -Body $body -ContentType "application/json" | ConvertTo-Json -Depth 10
```

---

### 4. Test de Validación - Request Inválido

```powershell
# Falta campo requerido: "payout"
$body = @{
    origin = "Madrid, ES"
    destination = "Berlín, DE"
    cargoType = "Electrónica"
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "http://localhost:3001/api/logistics/create" -Method POST -Body $body -ContentType "application/json"
} catch {
    Write-Host "❌ Error esperado: $($_.Exception.Message)"
}
```

**Salida Esperada:**
```json
{
  "error": "Campos requeridos: origin, destination, cargoType, payout"
}
```

---

### 5. Test de Aceptación de Trabajo

```powershell
$body = @{
    carrier = "0xCarrierAddress123456789"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/api/logistics/accept/3" -Method POST -Body $body -ContentType "application/json" | ConvertTo-Json -Depth 10
```

**Salida Esperada:**
```json
{
  "id": 3,
  "status": "IN_TRANSIT",
  "carrier": "0xCarrierAddress123456789",
  "history": [
    {
      "status": "Created",
      "timestamp": 1704123456789,
      "location": "Madrid, ES"
    },
    {
      "status": "Picked Up",
      "timestamp": 1704123500000,
      "location": "Madrid, ES"
    }
  ]
}
```

---

### 6. Test de Entrega

```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/logistics/deliver/3" -Method POST | ConvertTo-Json -Depth 10
```

**Salida Esperada:**
```json
{
  "id": 3,
  "status": "DELIVERED",
  "history": [
    {
      "status": "Created",
      "timestamp": 1704123456789,
      "location": "Madrid, ES"
    },
    {
      "status": "Picked Up",
      "timestamp": 1704123500000,
      "location": "Madrid, ES"
    },
    {
      "status": "Delivered",
      "timestamp": 1704123600000,
      "location": "Berlín, DE"
    }
  ]
}
```

---

## 🧪 Test de Integración Frontend

### 1. Navega a `/create`
```
http://localhost:5173/create
```

### 2. Selecciona "Logística"
- Haz clic en el botón con el icono de camión 🚚

### 3. Observa la Vista Previa
- Columna derecha debe mostrar envíos activos
- Si hay envíos, verás hasta 3 cards
- Si no hay, verás "Cargando red logística..."

### 4. Completa el Formulario
- **Origen**: Madrid, ES
- **Destino**: Berlín, DE
- **Tipo de Carga**: Electrónica
- **Peso**: 500kg
- **Pago**: 150

### 5. Configura Privacidad
- Selecciona "Solo Miembros" 👥
- Configura "Tarifa de Acceso": 50 BEZ

### 6. Envía el Formulario
- Haz clic en "Crear Contrato de Envío"
- **Verificaciones**:
  - ✅ No recarga la página
  - ✅ Aparece indicador de carga
  - ✅ Vista previa se actualiza con el nuevo envío
  - ✅ Mensaje de éxito aparece
  - ✅ Redirect a `/logistics`

---

## 🔍 Verificación de Logs

### Backend Console
```
✅ Nuevo envío creado (ID: 3) con privacidad: members
```

### Frontend Console (DevTools)
```javascript
// Antes de enviar
Creando envío en Blockchain (Simulado via Backend): {
  origin: "Madrid, ES",
  destination: "Berlín, DE",
  ...
}

// Después de crear
Envío creado exitosamente: { id: 3, ... }
```

---

## 📊 Checklist de Validaciones

### ✅ Backend
- [ ] Puerto 3001 abierto
- [ ] GET `/api/logistics/shipments` retorna array
- [ ] POST `/api/logistics/create` crea envío con ID incremental
- [ ] Validación de campos requeridos funciona
- [ ] Campos de privacidad se guardan correctamente
- [ ] Console log muestra confirmación

### ✅ Frontend
- [ ] Puerto 5173 abierto
- [ ] Página `/create` carga sin errores
- [ ] LogisticsPreview muestra datos correctos
- [ ] Formulario envía sin recargar página
- [ ] Estados de loading/error funcionan
- [ ] Privacidad se integra correctamente
- [ ] Redirect post-creación funciona

### ✅ Integración Full-Stack
- [ ] Hook `useLogisticsContract` conecta con backend
- [ ] Axios usa baseURL correcta
- [ ] Polling cada 5s actualiza shipments
- [ ] Payload completo se envía al backend
- [ ] Response del backend se procesa correctamente

---

## 🛠️ Troubleshooting

### Error: "ECONNREFUSED ::1:3001"
**Solución**: El backend no está corriendo
```powershell
cd backend
npm start
```

### Error: "Cannot read property 'map' of undefined"
**Solución**: `shipments` no está inicializado
- Verifica que `useLogisticsContract` retorna `shipments`
- Check consola de backend para errores

### Error: "Network Error" en createShipment
**Solución**: CORS o backend caído
```javascript
// backend/server.js
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));
```

### Formulario recarga la página
**Solución**: Falta `e.preventDefault()`
```jsx
const handleSubmit = async (e) => {
    e.preventDefault(); // ⬅️ CRÍTICO
    // ...
};
```

---

## 📦 Estructura de Datos Final

### shipmentsDB (Backend)
```javascript
[
  {
    id: 1,
    origin: "Puerto de Valencia, ES",
    destination: "Madrid Centro, ES",
    status: "IN_TRANSIT",
    cargoType: "Electrónica",
    weight: "500kg",
    payout: 150,
    visibility: "public",
    accessFee: 0,
    carrier: "0xCarrier...",
    recipient: "0x123...",
    temperature: 4.2,
    minTemp: 0,
    maxTemp: 8,
    history: [...]
  },
  // ... más envíos
]
```

### shipments (Frontend)
```javascript
// Hook useLogisticsContract retorna:
{
  shipments: [...], // Array de envíos
  loading: false,
  createShipment: async (data) => {...},
  acceptJob: async (id) => {...},
  signDelivery: async (id) => {...}
}
```

---

**Fecha**: 2024  
**Estado**: ✅ Tests Pasando  
**Compatibilidad**: PowerShell 5.1+, Node.js 18+, Chrome/Edge/Firefox
