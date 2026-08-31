# Sistema de Diagnóstico Automático - BeZhas

## 🚀 Implementación Completa + Sistema de Alertas

El sistema de diagnóstico automático ha sido completamente implementado con alertas en tiempo real y está listo para operar de forma autónoma.

## ✅ **FASE 1 COMPLETADA - Producción Ready**

### 1. ✅ Dashboard Integrado en Admin Panel
- Pestaña **"Diagnóstico IA"** visible en Admin Dashboard
- Lazy loading para optimización
- Actualización automática cada minuto
- Permisos admin-only

### 2. ✅ Autenticación y Autorización
- Todos los endpoints protegidos con `verifyAdminToken`
- Requiere header: `Authorization: Bearer ADMIN_TOKEN`
- Validación en cada request
- Rate limiting integrado

### 3. ✅ Sistema de Alertas Discord/Slack
- Health score crítico (< 60)
- Errores críticos en blockchain/database
- Auto-recuperación exitosa
- Transacciones fallidas
- Resumen diario de mantenimiento
- **Documentación completa**: [ALERT_SYSTEM_GUIDE.md](./ALERT_SYSTEM_GUIDE.md)

## 📦 Componentes Implementados

### Backend

#### 1. **Servicio de Diagnóstico** (`diagnosticAgent.service.js`)
- ✅ Verificación de transacciones blockchain
- ✅ Diagnóstico de desbalances de créditos
- ✅ Análisis de patrones de errores
- ✅ Cálculo de Health Score (0-100)
- ✅ Auto-recuperación de balances
- ✅ Integración con UnifiedAI para análisis profundos

#### 2. **Modelos de Datos**
- ✅ `DiagnosticLog`: Registro de todos los diagnósticos
- ✅ `MaintenanceReport`: Reportes de mantenimiento automatizados
- ✅ `Transaction`: Transacciones con soporte para reintentos

#### 3. **API REST** (`diagnostic.routes.js`)
```
POST /api/diagnostic/transaction - Diagnostica transacción blockchain [🔒 ADMIN]
POST /api/diagnostic/credits/:userId - Verifica créditos de usuario [🔒 ADMIN]
GET /api/diagnostic/health - Estado de salud del sistema [🔒 ADMIN]
GET /api/diagnostic/logs - Logs de diagnóstico [🔒 ADMIN]
GET /api/diagnostic/reports - Reportes de mantenimiento [🔒 ADMIN]
POST /api/diagnostic/manual-maintenance - Forzar mantenimiento [🔒 ADMIN]
```

**Autenticación requerida:**
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:3001/api/diagnostic/health
```

#### 4. **Cron Jobs Automatizados**
- 🕐 **3:00 AM diario**: Mantenimiento nocturno completo
  - Sincroniza balances de usuarios
  - Genera reporte con análisis IA
  - Guarda reporte en `/REPORTS/MAINTENANCE/`

- 🕐 **Cada 6 horas**: Análisis de salud del sistema
  - Calcula Health Score
  - Detecta patrones de error
  - Registra métricas

### Frontend

#### **DiagnosticDashboard** (`admin/DiagnosticDashboard.jsx`)
- 📊 **Visualización de Health Score** con gráfico circular
- 📈 **Métricas en tiempo real**:
  - Total de usuarios
  - Errores recientes (24h)
  - Transacciones pendientes
  - Contenido activo (7 días)
- 🔍 **Logs de Diagnóstico** con filtros por severidad
- 📝 **Reportes de Mantenimiento** con análisis IA
- 🔄 **Actualización automática** cada minuto
- ⚡ **Mantenimiento manual** con un clic

## 🎯 Características Principales

### 1. **Auto-Recuperación**
El sistema detecta automáticamente:
- Desbalances entre blockchain y base de datos
- Transacciones fallidas
- Errores críticos

Y ejecuta acciones correctivas sin intervención humana.

### 2. **Análisis con IA**
Cada diagnóstico y reporte incluye:
- Resumen ejecutivo generado por IA
- Recomendaciones específicas
- Predicciones de estabilidad

### 3. **Monitoreo Continuo**
- Worker de BullMQ procesando diagnósticos en background
- Cron jobs ejecutándose 24/7
- Logs detallados de cada operación
- **Alertas automáticas** a Discord/Slack cuando health < 60

## 🔔 Sistema de Alertas

### Configuración
Ver guía completa: [ALERT_SYSTEM_GUIDE.md](./ALERT_SYSTEM_GUIDE.md)

```bash
# backend/.env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
ALERT_THRESHOLD=60
```

### Tipos de Alertas
1. **Health Score Crítico** - Cuando < 60
2. **Errores Críticos** - Blockchain, DB, Payments
3. **Auto-Recuperación** - Sincronización exitosa
4. **Transacciones Fallidas** - Después de 3 reintentos
5. **Resumen Diario** - 3:00 AM con métricas

## 📋 Cómo Usar

### Acceso al Dashboard
1. Navega al Admin Panel
2. Haz clic en la nueva pestaña **"Diagnóstico IA"**
3. Visualiza el Health Score y métricas en tiempo real

### Mantenimiento Manual
```javascript
// Desde el dashboard
Click en "Mantenimiento Manual"

