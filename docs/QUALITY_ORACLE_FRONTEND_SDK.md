# Quality Oracle - Frontend SDK Documentation

## 📋 Índice

1. [Descripción General](#descripción-general)
2. [Instalación y Configuración](#instalación-y-configuración)
3. [Hook useQualityEscrow](#hook-usequalityescrow)
4. [Componente QualityEscrowManager](#componente-qualityescrowmanager)
5. [Ejemplos de Uso](#ejemplos-de-uso)
6. [Integración con Admin Panel](#integración-con-admin-panel)

---

## Descripción General

El Frontend SDK del Quality Oracle proporciona una interfaz React completa para interactuar con el sistema de garantía de calidad basado en blockchain. Utiliza **wagmi** y **ethers v6** para firmar transacciones de forma segura desde el lado del cliente.

### Características Principales

✅ **Seguridad Mejorada**: Firma de transacciones client-side (no envía private keys al backend)
✅ **Integración wagmi**: Compatible con WalletConnect, MetaMask, etc.
✅ **TypeScript Ready**: Tipos completos para todos los métodos
✅ **UI Components**: Componente completo para gestión visual
✅ **Real-time Updates**: Actualización automática de servicios
✅ **Event Parsing**: Extracción de datos de eventos blockchain

---

## Instalación y Configuración

### 1. Copiar ABIs

Los ABIs ya fueron copiados a `frontend/src/contracts/`:

```
frontend/src/contracts/
├── BeZhasQualityEscrow.json
└── BezCoin.json
```

### 2. Configurar Variables de Entorno

Edita `frontend/.env`:

```bash
# Quality Oracle Contracts
VITE_QUALITY_ESCROW_ADDRESS=0x... # Address del contrato Quality Escrow
VITE_BEZCOIN_ADDRESS=0x...        # Address del token BEZ

# Polygon Amoy Testnet
VITE_POLYGON_RPC_URL=https://rpc-amoy.polygon.technology
```

### 3. Desplegar Contratos (si aún no lo hiciste)

```bash
# Desde la raíz del proyecto
npx hardhat run scripts/deploy-quality-oracle.js --network amoy

# Copia las addresses resultantes a .env
```

---

## Hook useQualityEscrow

El hook principal para interactuar con el Quality Oracle.

### Importación

```javascript
import { useQualityEscrow } from '../hooks/useQualityEscrow';
```

### Propiedades Retornadas

```typescript
const {
    // Funciones
    createService,      // (clientWallet, amountInBEZ, initialQuality) => Promise<string|null>
    finalizeService,    // (serviceId, finalQuality) => Promise<boolean>
    raiseDispute,       // (serviceId) => Promise<boolean>
    getService,         // (serviceId) => Promise<Service|null>
    loadUserServices,   // () => Promise<void>
    getStats,           // () => Promise<Stats|null>
    
    // Estado
    services,           // Service[] - Lista de servicios del usuario
    loading,            // boolean - Estado de carga
    
    // Info del contrato
    escrowAddress,      // string - Address del contrato
    bezCoinAddress,     // string - Address del token
    isConfigured        // boolean - Si están configuradas las addresses
} = useQualityEscrow();
```

### Tipos de Datos

```typescript
interface Service {
    id: string;
    collateralAmount: string;      // En formato ether (ej: "100.0")
    timestamp: Date;
    businessWallet: string;
    clientWallet: string;
    initialQuality: number;        // 1-100
    finalQuality: number;          // 1-100 (0 si no finalizado)
    status: 'CREATED' | 'IN_PROGRESS' | 'COMPLETED' | 'DISPUTED' | 'CANCELLED';
}

interface Stats {
    totalServices: number;
    userServices: number;
    activeServices: number;
    completedServices: number;
    disputedServices: number;
}
```

---

## Componente QualityEscrowManager

Componente UI completo con todas las funcionalidades.

### Importación

```javascript
import QualityEscrowManager from '../components/admin/QualityEscrowManager';
```

### Uso Básico

```jsx
function AdminPage() {
    return (
        <div>
            <h1>Quality Oracle Management</h1>
            <QualityEscrowManager />
        </div>
    );
}
```

### Características del Componente

1. **Dashboard de Estadísticas**
   - Total de servicios en la plataforma
   - Servicios del usuario actual
   - Servicios activos, completados y disputados

2. **Formulario de Creación**
   - Input para wallet del cliente
   - Input para cantidad de colateral (BEZ)
   - Slider para calidad inicial (1-100%)
   - Aprobación automática de tokens

3. **Lista de Servicios**
   - Muestra todos los servicios del usuario
   - Badges con estado visual
   - Información detallada (colateral, calidades, fecha)
   - Indica si eres Business o Client

4. **Acciones por Rol**
   - **Business**: Botón "Finalize" con slider de calidad final
   - **Client**: Botón "Raise Dispute" si no está satisfecho

---

## Ejemplos de Uso

### 1. Crear un Servicio

```javascript
import { useQualityEscrow } from '../hooks/useQualityEscrow';
import { toast } from 'react-hot-toast';

function CreateServiceButton() {
    const { createService, loading } = useQualityEscrow();

    const handleCreate = async () => {
        const serviceId = await createService(
            '0xClientWalletAddress',  // Wallet del cliente
            100,                       // 100 BEZ de colateral
            85                         // Calidad inicial 85%
        );

        if (serviceId) {
            console.log('Service created with ID:', serviceId);
        }
    };

    return (
        <button onClick={handleCreate} disabled={loading}>
            {loading ? 'Creating...' : 'Create Service'}
        </button>
    );
}
```

### 2. Listar Servicios del Usuario

```javascript
import { useQualityEscrow } from '../hooks/useQualityEscrow';

function ServicesList() {
    const { services, loading } = useQualityEscrow();

    if (loading) return <div>Loading...</div>;

    return (
        <div>
            <h2>My Services</h2>
            {services.map(service => (
                <div key={service.id}>
                    <h3>Service #{service.id}</h3>
                    <p>Status: {service.status}</p>
                    <p>Collateral: {service.collateralAmount} BEZ</p>
                    <p>Initial Quality: {service.initialQuality}%</p>
                    {service.finalQuality > 0 && (
                        <p>Final Quality: {service.finalQuality}%</p>
                    )}
                </div>
            ))}
        </div>
    );
}
```

### 3. Finalizar un Servicio (Business)

```javascript
import { useQualityEscrow } from '../hooks/useQualityEscrow';

function FinalizeServiceButton({ serviceId }) {
    const { finalizeService, loading } = useQualityEscrow();
    const [finalQuality, setFinalQuality] = useState(80);

    const handleFinalize = async () => {
        const success = await finalizeService(serviceId, finalQuality);
        if (success) {
            console.log('Service finalized successfully!');
        }
    };

    return (
        <div>
            <label>
                Final Quality: {finalQuality}%
                <input
                    type="range"
                    min="1"
                    max="100"
                    value={finalQuality}
                    onChange={(e) => setFinalQuality(Number(e.target.value))}
                />
            </label>
            <button onClick={handleFinalize} disabled={loading}>
                Finalize Service
            </button>
        </div>
    );
}
```

### 4. Levantar una Disputa (Client)

```javascript
import { useQualityEscrow } from '../hooks/useQualityEscrow';

function DisputeButton({ serviceId }) {
    const { raiseDispute, loading } = useQualityEscrow();

    const handleDispute = async () => {
        const success = await raiseDispute(serviceId);
        if (success) {
            console.log('Dispute raised successfully!');
        }
    };

    return (
        <button onClick={handleDispute} disabled={loading}>
            Raise Dispute
        </button>
    );
}
```

### 5. Obtener Estadísticas

```javascript
import { useQualityEscrow } from '../hooks/useQualityEscrow';
import { useEffect, useState } from 'react';

function StatsPanel() {
    const { getStats } = useQualityEscrow();
    const [stats, setStats] = useState(null);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        const data = await getStats();
        setStats(data);
    };

    if (!stats) return <div>Loading stats...</div>;

    return (
        <div>
            <h2>Platform Statistics</h2>
            <p>Total Services: {stats.totalServices}</p>
            <p>Your Services: {stats.userServices}</p>
            <p>Active: {stats.activeServices}</p>
            <p>Completed: {stats.completedServices}</p>
            <p>Disputed: {stats.disputedServices}</p>
        </div>
    );
}
```

---

## Integración con Admin Panel

### Opción 1: Ruta Dedicada

Edita `frontend/src/App.jsx` o tu archivo de rutas:

```javascript
import QualityEscrowManager from './components/admin/QualityEscrowManager';

// En tu configuración de rutas
<Route path="/admin/quality-oracle" element={<QualityEscrowManager />} />
```

### Opción 2: Tab en Admin Dashboard

Edita `frontend/src/components/admin/AdminDashboard.jsx`:

```javascript
import QualityEscrowManager from './QualityEscrowManager';

// Dentro del componente
const [activeTab, setActiveTab] = useState('overview');

// En el render
{activeTab === 'quality-oracle' && <QualityEscrowManager />}
```

### Opción 3: Modal/Dialog

```javascript
import { Dialog } from '../ui/dialog';
import QualityEscrowManager from './QualityEscrowManager';

function AdminPanel() {
    const [showQualityOracle, setShowQualityOracle] = useState(false);

    return (
        <>
            <button onClick={() => setShowQualityOracle(true)}>
                Open Quality Oracle
            </button>
            
            <Dialog open={showQualityOracle} onOpenChange={setShowQualityOracle}>
                <QualityEscrowManager />
            </Dialog>
        </>
    );
}
```

---

## Flujo de Trabajo Típico

### Para Business (Proveedor de Servicio)

1. **Crear Servicio**
   ```javascript
   const serviceId = await createService(clientWallet, 100, 85);
   ```

2. **El cliente recibe el servicio** (off-chain)

3. **Finalizar Servicio**
   ```javascript
   const success = await finalizeService(serviceId, 82);
   // Si calidad final < inicial, se aplica penalización
   ```

### Para Client (Receptor de Servicio)

1. **Ver Servicios Activos**
   ```javascript
   const { services } = useQualityEscrow();
   const activeServices = services.filter(s => s.status === 'IN_PROGRESS');
   ```

2. **Si no está satisfecho con el servicio**
   ```javascript
   const success = await raiseDispute(serviceId);
   ```

---

## Manejo de Errores

El hook maneja automáticamente los errores y muestra toasts:

```javascript
// Errores comunes y sus mensajes

// Wallet no conectada
"Please connect your wallet"

// Contratos no configurados
"Contract addresses not configured"

// Aprobación de tokens fallida
"Failed to approve BEZ tokens"

// Servicio no encontrado
"Service not found"

// Usuario no autorizado
"Only business can finalize service"
"Only client can raise dispute"

// Errores de red
"Transaction failed: [error message]"
```

### Manejo Personalizado

```javascript
const { createService } = useQualityEscrow();

const handleCreate = async () => {
    try {
        const serviceId = await createService(clientWallet, amount, quality);
        
        if (!serviceId) {
            // createService retorna null en caso de error
            console.log('Service creation failed');
            return;
        }
        
        // Éxito
        console.log('Service created:', serviceId);
    } catch (error) {
        // Errores no manejados por el hook
        console.error('Unexpected error:', error);
    }
};
```

---

## Testing

### Test Manual

1. **Conectar Wallet**
   - Asegúrate de tener MetaMask o similar
   - Cambia a Polygon Amoy testnet
   - Obtén MATIC de faucet: https://faucet.polygon.technology/

2. **Crear Servicio de Prueba**
   ```javascript
   createService(
       '0xYourTestWallet',  // Usa tu propia wallet
       10,                  // 10 BEZ
       90                   // Calidad 90%
   );
   ```

3. **Verificar en Blockchain**
   - Copia el serviceId
   - Usa `getService(serviceId)` para ver detalles
   - Verifica en PolygonScan Amoy

---

## Próximos Pasos

- [ ] **Fase 3**: Integración de servicios adicionales (Logistics, Hotels, Restaurants)
- [ ] **Fase 4**: Testing E2E completo
- [ ] **Optimizaciones**: Caché de servicios, paginación
- [ ] **UI/UX**: Mejoras visuales, notificaciones push
- [ ] **Analytics**: Dashboard con gráficos de calidad

---

## Soporte y Contacto

Para dudas o issues:
1. Revisa los logs de la consola
2. Verifica que las addresses estén configuradas
3. Comprueba que tengas fondos (MATIC + BEZ)
4. Consulta la documentación del backend: `QUALITY_ORACLE_COMPLETE.md`

---

**¡Fase 2 del Quality Oracle completada! 🎉**

El Frontend SDK está listo para integrar la garantía de calidad en tu aplicación BeZhas.
