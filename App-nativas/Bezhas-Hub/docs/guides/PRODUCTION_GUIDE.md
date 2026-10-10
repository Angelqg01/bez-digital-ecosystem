# Revenue Stream Native - Production Guide

Guía completa para desplegar y mantener el Revenue Stream Native en producción.

## 📋 Pre-requisitos

### Infraestructura Requerida

- ✅ **Servidor Linux** (Ubuntu 20.04+ recomendado)
- ✅ **Node.js 18+** instalado
- ✅ **PM2** para process management
- ✅ **Nginx** como reverse proxy (opcional)
- ✅ **PostgreSQL/MongoDB** para analytics (opcional)
- ✅ **Domain/SSL** para webhooks HTTPS

### Cuentas y Servicios

- ✅ **Polygon RPC**: Alchemy, Infura, o QuickNode
- ✅ **Discord Server** con webhook configurado
- ✅ **Slack Workspace** con webhook (opcional)
- ✅ **Email SMTP** (Gmail, SendGrid, etc)
- ✅ **Monitoring**: Grafana Cloud, Datadog, etc (opcional)

---

## 🚀 Deployment

### 1. Preparar Servidor

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar PM2
sudo npm install -g pm2

# Instalar Git
sudo apt install -y git

# Crear usuario para la app (opcional pero recomendado)
sudo useradd -m -s /bin/bash bezhas
sudo su - bezhas
```

### 2. Clonar Repositorio

```bash
cd /home/bezhas
git clone https://github.com/your-org/bezhas-web3.git
cd bezhas-web3
```

### 3. Instalar Dependencias

```bash
# Backend
cd backend
npm install --production

# Frontend (si es necesario)
cd ../frontend
npm install
npm run build
```

### 4. Configurar Variables de Entorno

```bash
cd /home/bezhas/bezhas-web3/backend
nano .env
```

Contenido de `.env`:

```env
# ━━━ Blockchain ━━━
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
BEZ_LIQUIDITY_RAMP_ADDRESS=0xYourContractAddress
PRIVATE_KEY=your_private_key_for_signer

# ━━━ Notifications ━━━
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR_WEBHOOK
ALERT_EMAIL_TO=admin@bezhas.com
ALERT_EMAIL_FROM=noreply@bezhas.com

# ━━━ SMTP (Gmail example) ━━━
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# ━━━ Monitoring Config ━━━
HIGH_VALUE_THRESHOLD=5000
DAILY_REPORT_TIME=09:00
ENABLE_NOTIFICATIONS=true
ENABLE_SERVICE_DELIVERY=true
LOG_LEVEL=info

# ━━━ Database (opcional) ━━━
DATABASE_URL=postgresql://user:pass@localhost:5432/bezhas

# ━━━ Security ━━━
NODE_ENV=production
JWT_SECRET=your-jwt-secret
API_KEY=your-api-key
```

Asegurar permisos:

```bash
chmod 600 .env
```

### 5. Deploy Smart Contract

```bash
# Verificar configuración en hardhat.config.js
nano hardhat.config.js

# Deploy
npx hardhat run scripts/deploy.js --network polygon

# O usar script automatizado
node backend/scripts/deployRevenue.js
```

### 6. Iniciar Monitor con PM2

```bash
cd /home/bezhas/bezhas-web3

# Iniciar monitor
pm2 start ecosystem.config.js --only revenue-monitor --env production

# Iniciar API (si aplica)
pm2 start ecosystem.config.js --only backend-api --env production

# Ver status
pm2 status

# Ver logs
pm2 logs revenue-monitor

