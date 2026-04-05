# 🔄 Sistema de Gestión de Actualizaciones - BeZhas

## 📋 Descripción General

El **Sistema de Gestión de Actualizaciones** es un panel centralizado en el Admin Dashboard que permite gestionar TODOS los componentes actualizables de la plataforma BeZhas desde una única interfaz. Incluye plugins, dependencias NPM, smart contracts, servicios externos y componentes del sistema.

## 🎯 Componentes Incluidos

### 1. 🔌 Plugins del Sistema
- **Plugins backend** registrados en la base de datos
- **Gestión de versiones** con historial completo
- **Recomendaciones de IA** para cada actualización
- **Rollback automático** a versiones estables
- **Actualización masiva** de todos los plugins
- **Logs de auditoría** completos

### 2. 📦 Dependencias NPM
- **Frontend dependencies** (React, Vite, Tailwind, etc.)
- **Backend dependencies** (Express, Mongoose, etc.)
- **Visualización** de versiones actuales vs. disponibles
- **Actualización individual** o por workspace
- **Detección automática** de actualizaciones

### 3. 📜 Smart Contracts
- **Contratos desplegados** en diferentes networks
- **Información de versión** y dirección
- **Enlaces directos** a block explorers
- **Estado de deployment** (Polygon, Amoy, Localhost)
- **Verificación de contratos**

### 4. ☁️ Servicios Externos
- **APIs de IA** (OpenAI, Google Gemini)
- **Procesadores de pago** (Stripe, MoonPay)
- **Integraciones** de terceros
- **Estado de salud** de cada servicio
- **Configuración** centralizada

### 5. 🖥️ Componentes del Sistema
- **MongoDB** - Base de datos principal
- **Redis** - Sistema de caché
- **WebSocket Server** - Comunicación en tiempo real
- **Uptime monitoring**
- **Health checks**

## 🚀 Cómo Usar

### Acceso al Panel
1. Inicia sesión como administrador
2. Ve a **Panel de Administración**
3. Selecciona la pestaña **"Actualizaciones"**

### Navegación por Secciones
El sistema está organizado en **5 pestañas principales**:

#### 🔌 Plugins del Sistema
**Funcionalidades:**
- Ver lista completa de plugins con estado
- Consultar recomendación de IA antes de actualizar
- Actualizar plugin individual o todos a la vez
- Hacer rollback a versión estable anterior
- Ver historial completo de versiones

**Acciones disponibles:**
- **"Consejo IA"**: Análisis inteligente de la actualización
- **"Actualizar"**: Instalar nueva versión
- **"Rollback"**: Volver a versión estable
- **"Actualizar Todos"**: Actualización masiva
- **Expandir** (↓): Ver historial de versiones

#### 📦 Dependencias NPM
**Funcionalidades:**
- Vista separada de Frontend y Backend
- Comparación de versiones actuales vs. disponibles
- Actualización individual por paquete
- Identificación de paquetes críticos

**Cómo actualizar:**
1. Revisa la lista de dependencias
2. Identifica las que tienen actualización disponible
3. Haz clic en el botón "Actualizar" (↓)
4. Confirma la acción

#### 📜 Smart Contracts
**Funcionalidades:**
- Lista de contratos desplegados
- Información de network y dirección
- Estado de verificación
- Enlaces a exploradores de bloques

**Información mostrada:**
- Nombre del contrato
- Network (Polygon, Amoy, Localhost)
- Dirección del contrato
- Versión actual
- Link a PolygonScan/Etherscan

#### ☁️ Servicios Externos
**Funcionalidades:**
- Estado de salud de cada servicio
- Versión de API utilizada
- Configuración de API keys
- Monitoreo de conectividad

**Servicios monitoreados:**
- **OpenAI API**: GPT-4, análisis de contenido
- **Google Gemini**: IA alternativa
- **Stripe**: Procesamiento de pagos
- **MoonPay**: Compra de cripto
- **Bridge APIs**: Integraciones externas

