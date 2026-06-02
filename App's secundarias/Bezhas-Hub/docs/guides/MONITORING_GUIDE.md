# Revenue Monitoring System

Sistema completo de monitoreo en tiempo real para el Revenue Stream Native de BeZhas.

## 🎯 Características

### Monitoreo en Tiempo Real
- ✅ Escucha eventos de blockchain 24/7
- ✅ Detecta swaps completados automáticamente
- ✅ Registra fees colectadas en tiempo real
- ✅ Tracking de métricas de revenue

### Notificaciones Multi-Canal
- 🔔 **Discord**: Alertas con embeds formatados
- 💬 **Slack**: Mensajes a canales de equipo
- 📧 **Email**: Reportes y alertas críticas
- 📱 **SMS**: Alertas urgentes (opcional con Twilio)

### Entrega Automática de Servicios
- 🎨 **NFTs**: Minteo automático post-pago
- ⭐ **Suscripciones**: Activación instantánea
- 📦 **Productos**: Integración con fulfillment
- 🔄 **Custom**: Extensible para cualquier servicio

### Analytics y Reportes
- 📊 Dashboard de estadísticas en vivo
- 📅 Reportes diarios automatizados
- 📈 Proyecciones de revenue
- 🎯 Tracking de objetivos

---

## 🚀 Quick Start

### 1. Instalación

```bash
# Instalar dependencias
cd backend
npm install ethers axios nodemailer
```

### 2. Configuración

Crear o actualizar `backend/.env`:

```env
# Blockchain
POLYGON_RPC_URL=https://polygon-rpc.com
BEZ_LIQUIDITY_RAMP_ADDRESS=0xYourContractAddress

# Notifications
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR_WEBHOOK
ALERT_EMAIL_TO=admin@bez.digital
ALERT_EMAIL_FROM=noreply@bez.digital

# SMTP (for email)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Monitoring Config
HIGH_VALUE_THRESHOLD=5000
DAILY_REPORT_TIME=09:00
ENABLE_NOTIFICATIONS=true
ENABLE_SERVICE_DELIVERY=true
```

### 3. Iniciar Monitoreo

#### Opción A: Node.js directo
```bash
node backend/scripts/monitorRevenue.js
```

#### Opción B: PM2 (recomendado para producción)
```bash
# Instalar PM2
npm install -g pm2

# Iniciar monitor
pm2 start backend/scripts/monitorRevenue.js --name "revenue-monitor"

# Ver logs
pm2 logs revenue-monitor

# Ver status
pm2 status

# Auto-start en reboot
pm2 startup
pm2 save
```

#### Opción C: Docker
```bash
# Build
docker build -t bezhas-monitor -f Dockerfile.monitor .

# Run
docker run -d --name revenue-monitor \
  --env-file backend/.env \
  bezhas-monitor

# Logs
docker logs -f revenue-monitor
```

---

## 📋 Uso

### Ver Estado en Tiempo Real

El monitor muestra información en consola:

```
═══════════════════════════════════════════════════════════
  BeZhas Revenue Stream Native - Monitoring System v1.0
═══════════════════════════════════════════════════════════

📋 Configuration:
   High-Value Threshold: $5,000
   Notifications: Enabled ✅
   Service Delivery: Enabled ✅
   Daily Report: 09:00

✅ Monitoring system started successfully
   Press Ctrl+C to stop

═══════════════════════════════════════════════════════════

✅ SWAP #1
   User: 0x1234...5678
   Amount: $1,000.00 USDC
   BEZ Received: 995.00 BEZ
   Service: LIQUIDITY_RAMP
   Tx: 0xabc...def

💰 FEE COLLECTED
   User: 0x1234...5678
   Amount: $5.00 USDC
   Service: LIQUIDITY_RAMP
   Total Revenue: $5.00
```

### Comandos PM2

```bash
# Ver logs en vivo
pm2 logs revenue-monitor

# Ver estadísticas
pm2 monit

# Reiniciar
pm2 restart revenue-monitor

# Detener
pm2 stop revenue-monitor

# Eliminar
pm2 delete revenue-monitor

# Ver info detallada
pm2 info revenue-monitor
```