# Auto-start en reboot
pm2 startup
pm2 save
```

### 7. Configurar Nginx (Opcional)

```bash
sudo nano /etc/nginx/sites-available/bezhas-monitor
```

Contenido:

```nginx
server {
    listen 80;
    server_name monitor.bezhas.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/monitoring {
        proxy_pass http://localhost:5000/api/monitoring;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

Activar:

```bash
sudo ln -s /etc/nginx/sites-available/bezhas-monitor /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 8. SSL con Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d monitor.bezhas.com
```

---

## 🔒 Security Checklist

### Servidor

- [ ] Firewall configurado (UFW/iptables)
- [ ] SSH con key-based auth (no passwords)
- [ ] Fail2ban instalado y configurado
- [ ] Actualizaciones automáticas habilitadas
- [ ] Usuario no-root para la app
- [ ] Permisos correctos en archivos (.env = 600)

```bash
# Firewall básico
sudo ufw allow 22/tcp  # SSH
sudo ufw allow 80/tcp  # HTTP
sudo ufw allow 443/tcp # HTTPS
sudo ufw enable

# Fail2ban
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

### Aplicación

- [ ] Variables de entorno seguras (no hardcodeadas)
- [ ] API keys rotadas regularmente
- [ ] Rate limiting en endpoints
- [ ] CORS configurado correctamente
- [ ] Logs sanitizados (no expongas keys)
- [ ] Webhooks con verificación de firma

### Smart Contract

- [ ] Roles asignados solo a addresses confiables
- [ ] Treasury multi-sig (recomendado)
- [ ] Contract pausable en emergencias
- [ ] Auditoría completada
- [ ] Limites de transacción configurados

---

## 📊 Monitoring y Observability

### PM2 Monitoring

```bash
# Dashboard en tiempo real
pm2 monit

# Logs
pm2 logs revenue-monitor --lines 100

# Metrics
pm2 describe revenue-monitor
```

### Health Checks

```bash
# API health endpoint
curl http://localhost:5000/api/monitoring/health

# Stats
curl http://localhost:5000/api/monitoring/stats

# Prometheus metrics
curl http://localhost:5000/api/monitoring/metrics
```

### Grafana Dashboard

1. Instalar Prometheus + Grafana:

```bash
# Prometheus
wget https://github.com/prometheus/prometheus/releases/latest/download/prometheus-*.tar.gz
tar xvfz prometheus-*.tar.gz
cd prometheus-*
./prometheus --config.file=prometheus.yml

# Grafana
sudo apt-get install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
sudo apt-get update
sudo apt-get install grafana
sudo systemctl start grafana-server
```

2. Configurar `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'bezhas-monitor'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:5000']
```

3. Importar dashboard en Grafana (puerto 3000)

### Alertas

**Uptime Robot** (gratis):
- URL: https://uptimerobot.com
- Monitor: `http://your-server/api/monitoring/health`
- Interval: 5 minutos

**PagerDuty/Opsgenie** (profesional):
- Integrar con Discord/Slack webhooks
- Alertas críticas vía SMS

---

## 🔧 Maintenance

### Actualizaciones

```bash
# Detener servicios
pm2 stop revenue-monitor

# Backup
cp -r /home/bezhas/bezhas-web3 /home/bezhas/bezhas-web3.backup

# Actualizar código
cd /home/bezhas/bezhas-web3
git pull origin main

# Instalar nuevas deps
cd backend
npm install

# Restart
pm2 restart revenue-monitor
pm2 save
```

### Backups

```bash
# Script de backup diario
sudo nano /usr/local/bin/backup-bezhas.sh
```

Contenido:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/bezhas"

# Crear directorio
mkdir -p $BACKUP_DIR

# Backup código
tar -czf $BACKUP_DIR/code_$DATE.tar.gz /home/bezhas/bezhas-web3

# Backup .env
cp /home/bezhas/bezhas-web3/backend/.env $BACKUP_DIR/env_$DATE

# Backup PM2
pm2 save

# Cleanup old backups (>7 días)
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $DATE"
```

Automatizar:

```bash
chmod +x /usr/local/bin/backup-bezhas.sh
sudo crontab -e

# Agregar línea (diario a las 3 AM):
0 3 * * * /usr/local/bin/backup-bezhas.sh >> /var/log/bezhas-backup.log 2>&1
```

### Logs Rotation

```bash
sudo nano /etc/logrotate.d/bezhas
```

Contenido:

```
/home/bezhas/bezhas-web3/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    missingok
    create 0644 bezhas bezhas
}
```

---

## 🚨 Troubleshooting

### Monitor no inicia

**Síntomas**: PM2 muestra "errored" o "stopped"

**Diagnóstico**:
```bash
pm2 logs revenue-monitor --err --lines 50
```

**Soluciones**:
1. Verificar `.env`: `cat backend/.env | grep -v PASS`
2. Test RPC: `curl $POLYGON_RPC_URL`
3. Verificar contract address
4. Check permisos: `ls -la backend/.env`

### Alto uso de memoria

**Síntomas**: PM2 restart frecuente por `max_memory_restart`

**Soluciones**:
```bash
# Aumentar límite en ecosystem.config.js
max_memory_restart: '1G'  # era 500M

# Verificar memory leaks
pm2 monit

# Restart manual
pm2 restart revenue-monitor
```

### Eventos no detectados

**Síntomas**: No se reciben notificaciones de swaps

**Diagnóstico**:
```bash
# Verificar últimos eventos en blockchain
node -e "
const { getEventListener } = require('./backend/services/revenueEventListener');
(async () => {
  const l = getEventListener();
  await l.initialize();
  const events = await l.queryHistoricalEvents('PlatformFeeCollected', -1000, 'latest');
  console.log('Events:', events.length);
})();
"
```

**Soluciones**:
1. Verificar RPC no esté rate-limited
2. Usar RPC premium (Alchemy/Infura)
3. Aumentar timeout en config

### Webhooks fallan

**Síntomas**: Logs muestran errores de webhook

**Soluciones**:
```bash
# Test Discord
curl -X POST $DISCORD_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '{"content":"Test from server"}'

# Test desde script
node backend/services/notificationService.js
```

---

## 📈 Performance Optimization

### RPC Connection

```javascript
// Usar WebSocket en vez de HTTP (más eficiente)
POLYGON_RPC_URL=wss://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY

// Load balancing con múltiples RPCs
const providers = [
  new ethers.WebSocketProvider(RPC_URL_1),
  new ethers.WebSocketProvider(RPC_URL_2)
];
const provider = new ethers.FallbackProvider(providers);
```

### Database Caching

```javascript
// Cachear stats en Redis
const redis = require('redis');
const client = redis.createClient();

async function getStats() {
  const cached = await client.get('stats');
  if (cached) return JSON.parse(cached);
  
  const stats = await contract.getStats();
  await client.setEx('stats', 60, JSON.stringify(stats)); // 60s TTL
  return stats;
}
```

### Event Processing

```javascript
// Usar queue para procesar eventos (Bull/BullMQ)
const Queue = require('bull');
const eventQueue = new Queue('events', 'redis://localhost:6379');

listener.on('swap-executed', async (data) => {
  await eventQueue.add('process-swap', data);
});

eventQueue.process('process-swap', async (job) => {
  // Procesar evento en background
  await processSwap(job.data);
});
```

---

## ✅ Production Checklist

Antes de lanzar a producción:

### Smart Contract
- [ ] Auditoría completada
- [ ] Deployment a mainnet
- [ ] Contract verified en Polygonscan
- [ ] Roles asignados correctamente
- [ ] Treasury configurada (idealmente multi-sig)
- [ ] Tests pasados (unit + integration)

### Backend
- [ ] Variables de entorno configuradas
- [ ] PM2 con auto-restart habilitado
- [ ] Logs rotation configurado
- [ ] Health checks funcionando
- [ ] Backups automatizados
- [ ] Monitoring activo (Grafana/Datadog)

### Notificaciones
- [ ] Discord webhook testeado
- [ ] Slack webhook testeado (si aplica)
- [ ] Email SMTP configurado
- [ ] Alertas críticas configuradas
- [ ] Reportes diarios programados

### Seguridad
- [ ] Firewall configurado
- [ ] SSH solo con keys
- [ ] SSL certificado instalado
- [ ] API keys rotadas
- [ ] Permisos de archivos correctos
- [ ] Fail2ban habilitado

### Performance
- [ ] RPC premium configurado
- [ ] Database indices creados
- [ ] Caching implementado
- [ ] Load testing completado

### Documentation
- [ ] Runbook actualizado
- [ ] On-call rotation definida
- [ ] Incident response plan
- [ ] Contactos de emergencia

---

## 📞 Support

**Emergency Contacts**:
- DevOps: ops@bezhas.com
- Security: security@bezhas.com
- On-Call: +1-XXX-XXX-XXXX

**Resources**:
- Docs: https://docs.bezhas.com
- Status Page: https://status.bezhas.com
- Slack: #bezhas-ops

---

## 🎯 SLAs y Metrics

### Objetivos

- **Uptime**: 99.9% (8.76h downtime/year máximo)
- **Latency**: <2s para health checks
- **Event Processing**: <30s desde blockchain
- **Notification Delivery**: <1min

### Metrics Clave

```
# Availability
uptime_percentage = (total_time - downtime) / total_time * 100

# Latency
p50_latency < 1s
p95_latency < 2s
p99_latency < 5s

# Throughput
swaps_per_hour > 100
events_processed_per_hour > 500

# Error Rate
error_rate < 0.1%
failed_notifications < 1%
```

---

**¡Sistema listo para producción!** 🚀

*Production Guide v1.0 - Enero 2026*
