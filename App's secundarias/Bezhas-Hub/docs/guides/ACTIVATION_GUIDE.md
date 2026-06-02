# 🚀 Guía de Activación del Sistema de Seguridad BeZhas

## 📋 Pasos Completados

✅ **Dependabot configurado** - Chequeos diarios automáticos  
✅ **SecurityMonitor.js** - Escaneo de GitHub Security Advisories  
✅ **SecurityNotifier.js** - Alertas automáticas cada 12 horas con cron  
✅ **Scripts de gestión** - Comandos fáciles de usar

---

## 🔧 Paso 1: Configurar Discord Webhook

### Opción A: Crear Webhook en Discord

1. **Unirse al servidor Discord**
   ```
   https://discord.gg/wrGJzP7tr
   ```

2. **Crear canal para alertas**
   - Nombre recomendado: `#seguridad-bezhas` o `#security-alerts`
   - Configurar permisos para que solo administradores puedan escribir

3. **Crear Webhook**
   - Click derecho en el canal → Editar Canal
   - Integraciones → Webhooks → Nuevo Webhook
   - Nombre: `BeZhas Security Sentinel`
   - Avatar: Logo de BeZhas (opcional)
   - **Copiar URL del Webhook**
   
   La URL debe verse así:
   ```
   https://discord.com/api/webhooks/1234567890/ABCDEFGHIJK...
   ```

4. **Configurar variables de entorno**

   Actualiza estos archivos con la URL real del webhook:

   **`.env` (raíz del proyecto):**
   ```bash
   DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/TU_WEBHOOK_ID/TU_TOKEN"
   ```

   **`backend/.env`:**
   ```bash
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/TU_WEBHOOK_ID/TU_TOKEN
   ```

   **`scripts/.env`:**
   ```bash
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/TU_WEBHOOK_ID/TU_TOKEN
   ```

### Opción B: Configurar Telegram (Opcional)