---

## 🔔 Configurar Webhooks

### Discord

1. Ir a Server Settings → Integrations → Webhooks
2. Click "New Webhook"
3. Configurar nombre y canal
4. Copiar webhook URL
5. Agregar a `.env`: `DISCORD_WEBHOOK_URL=...`

### Slack

1. Ir a https://api.slack.com/apps
2. Create New App → From scratch
3. Incoming Webhooks → Activate
4. Add New Webhook to Workspace
5. Seleccionar canal
6. Copiar webhook URL
7. Agregar a `.env`: `SLACK_WEBHOOK_URL=...`

### Email (Gmail)

1. Activar 2FA en tu cuenta Google
2. Generar App Password: https://myaccount.google.com/apppasswords
3. Configurar en `.env`:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=tu-email@gmail.com
   SMTP_PASS=tu-app-password
   ```

---

## 🎨 Personalizar Notificaciones

### Ejemplo: Notificación Custom

```javascript
const { notificationService } = require('./services/notificationService');

// Enviar notificación a Discord
await notificationService.sendDiscord({
  title: '🎉 Milestone Achieved!',
  description: 'We reached $10,000 in revenue!',
  color: 0x10b981, // Green
  fields: [
    { name: 'Total Revenue', value: '$10,000' },
    { name: 'Total Swaps', value: '2,000' },
    { name: 'Time to Milestone', value: '30 days' }
  ],
  thumbnail: 'https://your-image-url.com/celebration.png'
});
```

### Ejemplo: Alertas Multi-Canal

```javascript
const { sendAlert } = require('./services/notificationService');

await sendAlert({
  title: '🚨 Critical Alert',
  description: 'System requires attention',
  color: 0xef4444,
  fields: [
    { name: 'Issue', value: 'High error rate detected' },
    { name: 'Action Required', value: 'Check logs immediately' }
  ]
}, ['discord', 'slack', 'email']);
```

---

## 🔧 Integrar Servicios Custom

### 1. NFT Minting

Editar `backend/scripts/monitorRevenue.js`:

```javascript
listener.on('deliver-nft', async (data) => {
  const { user, transactionHash } = data;
  
  // Tu lógica de minteo
  const tokenId = await yourNFTContract.mint(user, {
    // metadata
  });
  
  console.log(`✅ NFT #${tokenId} minted to ${user}`);
  
  // Notificar al usuario
  await sendEmail({
    to: await getUserEmail(user),
    subject: 'Your NFT is Ready!',
    body: `Your NFT #${tokenId} has been minted. View it at...`
  });
});
```

### 2. Subscription Activation

```javascript
listener.on('deliver-subscription', async (data) => {
  const { user, transactionHash } = data;
  
  // Tu lógica de suscripción
  await db.users.update({
    where: { address: user },
    data: { 
      isPremium: true,
      premiumUntil: new Date(Date.now() + 30*24*60*60*1000) // 30 days
    }
  });
  
  console.log(`✅ Premium activated for ${user}`);
});
```

### 3. Custom Service

```javascript
listener.on('swap-executed', async (data) => {
  if (data.serviceId === 'YOUR_CUSTOM_SERVICE') {
    // Tu lógica custom
    await yourCustomLogic(data);
  }
});
```

---

## 📊 Analytics Dashboard

### Crear Dashboard Web

```javascript
// backend/routes/analytics.routes.js
const express = require('express');
const { getEventListener } = require('../services/revenueEventListener');

const router = express.Router();

