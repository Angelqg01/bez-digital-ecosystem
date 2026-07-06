# 📚 Guías de Integración BeZhas

**Todo lo que necesitas para integrar BeZhas en tu plataforma**

---

## 🎯 ¿Por Dónde Empiezo?

### Responde estas preguntas:

1. **¿Tienes una tienda online en WordPress/WooCommerce?**
   → [Guía Plugin WordPress](#plugin-wordpress) (5 minutos)

2. **¿Estás construyendo una app o sitio web custom?**
   → [Guía SDK JavaScript](#sdk-javascript) (30 minutos)

3. **¿Necesitas máximo control desde tu backend?**
   → [Guía API REST](#api-rest) (2-4 horas)

4. **¿Tienes un caso de uso específico?**
   → [Casos de Uso Reales](#casos-de-uso-reales)

---

## 📖 Documentos Disponibles

### 1. **BEZHAS_CLIENT_GUIDE.md** — Guía Completa (Principiante)

**Para:** Cualquier integrador
**Contenido:**
- Visión general de 3 métodos de acceso
- Detalle de cada SubApp (CargoLink, Pay, Capital, Energy, etc.)
- Paso a paso para API REST
- Paso a paso para SDK JavaScript
- Paso a paso para Plugin WordPress
- Autenticación y seguridad
- Webhooks
- FAQ básico

**Tiempo de lectura:** 30 minutos  
**Nivel:** Beginner → Intermediate

→ **Descarga:** [BEZHAS_CLIENT_GUIDE.md](./BEZHAS_CLIENT_GUIDE.md)

---

### 2. **BEZHAS_USE_CASES.md** — Ejemplos Reales (Intermedio)

**Para:** Desarrolladores
**Contenido:**
- 5 casos de uso prácticos:
  1. Tienda WooCommerce (PHP)
  2. ERP corporativo (Node.js)
  3. App React con SDK
  4. Trading de energía (Node.js)
  5. Verificación de identidad
- Código listo para copiar/pegar
- Patrones de integración
- Checklist de seguridad

**Tiempo de lectura:** 20 minutos  
**Nivel:** Intermediate → Advanced

→ **Descarga:** [BEZHAS_USE_CASES.md](./BEZHAS_USE_CASES.md)

---

### 3. **BEZHAS_FAQ_TROUBLESHOOTING.md** — Soporte (Referencia)

**Para:** Todos
**Contenido:**
- 50+ preguntas frecuentes
- Soluciones rápidas
- Troubleshooting paso a paso
- Cuándo contactar soporte
- Recursos de aprendizaje
- Checklist pre-producción

**Tiempo de lectura:** A demanda  
**Nivel:** Todos

→ **Descarga:** [BEZHAS_FAQ_TROUBLESHOOTING.md](./BEZHAS_FAQ_TROUBLESHOOTING.md)

---

## 🚀 Rutas de Aprendizaje

### 🔵 Ruta 1: Sin Código (5 minutos)
Para: Dueños de tiendas WordPress

```
1. Descargar plugin de hub.bez.digital/downloads
2. Instalar en WordPress Admin
3. Pegar API Key en settings
4. ¡Listo!
```

**Referencia:** BEZHAS_CLIENT_GUIDE.md → Guía Plugin WordPress

---

### 🟢 Ruta 2: Rápido (1 hora)
Para: Desarrolladores JavaScript/React

```
1. pnpm add @bezhas/connect
2. Inicializar SDK con API Key
3. Usar bezhas.pay.buy() o bezhas.cargolink.createTx()
4. Verificar webhooks
5. Deploy
```

**Referencia:** 
- BEZHAS_CLIENT_GUIDE.md → Guía SDK JavaScript
- BEZHAS_USE_CASES.md → Caso 3 (App React)

---

### 🔴 Ruta 3: Control Total (4-8 horas)
Para: Backend developers (Node, Python, Java, Go...)

```
1. Obtener API Key
2. Hacer primer request a /health
3. Implementar endpoints (pay, cargolink, etc.)
4. Registrar y verificar webhooks
5. Testing con sandbox
6. Monitorear logs
7. Deploy a producción
```

**Referencia:**
- BEZHAS_CLIENT_GUIDE.md → Guía API REST
- BEZHAS_USE_CASES.md → Casos 2, 4, 5

---

### 🟡 Ruta 4: Caso Específico (variable)
Para: Situaciones custom

1. Lee BEZHAS_CLIENT_GUIDE.md para contexto
2. Busca tu caso similar en BEZHAS_USE_CASES.md
3. Adapta el código a tu stack
4. Consulta BEZHAS_FAQ_TROUBLESHOOTING.md si hay errores

---

## 📊 Comparación de Métodos

| Aspecto | Plugin WP | SDK JS | API REST |
|---------|-----------|--------|----------|
| **Tiempo Setup** | 5 min | 30 min | 2-4 h |
| **Complejidad** | Muy baja | Baja | Media |
| **Funciones** | Pagos | Pagos + Cargo | Todo |
| **Stack** | PHP | JS/TS | Cualquiera |
| **Ideal para** | Tiendas | SPA | Backends |
| **Costo** | Gratis | Incluido | Pay-per-call |

---

## 🎓 Conceptos Clave

### 🔑 API Key
Tu credencial para acceder a BeZhas desde el backend.
- Generada en: `hub.bez.digital/developers`
- Incluir en header: `x-api-key: bez_key_xxx`
- ⚠️ Nunca commits en código

### 🔐 JWT (JSON Web Token)
Token que recibe el usuario cuando hace login.
- Generado por: `/auth/siwe` o `/auth/email`
- Válido por: 24 horas
- Incluir en header: `Authorization: Bearer <token>`
- Para: Requests que usan contexto de usuario

### 🪝 Webhook
Notificación de BeZhas a tu servidor.
- Eventos: `payment.completed`, `cargo.delivered`, etc.
- Requiere: Verificar firma HMAC-SHA256
- Endpoint: Debe ser HTTPS y responder <5s

### 📦 SubApp
Aplicación especializada dentro de BeZhas.
- 13 total: Pay, CargoLink, Capital, Energy, Genesis, etc.
- Acceso: URL, API, SDK

---

## 🛠️ Stack Técnico Soportado

**Lenguajes:**
- ✅ JavaScript/TypeScript (Node.js, Deno, Bun)
- ✅ Python 3.8+
- ✅ Java 11+
- ✅ C# .NET 6+
- ✅ Go 1.16+
- ✅ PHP 7.4+
- ✅ Ruby 2.7+
- ✅ Rust
- ✅ Cualquier otro (HTTP API)

**Frameworks:**
- ✅ React, Vue, Angular (frontend)
- ✅ Express, Fastify, Hapi (Node.js)
- ✅ Django, FastAPI (Python)
- ✅ Laravel, Symfony (PHP)
- ✅ Spring, Quarkus (Java)
- ✅ ASP.NET (C#)
- ✅ Gin, Echo (Go)

**Platforms:**
- ✅ Cloud: AWS Lambda, Google Cloud, Azure
- ✅ Serverless: Vercel, Netlify, Cloudflare
- ✅ Docker/Kubernetes
- ✅ On-premise (VPS, dedicated)

---

## 📞 Soporte

| Canal | Respuesta | Link |
|-------|-----------|------|
| **Email** | <2h | support@bez.digital |
| **Chat Live** | <30 min | hub.bez.digital/chat |
| **Slack** | <30 min | discord.gg/bezhas |
| **Docs** | 24/7 | hub.bez.digital/docs |

---

## 📋 Roadmap de Aprendizaje

**Día 1:** Elige tu ruta (arriba)  
**Día 1-2:** Lee BEZHAS_CLIENT_GUIDE.md  
**Día 2-3:** Implementa con BEZHAS_USE_CASES.md  
**Día 3-4:** Testing en sandbox  
**Día 4-5:** Consulta BEZHAS_FAQ_TROUBLESHOOTING.md si hay dudas  
**Día 5:** Deploy a producción  

---

## ✅ Checklist: Listo para Producción

- [ ] API Key guardada en `.env`
- [ ] Webhook signature verificada
- [ ] HTTPS en webhook URL
- [ ] Testing en sandbox completado
- [ ] Errores documentados
- [ ] Rate limiting implementado
- [ ] Logs activos
- [ ] Monitoring habilitado
- [ ] Team entrenado
- [ ] SLA de soporte contratado

---

## 🎯 Próximos Pasos

1. **Elige tu ruta** (arriba)
2. **Descarga la guía correspondiente**
3. **Sigue los pasos**
4. **Cuando tengas dudas:** BEZHAS_FAQ_TROUBLESHOOTING.md
5. **Si necesitas ayuda:** support@bez.digital

---

## 📝 Archivo de Versión

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 2.0.0 | Jun 2026 | Nuevas 13 SubApps, SDK público, WP plugin v2 |
| 1.5.0 | Mar 2026 | DeFi capital agregado |
| 1.0.0 | Dic 2025 | Lanzamiento inicial |

---

**¿Preguntas? support@bez.digital**  
**Última actualización: Junio 2026**