#### 🖥️ Componentes del Sistema
**Funcionalidades:**
- Monitoreo de uptime
- Health checks automáticos
- Estado de servicios internos

**Componentes monitoreados:**
- **MongoDB**: Base de datos principal
- **Redis**: Caché y colas
- **WebSocket**: Comunicación real-time
- **Backend API**: Estado del servidor

## 🔧 Arquitectura Técnica

### Estructura de Archivos

```
frontend/src/components/admin/
├── SystemUpdateManager.jsx  # Componente principal
└── PluginManager.jsx        # Legacy (deprecated)

frontend/src/pages/
└── AdminDashboard.jsx       # Integración del panel

backend/routes/
├── pluginRoutes.js         # API de plugins
├── admin.routes.js         # APIs de admin
└── (nuevos endpoints)      # APIs de dependencies, contracts, services
```

### Endpoints del Backend

#### Plugins
```
GET    /api/plugins                     # Listar todos los plugins
GET    /api/plugins/:id/advice          # Obtener consejo de IA
PATCH  /api/plugins/:id/update          # Actualizar plugin
PATCH  /api/plugins/:id/rollback        # Rollback
POST   /api/plugins/update-all          # Actualizar todos
```

#### Dependencies (Pendientes de implementación)
```
GET    /api/admin/dependencies/frontend    # Deps del frontend
GET    /api/admin/dependencies/backend     # Deps del backend
POST   /api/admin/dependencies/update      # Actualizar dependencia
```

#### Contracts (Pendientes de implementación)
```
GET    /api/admin/contracts/status         # Estado de contratos
GET    /api/admin/contracts/:id            # Info de contrato
```

#### Services (Pendientes de implementación)
```
GET    /api/admin/services/status          # Estado de servicios
PATCH  /api/admin/services/:id/config      # Configurar servicio
POST   /api/admin/services/:id/test        # Test de conectividad
```

#### System Components (Pendientes de implementación)
```
GET    /api/admin/system/components        # Estado de componentes
GET    /api/admin/system/health            # Health check general
```

### Componentes React

El sistema está dividido en sub-componentes modulares:

```jsx
<SystemUpdateManager>           // Componente principal
  ├─ <PluginsSection>          // Gestión de plugins
  │   └─ <PluginCard>          // Card individual
  ├─ <DependenciesSection>     // Gestión de dependencias
  │   └─ <DependencyCard>      // Card individual
  ├─ <ContractsSection>        // Smart contracts
  ├─ <ServicesSection>         // Servicios externos
  └─ <SystemComponentsSection> // Componentes del sistema
```

## 📊 Estados y Badges

### Estados de Componentes
| Estado | Color | Icono | Descripción |
|--------|-------|-------|-------------|
| **Actualizado** | Verde | ✓ | Componente en última versión |
| **Actualización disponible** | Amarillo | ⏱ | Nueva versión disponible |
| **Actualizando** | Azul | ⟳ | Proceso de actualización en curso |
| **Error** | Rojo | ⚠ | Error en el componente |

### Niveles de Riesgo (IA)
| Nivel | Color | Recomendación |
|-------|-------|---------------|
| **Low** | Verde | Actualización segura |
| **Medium** | Amarillo | Revisar cambios |
| **High** | Rojo | Testing requerido |

## 🔒 Seguridad

### Autenticación
- **Requiere**: Permisos de administrador
- **Validación**: Firma de wallet verificada
- **Middleware**: `validateAdminSignature`

### Auditoría
- **Logs completos** de todas las acciones
- **Registro de wallet** del administrador
- **Timestamps** de cada cambio
- **Estado de resultado** (éxito/fallo)

## 🎨 Interfaz de Usuario

### Diseño Responsive
- **Desktop**: Vista completa con todos los detalles
- **Tablet**: Pestañas colapsables
- **Mobile**: Vista optimizada con scroll horizontal

### Dark Mode
- Soporte completo de tema oscuro
- Colores adaptados automáticamente
- Contraste optimizado