router.get('/stats', async (req, res) => {
  try {
    const listener = getEventListener();
    const stats = await listener.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/recent-events', async (req, res) => {
  try {
    const listener = getEventListener();
    const events = await listener.queryHistoricalEvents(
      'PlatformFeeCollected',
      -10000,
      'latest'
    );
    
    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
```

### Frontend Dashboard

```jsx
import RevenueAnalytics from './components/analytics/RevenueAnalytics';

function AdminDashboard() {
  return (
    <div>
      <h1>Revenue Dashboard</h1>
      <RevenueAnalytics />
    </div>
  );
}
```

---

## 🐛 Troubleshooting

### Monitor no se conecta

**Problema**: `Provider error: Could not connect to RPC`

**Solución**:
1. Verificar `POLYGON_RPC_URL` en `.env`
2. Probar RPC alternativo: https://polygon-rpc.com
3. Verificar firewall/proxy

### No se reciben notificaciones

**Problema**: Eventos detectados pero sin notificaciones

**Solución**:
1. Verificar webhooks en `.env`
2. Test manual: `node backend/services/notificationService.js`
3. Revisar permisos de webhook (Discord/Slack)

### Eventos perdidos

**Problema**: Monitor pierde conexión

**Solución**:
1. Usar PM2 para auto-restart: `pm2 start ... --max-restarts=10`
2. Aumentar `maxReconnectAttempts` en config
3. Usar RPC provider premium (Alchemy, Infura)

### Alto uso de CPU

**Problema**: Monitor consume muchos recursos

**Solución**:
1. Aumentar intervalo de polling (si usas polling)
2. Usar WebSocket provider en vez de HTTP
3. Limitar query de eventos históricos

---

## 📈 Mejores Prácticas

### 1. Seguridad
- ✅ Nunca expongas webhooks públicamente
- ✅ Usa variables de entorno para secrets
- ✅ Valida eventos antes de procesar
- ✅ Implementa rate limiting en servicios

### 2. Confiabilidad
- ✅ Usa PM2 para auto-restart
- ✅ Configura alertas de downtime
- ✅ Guarda logs en archivo
- ✅ Implementa circuit breaker para APIs externas

### 3. Performance
- ✅ Procesa eventos en background (queue)
- ✅ Usa caché para queries frecuentes
- ✅ Batch updates a base de datos
- ✅ Monitorea memoria y CPU

### 4. Monitoring del Monitor
- ✅ Healthcheck endpoint
- ✅ Métricas de uptime
- ✅ Alertas de errores críticos
- ✅ Backup monitoring system

---

## 🔄 Actualizaciones

### Actualizar Monitor

```bash
# Con PM2
pm2 stop revenue-monitor
git pull
npm install
pm2 restart revenue-monitor

# Con Docker
docker stop revenue-monitor
docker rm revenue-monitor
docker build -t bezhas-monitor .
docker run -d --name revenue-monitor --env-file .env bezhas-monitor
```

### Rollback

```bash
# PM2
pm2 stop revenue-monitor
git checkout <previous-commit>
pm2 restart revenue-monitor

# Docker
docker stop revenue-monitor
docker run -d --name revenue-monitor bezhas-monitor:<previous-tag>
```

---

## 📚 Recursos

### Logs
- **PM2**: `~/.pm2/logs/revenue-monitor-*.log`
- **Docker**: `docker logs revenue-monitor`

### Comandos Útiles
```bash
# Test notificaciones
node backend/services/notificationService.js

# Test event listener
node -e "require('./backend/services/revenueEventListener').getEventListener().start()"

# Ver stats del contrato
node -e "require('./backend/services/revenueEventListener').getEventListener().initialize().then(l => l.getStats().then(console.log))"
```

### Links
- **Documentación completa**: [REVENUE_STREAM_NATIVE.md](./REVENUE_STREAM_NATIVE.md)
- **Quick Start**: [REVENUE_STREAM_QUICK_START.md](./REVENUE_STREAM_QUICK_START.md)
- **Comandos**: [COMMANDS.md](./COMMANDS.md)

---

## ✨ Resultado

Con este sistema de monitoreo, BeZhas tiene:

- ✅ **Visibilidad completa** del revenue en tiempo real
- ✅ **Alertas automáticas** para eventos importantes
- ✅ **Entrega de servicios** sin intervención manual
- ✅ **Reportes diarios** para tracking de métricas
- ✅ **Sistema resiliente** con auto-reconnect

**El revenue stream está completamente automatizado!** 🚀

---

*Sistema de Monitoreo v1.0 - Enero 2026*
