# 🎯 START HERE - Guía de Inicio Rápido

## ¿Acabas de clonar el proyecto? Empieza aquí 👇

### Paso 1: Verificar el Sistema (30 segundos)
```powershell
scripts\check.ps1
```

**¿Todo en verde?** → Continúa al Paso 2  
**¿Hay errores?** → Ver [Solución de Problemas](#solución-de-problemas)

---

### Paso 2: Iniciar los Servicios (1 minuto)
```powershell
scripts\quick-start.ps1
```

Esto abrirá 2 ventanas automáticamente:
- 🟢 **Ventana 1:** Backend (Puerto 3001)
- 🔵 **Ventana 2:** Frontend (Puerto 3000)

---

### Paso 3: Abrir en el Navegador (10 segundos)
```
http://localhost:3000
```

**¡Listo!** Ya estás ejecutando BeZhas Enterprise Platform 🎉

---

## 📚 ¿Qué Sigue?

### Para Desarrolladores
1. 📖 Lee [docs/AI_MANIFESTO.md](docs/AI_MANIFESTO.md) - Guía para la IA y MCP
2. 📖 Lee [docs/system/README_ENTERPRISE.md](docs/system/README_ENTERPRISE.md) - Overview completo
3. 🔧 Lee [docs/LISTO_PARA_USAR.md](docs/LISTO_PARA_USAR.md) - Configuración detallada
4. 🧪 Ejecuta tests: `cd sdk; node test-enterprise-sdk.js`

### Para Deployment
1. 📋 Sigue [docs/reports/DEPLOYMENT_CHECKLIST.md](docs/reports/DEPLOYMENT_CHECKLIST.md)
2. 🔑 Solicita API keys (ver [docs/PROXIMOS_PASOS.md](docs/PROXIMOS_PASOS.md))
3. 🚀 Deploy con Google Cloud Platform (ver [docs/guides/GCP_DEPLOYMENT_GUIDE.md](docs/guides/GCP_DEPLOYMENT_GUIDE.md))

---

## 🛠️ Comandos Útiles

```powershell
# Verificar estado del sistema
scripts\check.ps1

# Iniciar todo (Backend + Frontend)
scripts\quick-start.ps1

# Solo Backend
cd backend
npm start

# Solo Frontend
cd frontend
npm start

# Ejecutar tests del SDK
cd sdk
node test-enterprise-sdk.js

# Ver logs del backend
cat backend/logs/error.log
```

---

## 🔍 Solución de Problemas

### ❌ "Node.js no encontrado"
**Solución:** Instala Node.js desde https://nodejs.org (versión 18+)

### ❌ "Backend no inicia"
**Posibles causas:**
1. MongoDB no está corriendo → Inicia MongoDB o configura MongoDB Atlas
2. Puerto 3001 ocupado → Cierra la aplicación que use ese puerto
3. Archivo .env mal configurado → Revisa `backend/.env`

### ❌ "Frontend no compila"
**Solución:**
```powershell
cd frontend
Remove-Item -Recurse node_modules
npm install
npm start
```

### ❌ "SDK tests fallan"
**Esto es normal si:**
- Backend no está corriendo (errores de conexión)
- No tienes API keys configuradas

**Solución:** Inicia el backend primero con `scripts\quick-start.ps1`

---

## 📞 ¿Necesitas Ayuda?

1. 📚 Revisa la documentación en la carpeta raíz (`*.md` files)
2. 🐛 Abre un issue en GitHub
3. 💬 Contacta al equipo de desarrollo

---

## ✅ Checklist de Verificación

Antes de empezar a desarrollar, verifica que tienes:

- [ ] Node.js instalado (v18+)
- [ ] npm funcionando
- [ ] Backend dependencies instaladas
- [ ] Frontend dependencies instaladas
- [ ] MongoDB configurado (local o Atlas)
- [ ] Archivo .env configurado
- [ ] Puertos 3000 y 3001 disponibles

**¿Todo listo?** → Ejecuta `scripts\quick-start.ps1` y ¡empieza a desarrollar! 🚀

---

## 🎯 Próximos Hitos

### Inmediato (Hoy)
- [ ] Iniciar servicios localmente
- [ ] Explorar el VIP Panel
- [ ] Revisar la documentación

### Corto Plazo (Esta Semana)
- [ ] Solicitar API keys de Stripe (test mode)
- [ ] Configurar MongoDB Atlas
- [ ] Testing completo local

### Medio Plazo (2-4 Semanas)
- [ ] Obtener API keys de Maersk, TNT, Vinted
- [ ] Configurar webhooks
- [ ] Testing de integraciones

### Largo Plazo (1-2 Meses)
- [ ] Deploy a production
- [ ] Launch oficial
- [ ] Onboarding de usuarios

---

**¡Bienvenido a BeZhas Enterprise! 🎊**

_Última actualización: 4 de Enero, 2026_
