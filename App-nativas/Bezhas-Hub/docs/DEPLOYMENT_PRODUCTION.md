# 🚀 Guía de Deployment a Producción - BeZhas Web3

## 📋 Pre-requisitos

Antes de desplegar, asegúrate de tener:

- ✅ Servidor VPS (DigitalOcean, AWS EC2, Google Cloud, etc.) con:
  - Ubuntu 22.04 LTS o superior
  - Mínimo 4GB RAM
  - 50GB de almacenamiento SSD
  - Docker y Docker Compose instalados
- ✅ Dominio registrado y apuntando a tu servidor
- ✅ Certificado SSL (Let's Encrypt recomendado)
- ✅ API Keys de servicios externos (Pinata, OpenAI, Stripe, etc.)

---

## 🔧 Paso 1: Configuración del Servidor

### 1.1 Conectar al servidor
```bash
ssh root@your-server-ip
```

### 1.2 Instalar Docker
```bash
# Actualizar sistema
apt update && apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Instalar Docker Compose
apt install docker-compose -y

# Verificar instalación
docker --version
docker-compose --version
```

### 1.3 Configurar Firewall
```bash
# Permitir puertos necesarios
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable
```

---

## 📦 Paso 2: Clonar y Configurar el Proyecto

### 2.1 Clonar repositorio
```bash
cd /opt
git clone https://github.com/YOUR_USERNAME/bezhas-web3.git
cd bezhas-web3
```

### 2.2 Configurar variables de entorno
```bash
# Copiar el ejemplo de producción
cp .env.production.example .env.production

# Editar con tus valores reales
nano .env.production
```

**IMPORTANTE**: Cambia TODOS los valores de ejemplo:
- ✅ Contraseñas de bases de datos
- ✅ JWT_SECRET (genera uno con: `openssl rand -base64 64`)
- ✅ Private keys de blockchain
- ✅ API keys de servicios externos

---

## 🏗️ Paso 3: Build y Deploy con Docker

### 3.1 Build de las imágenes
```bash
# Build de todas las imágenes
docker-compose -f docker-compose.production.yml build
```

### 3.2 Iniciar servicios
```bash
# Iniciar en modo detached (background)
docker-compose -f docker-compose.production.yml up -d

# Ver logs
docker-compose -f docker-compose.production.yml logs -f
```

### 3.3 Verificar que todo está corriendo
```bash
# Ver estado de contenedores
docker-compose -f docker-compose.production.yml ps

# Debería mostrar:
# backend       Running (healthy)
# frontend      Running (healthy)
# mongo         Running (healthy)
# redis         Running (healthy)
# timescaledb   Running (healthy)
```

---

## 🔒 Paso 4: Configurar SSL con Let's Encrypt

### 4.1 Instalar Certbot
```bash
apt install certbot python3-certbot-nginx -y
```

### 4.2 Obtener certificado
```bash
# Detener Nginx temporalmente
docker-compose -f docker-compose.production.yml stop frontend

# Obtener certificado
certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Reiniciar frontend
docker-compose -f docker-compose.production.yml start frontend
```

### 4.3 Configurar renovación automática
```bash
# Agregar cron job
crontab -e

# Agregar esta línea (renovar cada 60 días a las 3 AM):
0 3 */60 * * certbot renew --quiet && docker-compose -f /opt/bezhas-web3/docker-compose.production.yml restart frontend
```

---

## 🗄️ Paso 5: Migración de Base de Datos (Si aplica)

Si vienes de un entorno de desarrollo con datos existentes:

```bash
# Backup de MongoDB local
mongodump --db bezhas --out ./backup

# Copiar backup al servidor
scp -r ./backup root@your-server-ip:/opt/bezhas-web3/

# En el servidor, restaurar
docker exec -i bezhas-web3_mongo_1 mongorestore --db bezhas /backup/bezhas
```

---

## 📊 Paso 6: Monitoreo y Logs

### 6.1 Ver logs en tiempo real
```bash
# Todos los servicios
docker-compose -f docker-compose.production.yml logs -f

# Solo backend
docker-compose -f docker-compose.production.yml logs -f backend

# Solo frontend
docker-compose -f docker-compose.production.yml logs -f frontend
```

### 6.2 Configurar alertas (Opcional)
Configura el webhook de Discord en `.env.production`:
```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK
```

---

## 🔄 Paso 7: Actualizar la Aplicación

Cuando hagas cambios en el código:

```bash
cd /opt/bezhas-web3

# Pull latest changes
git pull origin main

# Rebuild y restart
docker-compose -f docker-compose.production.yml up -d --build

# Verificar
docker-compose -f docker-compose.production.yml ps
```

---

## 🆘 Troubleshooting

### Problema: Backend no conecta a MongoDB
**Solución**:
```bash
# Verificar que MongoDB está corriendo
docker-compose -f docker-compose.production.yml logs mongo

# Verificar conectividad
docker exec -it bezhas-web3_backend_1 ping mongo
```

### Problema: Frontend muestra "Cannot connect to backend"
**Solución**:
1. Verifica que el backend esté corriendo: `curl http://localhost:3001/api/health`
2. Revisa la configuración de proxy en `frontend/nginx.conf`

### Problema: "Out of memory"
**Solución**:
```bash
# Agregar swap
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

---

## 🎯 Checklist Final

Antes de ir a producción, verifica:

- [ ] Todas las contraseñas cambiadas de los valores por defecto
- [ ] SSL configurado correctamente
- [ ] Backup automático configurado
- [ ] Logs rotando correctamente (no llenan disco)
- [ ] Firewall configurado
- [ ] Monitoreo activo (Discord/Sentry)
- [ ] Smart contracts desplegados en Polygon Mainnet
- [ ] Variables de entorno verificadas
- [ ] Health checks funcionando: `curl http://localhost:3001/api/health`
- [ ] Frontend accesible: `https://yourdomain.com`

---

## 📞 Soporte

Si encuentras problemas, revisa:
1. [documentation/06_TROUBLESHOOTING.md](documentation/06_TROUBLESHOOTING.md)
2. Logs de Docker: `docker-compose logs`
3. GitHub Issues del proyecto

**¡Listo para producción! 🎉**