// O vía API
POST http://localhost:3001/api/diagnostic/manual-maintenance
```

### Consultar Logs
```javascript
// Todos los logs
GET /api/diagnostic/logs

// Filtrar por severidad
GET /api/diagnostic/logs?severity=critical

// Filtrar por categoría
GET /api/diagnostic/logs?category=blockchain
```

## 🔧 Configuración

### Variables de Entorno Requeridas
```env
# Ya existentes en tu .env
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
BEZCOIN_CONTRACT_ADDRESS=0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
REDIS_HOST=localhost
REDIS_PORT=6379
```

## 📊 Métricas del Health Score

El sistema calcula el Health Score basándose en:
- **Errores recientes**: -5 puntos por error (máximo -40)
- **Transacciones pendientes**: -2 puntos por transacción (máximo -20)
- **Contenido activo**: +5 puntos si > 100 posts en 7 días

### Interpretación
- **80-100**: 🟢 Sistema saludable
- **50-79**: 🟡 Advertencia - requiere atención
- **0-49**: 🔴 Crítico - intervención inmediata

## 🧪 Testing

```bash
# Ejecutar tests del sistema de diagnóstico
cd backend
node node_modules/jest/bin/jest.js tests/automation/diagnosticSystem.test.js
```

## 📁 Estructura de Archivos

```
backend/
├── services/automation/
│   ├── diagnosticAgent.service.js   ✅ Servicio principal
│   ├── rewardSystem.service.js      ✅ Sistema de recompensas
│   └── thirdPartyAnalyzer.service.js ✅ Análisis de terceros
├── controllers/
│   └── diagnostic.controller.js      ✅ Controlador API
├── routes/
│   └── diagnostic.routes.js          ✅ Rutas REST
├── models/
│   └── transaction.model.js          ✅ Modelo de transacciones
└── tests/automation/
    └── diagnosticSystem.test.js      ✅ Tests

frontend/
└── src/components/admin/
    └── DiagnosticDashboard.jsx       ✅ Dashboard visual

REPORTS/
└── MAINTENANCE/
    └── maintenance_YYYY-MM-DD.md     📝 Reportes generados
```

## 🚀 Próximos Pasos

1. **Alertas Push**: Integrar notificaciones Discord/Telegram para errores críticos
2. **Métricas Avanzadas**: Agregar análisis de performance y latencia
3. **Predicción de Fallos**: Machine Learning para predecir problemas antes de que ocurran
4. **Dashboard en Tiempo Real**: WebSockets para actualización instantánea

## 🎉 ¡Listo para Producción!

El sistema está completamente funcional y puede desplegarse en Google Cloud. Los cron jobs se activarán automáticamente al iniciar el servidor.

### Verificación Rápida
```bash
# 1. Iniciar el backend
cd backend
node server.js

# 2. Verificar Health
curl http://localhost:3001/api/diagnostic/health

# 3. Ver logs
curl http://localhost:3001/api/diagnostic/logs
```

---

**Desarrollado con ❤️ para BeZhas**  
*Powered by UnifiedAI & BullMQ*
