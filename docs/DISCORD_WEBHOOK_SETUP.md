# 🔔 Discord Webhook Setup Guide

## ⚠️ Important Notice

La URL proporcionada (`https://discord.gg/wrGJzP7tr`) es un **enlace de invitación** al servidor de Discord, no un webhook.

Para recibir alertas de seguridad, necesitas crear un **Webhook** en el servidor.

---

## 📋 Paso a Paso: Crear Webhook de Discord

### 1. Acceder al Servidor
- Abre Discord y únete al servidor usando: `https://discord.gg/wrGJzP7tr`

### 2. Abrir Configuración del Servidor
- Click derecho en el nombre del servidor (arriba a la izquierda)
- Selecciona **"Configuración del servidor"** (Server Settings)

### 3. Crear Webhook
1. En el menú lateral, click en **"Integraciones"** (Integrations)
2. Click en **"Webhooks"**
3. Click en **"Nuevo Webhook"** (New Webhook)
4. Configura el webhook:
   ```
   Nombre: BeZhas Security Alerts
   Canal: #security-alerts (o el canal que prefieras)
   Avatar: (opcional, puedes usar el logo de BeZhas)
   ```

### 4. Copiar URL del Webhook
- Click en **"Copiar URL del Webhook"** (Copy Webhook URL)
- La URL debe verse así:
  ```
  https://discord.com/api/webhooks/1234567890/ABCDEFGHIJK...
  ```

### 5. Configurar Variables de Entorno

Actualiza los siguientes archivos con la URL del webhook:

#### A. `.env` (raíz del proyecto)
```bash
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/TU_WEBHOOK_ID/TU_WEBHOOK_TOKEN"
```

#### B. `backend/.env`
```bash
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/TU_WEBHOOK_ID/TU_WEBHOOK_TOKEN
```

#### C. `scripts/.env`
```bash
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/TU_WEBHOOK_ID/TU_WEBHOOK_TOKEN
```

#### D. GitHub Secrets (para CI/CD)
1. Ve a tu repositorio en GitHub
2. Settings > Secrets and Variables > Actions
3. Click **"New repository secret"**
4. Nombre: `DISCORD_SECURITY_WEBHOOK`
5. Valor: `https://discord.com/api/webhooks/TU_WEBHOOK_ID/TU_WEBHOOK_TOKEN`

---

## 🧪 Probar la Conexión

Una vez configurado el webhook, ejecuta:

```bash
cd scripts
npm run test-discord
```

Si todo está correcto, verás:
```
✅ SUCCESS! Discord webhook is working correctly
📬 Test message sent to Discord channel
🎉 Security monitoring system is ready to send alerts!
```

Y recibirás un mensaje de prueba en el canal de Discord configurado.

---

## 📊 Ejemplo de Alerta

Las alertas de seguridad se verán así:

```
🚨 Security Advisory: GHSA-xxxx-xxxx-xxxx
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Summary: Critical XSS vulnerability in react-dom

Severity: CRITICAL
CVSS Score: 9.8
Published: 2025-01-15

Affected Packages:
• react-dom (>=16.0.0 <18.2.1)

Patched Version: 18.2.1

[View Details]
```

---

## 🔒 Seguridad del Webhook

### ⚠️ Importante:
- **NO compartas la URL del webhook públicamente**
- **NO la commits a Git** (usa `.env` que está en `.gitignore`)
- Si el webhook se filtra, elimínalo y crea uno nuevo

### Permisos Recomendados:
- El webhook solo necesita permisos para enviar mensajes
- No requiere permisos de administrador
- Puede limitarse a un canal específico

---

## 🔧 Troubleshooting

### Error: "Webhook not found (404)"
- El webhook fue eliminado o la URL es incorrecta
- Crea un nuevo webhook y actualiza las variables de entorno

### Error: "Connection error"
- Verifica tu conexión a internet
- Asegúrate de que la URL del webhook es válida
- Comprueba que Discord no esté bloqueado por firewall

### No recibo alertas
- Verifica que el webhook esté configurado en todas las variables de entorno
- Ejecuta `npm run test-discord` para probar la conexión
- Revisa que el canal de Discord esté accesible

---

## 📚 Recursos Adicionales

- [Documentación oficial de Discord Webhooks](https://discord.com/developers/docs/resources/webhook)
- [SECURITY_SYSTEM_README.md](./SECURITY_SYSTEM_README.md) - Documentación completa del sistema
- [GitHub Actions Security Audit](./.github/workflows/security-audit.yml) - Workflow completo

---

## 📞 Contacto

Si tienes problemas configurando el webhook, contacta al equipo de DevSecOps:
- Discord: https://discord.gg/wrGJzP7tr
- GitHub Issues: Crea un issue con la etiqueta `security`

---

**Estado Actual:** ⚠️ Webhook pendiente de configuración  
**Acción Requerida:** Crear webhook siguiendo los pasos anteriores  
**Prioridad:** Alta (necesario para alertas de seguridad)
