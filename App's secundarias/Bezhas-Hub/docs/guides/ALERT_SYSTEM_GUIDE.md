# 🔔 Sistema de Alertas - Guía de Configuración

## Descripción

El sistema de alertas automáticas envía notificaciones a Discord y/o Slack cuando se detectan problemas críticos en la plataforma BeZhas.

## 🚀 Configuración Rápida

### 1. **Discord Webhook**

#### Crear Webhook en Discord:
1. Abre Discord y ve al servidor donde quieres recibir alertas
2. Click derecho en el canal → **Editar Canal**
3. Ve a **Integraciones** → **Webhooks**
4. Click en **Nuevo Webhook**
5. Configura:
   - **Nombre**: BeZhas Alerts
   - **Canal**: #alerts o el que prefieras
6. Click en **Copiar URL del Webhook**

#### Agregar al `.env`:
```bash
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/123456789/AbCdEf...
```

### 2. **Slack Webhook** (Opcional)

#### Crear Webhook en Slack:
1. Ve a https://api.slack.com/apps
2. Click en **Create New App** → **From scratch**
3. Configura:
   - **App Name**: BeZhas Alerts
   - **Workspace**: Tu workspace
4. Ve a **Incoming Webhooks** → **Activate Incoming Webhooks**
5. Click en **Add New Webhook to Workspace**
6. Selecciona el canal (ej: #alerts)
7. Copia la **Webhook URL**

#### Agregar al `.env`:
```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX
```

### 3. **Umbral de Alertas**

Configura cuando se envían alertas basado en el health score:

```bash
ALERT_THRESHOLD=60  # Alerta si health < 60 (default)
```

## 📊 Tipos de Alertas

### 1. **Health Score Crítico**
Se envía cuando el health score cae por debajo del umbral configurado.

**Contenido:**
- Health Score actual
- Estado de Database, Redis, Blockchain, API
- Recomendaciones automáticas
- Severidad (Bajo/Medio/Alto/Crítico)

**Ejemplo:**
```
⚠️ Sistema BeZhas - Health Score Crítico
El sistema tiene un health score de 45/100

Severidad: Alto
Database: ✅ OK
Redis: ❌ Error
Blockchain: ✅ OK
API: ✅ OK

📋 Recomendaciones:
• Revisar 12 errores recientes
• Procesar 3 transacciones pendientes
```

### 2. **Errores Críticos**
Se envía cuando ocurre un error crítico en el sistema.

**Categorías monitoreadas:**
- `blockchain`: Problemas con RPC, transacciones
- `database`: Fallos de conexión, queries
- `payment`: Errores en pagos, Stripe
- `content`: Problemas en posts, validaciones
- `system`: Errores generales del servidor

**Ejemplo:**
```
🚨 Error Crítico en blockchain
Failed to verify transaction on chain

Categoría: blockchain
Entidad Afectada: transaction: 0x1234...
Stack Trace: ...
```

### 3. **Auto-Recuperación Exitosa**
Se envía cuando el sistema resuelve automáticamente un problema.

**Ejemplo:**
```
✅ Auto-Recuperación Exitosa
Balance sincronizado correctamente para usuario 507f1f77bcf86cd799439011

Usuario ID: 507f1f77bcf86cd799439011
Balance Actualizado: 150.50 BEZ
```

### 4. **Transacciones Fallidas**
Se envía cuando una transacción blockchain falla después de varios intentos.

**Ejemplo:**
```
⚠️ Transacción Blockchain Fallida
Transacción 0xabcd1234... ha fallado

TX Hash: 0xabcd1234...
Razón: Insufficient gas
Reintentos: 3
```

### 5. **Resumen de Mantenimiento**
Se envía diariamente a las 3:00 AM con el resumen del mantenimiento nocturno.

**Ejemplo:**
```
📊 Resumen de Mantenimiento Nocturno
Sistema estable. 5 balances sincronizados automáticamente.
2 errores menores resueltos. Health score final: 92/100

Usuarios Sincronizados: 5
Errores Resueltos: 2
Health Score: 92/100

⚠️ Advertencias:
• 3 transacciones pendientes requieren revisión manual
```

## 🔧 Características Avanzadas

### Cooldown de Alertas
Evita spam de notificaciones. Misma alerta no se envía más de 1 vez cada 15 minutos.

### Severidad Automática
```
Health Score 80-100: 🟢 Bajo (Verde)
Health Score 60-79:  🟡 Medio (Amarillo)
Health Score 40-59:  🟠 Alto (Naranja)
Health Score 0-39:   🔴 Crítico (Rojo)
```

### Limpieza Automática
Cache de alertas se limpia cada hora para prevenir memory leaks.

## 🧪 Probar el Sistema

### Método 1: Desde el Dashboard Admin
1. Ve a **Admin Panel** → **Diagnóstico IA**
2. Click en **Mantenimiento Manual**
3. Verifica alertas en Discord/Slack

### Método 2: API Manual
```bash
# Forzar health check
curl -X GET http://localhost:3001/api/diagnostic/health \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Forzar mantenimiento
curl -X POST http://localhost:3001/api/diagnostic/manual-maintenance \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Método 3: Código Directo
```javascript
const alertSystem = require('./services/alertSystem.service');

// Enviar alerta de prueba
await alertSystem.sendHealthAlert(45, {
    database: true,
    redis: false,
    blockchain: true,
    api: true,
    recommendations: ['Test alert']
});
```

## 📋 Troubleshooting

### ❌ Alertas no se envían

**Verificar:**
1. Webhooks configurados en `.env`
   ```bash
   echo $DISCORD_WEBHOOK_URL
   echo $SLACK_WEBHOOK_URL
   ```

2. Logs del servidor:
   ```bash
   # Buscar en logs
   grep "Discord alert sent" backend_startup.log
   grep "Failed to send" backend_startup.log
   ```

3. Probar webhook directamente:
   ```bash
   curl -X POST $DISCORD_WEBHOOK_URL \
     -H "Content-Type: application/json" \
     -d '{"content": "Test from BeZhas"}'
   ```

### ⚠️ Demasiadas alertas

**Solución:**
1. Aumentar threshold:
   ```bash
   ALERT_THRESHOLD=40  # Solo alertar si < 40
   ```

2. Ajustar cooldown en código:
   ```javascript
   // backend/services/alertSystem.service.js
   this.cooldownPeriod = 30 * 60 * 1000; // 30 minutos
   ```

### 🔇 Silenciar alertas temporalmente

**Opción 1:** Comentar webhooks en `.env`
```bash
# DISCORD_WEBHOOK_URL=https://...
# SLACK_WEBHOOK_URL=https://...
```

**Opción 2:** Aumentar threshold muy alto
```bash
ALERT_THRESHOLD=0  # Nunca alertar
```

## 🎨 Personalización

### Cambiar colores de Discord
```javascript
// backend/services/alertSystem.service.js
getColorCode(severity) {
    const colors = {
        'Bajo': 3066993,     // Verde
        'Medio': 16776960,   // Amarillo (editar aquí)
        'Alto': 16744192,    // Naranja
        'Crítico': 15158332  // Rojo
    };
    return colors[severity];
}
```

### Agregar campos personalizados
```javascript
await alertSystem.sendHealthAlert(healthScore, {
    ...details,
    customField: 'Mi valor personalizado'
});
```

## 🔐 Seguridad

### ⚠️ IMPORTANTE:
- **NUNCA** subas webhooks a Git
- Usa `.env` para variables sensibles
- Rotaciona webhooks si se comprometen
- Usa canales privados en Discord/Slack

### Regenerar Webhook Discord:
1. Editar Canal → Integraciones
2. Click en webhook → Eliminar
3. Crear nuevo webhook

## 📚 Referencias

- [Discord Webhooks](https://discord.com/developers/docs/resources/webhook)
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)
- [Sistema de Diagnóstico](./DIAGNOSTIC_SYSTEM_README.md)

## 🆘 Soporte

Si tienes problemas:
1. Revisa logs: `tail -f backend_startup.log`
2. Verifica permisos de webhooks
3. Prueba con curl directamente
4. Consulta la documentación oficial de Discord/Slack