### Animaciones
- **Loading states**: Spinners y pulsos
- **Actualizaciones**: Animaciones de bounce
- **Transiciones**: Suaves entre secciones

## 🚧 Desarrollo Futuro

### Fase 1: Completar Backend (Próxima)
- [ ] Endpoint de dependencies/frontend
- [ ] Endpoint de dependencies/backend  
- [ ] Sistema de actualización automática de NPM
- [ ] Endpoint de contracts/status
- [ ] Endpoint de services/status

### Fase 2: Automatización
- [ ] Auto-update programado (cron jobs)
- [ ] Notificaciones push de actualizaciones
- [ ] Testing automático pre-actualización
- [ ] Rollback automático en caso de error

### Fase 3: Monitoreo Avanzado
- [ ] Dashboard de métricas en tiempo real
- [ ] Alertas de seguridad (CVEs)
- [ ] Comparación de performance pre/post actualización
- [ ] Reportes de actualización automáticos

### Fase 4: Integración CI/CD
- [ ] Integración con GitHub Actions
- [ ] Deploy automático post-actualización
- [ ] Validación de contratos pre-deploy
- [ ] Snapshots automáticos

## 📝 Datos Mock

Actualmente el sistema usa **datos de demostración** para las secciones que aún no tienen backend completo:

```javascript
// Dependencies mock
mockFrontendDeps = [
  { name: 'react', current: '18.2.0', latest: '18.3.1' },
  { name: 'vite', current: '5.0.0', latest: '5.0.12' },
  ...
]

// Contracts mock
mockContracts = [
  { name: 'BeZhas Token', network: 'Polygon', ... },
  { name: 'DAO Governance', network: 'Polygon', ... }
]

// Services mock
mockServices = [
  { name: 'OpenAI API', healthy: true, ... },
  { name: 'Stripe', healthy: true, ... }
]

// System components mock
mockSystemComponents = [
  { name: 'MongoDB', uptime: '99.9%', ... },
  { name: 'Redis Cache', uptime: '99.5%', ... }
]
```

Estos datos serán reemplazados por llamadas reales al backend una vez se implementen los endpoints correspondientes.

## 🔧 Configuración

### Variables de Entorno
```env
# Backend
NODE_ENV=production
MONGODB_URI=mongodb://localhost:27017/bezhas
REDIS_URL=redis://localhost:6379

# APIs externas
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
STRIPE_SECRET_KEY=sk_test_...
MOONPAY_API_KEY=...
```

### Instalación
```bash
# Frontend
cd frontend
npm install

# Backend
cd backend
npm install

# Prisma (para plugins)
cd backend
npx prisma generate
npx prisma migrate deploy
```

## 🧪 Testing

### Probar el Sistema
```bash
# 1. Backend
cd backend
npm run dev

# 2. Frontend
cd frontend
npm run dev

# 3. Acceder
http://localhost:5173/admin-panel
```

### Seed de Datos
```bash
# Poblar plugins
cd backend
npm run seed:plugins

# (Futuros) Seed de otros componentes
npm run seed:contracts
npm run seed:services
```

## 📞 Soporte

### Troubleshooting

**Error: "Error cargando plugins"**
- Verifica que el backend esté corriendo
- Confirma la conexión a MongoDB
- Revisa los logs del backend

**Error: Datos mock mostrados**
- Normal para secciones en desarrollo
- Los endpoints correspondientes aún no están implementados
- Verifica la consola del navegador

**Error: "No autorizado"**
- Confirma que estás logueado como admin
- Verifica la firma de wallet
- Revisa el token de autenticación

### Logs
- **Frontend**: Consola del navegador (F12)
- **Backend**: Terminal o archivo `backend/logs/`
- **Database**: Colección `UpdateLog` en MongoDB

---

**Última actualización**: 2026-01-10  
**Versión**: 2.0.0 (Sistema Completo)  
**Autor**: BeZhas Development Team