1. **Crear Bot de Telegram**
   - Habla con [@BotFather](https://t.me/botfather)
   - Envía `/newbot` y sigue las instrucciones
   - Guarda el token que te da

2. **Obtener Chat ID**
   - Agrega el bot a un grupo
   - Envía un mensaje en el grupo
   - Visita: `https://api.telegram.org/bot<TU_TOKEN>/getUpdates`
   - Copia el `chat.id` del JSON

3. **Configurar en `.env`:**
   ```bash
   TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
   TELEGRAM_SECURITY_CHAT_ID=-1001234567890
   ```

---

## 🧪 Paso 2: Probar la Configuración

### Verificar Discord

```bash
cd scripts
npm run test-discord
```

**Resultado esperado:**
```
✅ SUCCESS! Discord webhook is working correctly
📬 Test message sent to Discord channel
🎉 Security monitoring system is ready to send alerts!
```

Si ves esto en Discord, ¡perfecto! ✅

### Probar Escaneo Manual

```bash
npm run security-check
```

Esto ejecutará un escaneo único y generará un reporte.

---

## 🚀 Paso 3: Activar el Monitoreo Continuo

### Método 1: Usando PowerShell (Recomendado para Windows)

```powershell
# Iniciar el servicio en segundo plano
cd scripts
.\sentinel.ps1

# Ver estado
.\sentinel.ps1 -Status

# Ver logs en tiempo real
.\sentinel.ps1 -Logs

# Detener el servicio
.\sentinel.ps1 -Stop
```

### Método 2: Usando Node.js directamente

```bash
cd scripts
npm run start-sentinel
```

Esto iniciará el monitoreo en primer plano. Para segundo plano:

**Linux/Mac:**
```bash
npm run start-sentinel &
```

**Windows (con PM2):**
```bash
npm install -g pm2
pm2 start scripts/securityNotifier.js --name bezhas-security
pm2 logs bezhas-security
pm2 stop bezhas-security
```

### Método 3: Ejecutar como tarea programada del sistema

**Windows (Task Scheduler):**
1. Abre "Programador de tareas"
2. Crear tarea básica
3. Nombre: "BeZhas Security Sentinel"
4. Desencadenador: Al inicio del sistema
5. Acción: Ejecutar programa
   - Programa: `node.exe`
   - Argumentos: `D:\...\bezhas-web3\scripts\securityNotifier.js`

**Linux (systemd):**
```bash
# Crear servicio
sudo nano /etc/systemd/system/bezhas-security.service

[Unit]
Description=BeZhas Security Sentinel
After=network.target

[Service]
Type=simple
User=tu-usuario
WorkingDirectory=/path/to/bezhas-web3/scripts
ExecStart=/usr/bin/node securityNotifier.js
Restart=always

[Install]
WantedBy=multi-user.target

# Activar
sudo systemctl enable bezhas-security
sudo systemctl start bezhas-security
sudo systemctl status bezhas-security
```

---

## 🔐 Paso 4: Configurar GitHub Secrets (Para CI/CD)

1. **Ve a tu repositorio en GitHub**
   ```
   https://github.com/TU_USUARIO/bezhas-web3
   ```

2. **Settings → Secrets and variables → Actions**

3. **New repository secret**

   Nombre: `DISCORD_SECURITY_WEBHOOK`  
   Valor: `https://discord.com/api/webhooks/...` (tu webhook real)

4. **Verificar que Dependabot tiene acceso**
   - Settings → Code security and analysis
   - Habilitar: "Dependabot alerts"
   - Habilitar: "Dependabot security updates"

---

## ✅ Paso 5: Verificación Final

### Checklist de Activación

- [ ] Webhook de Discord creado y configurado
- [ ] Variables de entorno actualizadas (.env, backend/.env, scripts/.env)
- [ ] `npm run test-discord` ejecutado exitosamente
- [ ] `npm run security-check` ejecutado sin errores
- [ ] Sentinel iniciado (PowerShell o Node.js)
- [ ] GitHub Secrets configurados
- [ ] Dependabot habilitado en GitHub

### Pruebas Finales

```bash
cd scripts

# 1. Probar Discord
npm run test-discord

# 2. Escaneo manual completo
npm run full-audit

# 3. Ver si hay alertas nuevas
npm run security-notifier
```

---

## 📊 Monitoreo del Sistema

### Ver Logs

```bash
# PowerShell
cd scripts
.\sentinel.ps1 -Logs

# O manualmente
Get-Content scripts/security-sentinel.log -Tail 50 -Wait
```

### Ver Reportes

```bash
# Último reporte de seguridad
cat scripts/security-alerts.json

# Reporte de dependencias
ls scripts/reports/
```

### Comandos Útiles

```bash
cd scripts

# Test de conexión Discord
npm run test-discord

# Escaneo único de vulnerabilidades
npm run security-check

# Chequeo de dependencias desactualizadas
npm run dependency-check

# Auditoría completa
npm run full-audit

# Iniciar monitoreo continuo
npm run start-sentinel
```

---

## 🚨 Qué Esperar

### Alertas de Seguridad

El sistema enviará alertas a Discord cuando detecte:

1. **Vulnerabilidades CRÍTICAS** en:
   - React / React-DOM
   - Ethers.js / Wagmi / Viem
   - Express / Node.js
   - Solidity / OpenZeppelin
   - Next.js

2. **Vulnerabilidades HIGH** en los mismos paquetes

3. **Nuevos CVEs** que afecten tu stack tecnológico

### Ejemplo de Alerta

```
🚨 ALERTA DE SEGURIDAD: Critical XSS in react-dom

Se ha detectado una vulnerabilidad crítica en un componente del stack.

Ecosistema: NPM
Severidad: CRITICAL

CVE ID: CVE-2024-12345
CVSS Score: 9.8
Publicado: 10/12/2025

Paquetes Afectados:
• react-dom (>=16.0.0 <18.2.5)

[Ver Detalles]

BeZhas Security Sentinel
```

### Pull Requests de Dependabot

Recibirás PRs automáticos cuando:

- Hay actualizaciones de seguridad disponibles
- Nuevas versiones de paquetes críticos
- Parches para vulnerabilidades conocidas

**Políticas:**
- ✅ **Patch updates (1.0.0 → 1.0.1)**: Auto-merge
- ⚠️ **Minor updates (1.0.0 → 1.1.0)**: Revisión manual
- 🔴 **Major updates (1.0.0 → 2.0.0)**: Revisión manual obligatoria

---

## 🔧 Troubleshooting

### Error: "Webhook not found"

```bash
# Verificar que la URL del webhook sea correcta
cd scripts
cat .env | grep DISCORD
```

Si la URL es correcta, verifica que el webhook no haya sido eliminado en Discord.

### Error: "No se configuró ningún webhook"

```bash
# Crear archivo .env si no existe
cd scripts
echo 'DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...' > .env
```

### El Sentinel no se inicia

```bash
# Verificar que Node.js está instalado
node --version

# Verificar que las dependencias están instaladas
cd scripts
npm install

# Ver logs de error
cat security-sentinel.log
```

### No recibo alertas

```bash
# Verificar que el webhook funciona
npm run test-discord

# Verificar que el sentinel está corriendo
# PowerShell:
.\sentinel.ps1 -Status

# Verificar que hay vulnerabilidades detectadas
npm run security-check
```

---

## 📚 Documentación Adicional

- **Sistema completo:** `SECURITY_SYSTEM_README.md`
- **Setup Discord:** `DISCORD_WEBHOOK_SETUP.md`
- **Resumen ejecutivo:** `DEVOPS_IMPLEMENTATION_SUMMARY.md`

---

## 🎯 Próximos Pasos

Una vez activado el sistema:

1. **Revisar PRs de Dependabot** semanalmente
2. **Responder a alertas críticas** en < 24 horas
3. **Actualizar políticas** según necesidades del equipo
4. **Expandir monitoreo** a otros repositorios

---

## 📞 Soporte

**¿Problemas con la activación?**

1. Lee esta guía completa
2. Ejecuta `npm run test-discord`
3. Revisa los logs: `cat scripts/security-sentinel.log`
4. Contacta en Discord: https://discord.gg/wrGJzP7tr
5. Abre un issue en GitHub con label `security`

---

## ✅ Confirmación de Activación

Una vez completados todos los pasos, deberías ver:

```bash
✅ Discord webhook configurado y funcionando
✅ Security Sentinel ejecutándose
✅ Dependabot activo en GitHub
✅ GitHub Actions ejecutándose correctamente
✅ Reportes generándose automáticamente
```

**¡Sistema de seguridad BeZhas operacional 24/7!** 🎉

---

**Última actualización:** 10 de Diciembre, 2025  
**Versión:** 1.0.0  
**Estado:** Listo para producción
