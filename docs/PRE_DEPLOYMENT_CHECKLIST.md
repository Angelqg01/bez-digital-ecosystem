# 🎯 Checklist de Pre-Deployment - BeZhas Web3

## ✅ Verificación de Código

- [ ] **Backend**
  - [ ] Rutas de logística implementadas (`/api/logistics-web3/update/:id`)
  - [ ] Rutas de upload habilitadas (`/api/upload`)
  - [ ] Health check endpoint funcionando (`/api/health`)
  - [ ] Todas las variables de entorno documentadas
  - [ ] Rate limiting configurado
  - [ ] CORS configurado correctamente

- [ ] **Frontend**
  - [ ] Build de producción exitoso (`npm run build`)
  - [ ] Variables de entorno de producción configuradas
  - [ ] Rutas de React Router funcionando
  - [ ] Conexión a backend verificada

- [ ] **Smart Contracts**
  - [ ] Contratos compilados sin errores
  - [ ] Tests pasando (>80% coverage recomendado)
  - [ ] Contratos verificados en Polygonscan
  - [ ] Addresses documentadas en `.env.production`

---

## 🔒 Seguridad

- [ ] **Credenciales**
  - [ ] Todas las contraseñas cambiadas de valores por defecto
  - [ ] JWT_SECRET generado de forma segura (64+ caracteres)
  - [ ] Private keys de blockchain en lugar seguro
  - [ ] API keys de servicios externos configuradas
  - [ ] Archivo `.env.production` NUNCA en Git

- [ ] **Configuración**
  - [ ] Helmet configurado en backend
  - [ ] Rate limiting activo
  - [ ] HTTPS configurado (SSL)
  - [ ] CORS restringido a dominios autorizados
  - [ ] MongoDB con autenticación habilitada

---

## 🗄️ Base de Datos

- [ ] **MongoDB**
  - [ ] Índices creados en colecciones principales
  - [ ] Backup automático configurado
  - [ ] Autenticación habilitada
  - [ ] Conexión cifrada (TLS)

- [ ] **Redis**
  - [ ] Configurado para persistencia (AOF)
  - [ ] Contraseña configurada
  - [ ] Tamaño de memoria limitado

---

## 🌐 Infraestructura

- [ ] **Servidor**
  - [ ] Docker instalado (>= 20.10)
  - [ ] Docker Compose instalado (>= 2.0)
  - [ ] Firewall configurado (puertos 22, 80, 443)
  - [ ] Swap configurado (mínimo 2GB)
  - [ ] Espacio en disco suficiente (>50GB libre)

- [ ] **Dominio y SSL**
  - [ ] Dominio apuntando al servidor (DNS configurado)
  - [ ] Certificado SSL instalado
  - [ ] Renovación automática configurada (certbot cron)

- [ ] **Monitoreo**
  - [ ] Logs configurados para rotación
  - [ ] Alertas de Discord/Telegram configuradas
  - [ ] Health checks funcionando

---

## 📦 Deployment

- [ ] **Docker**
  - [ ] `docker-compose.production.yml` configurado
  - [ ] `.env.production` completo y validado
  - [ ] Dockerfiles optimizados (multi-stage builds)
  - [ ] Health checks en todos los servicios

- [ ] **Testing Pre-Deploy**
  - [ ] Build local exitoso
  - [ ] Tests E2E pasando
  - [ ] Conexión a blockchain testnet funcionando
  - [ ] Todas las funcionalidades críticas verificadas

---

## 🚀 Post-Deployment

- [ ] **Verificación Inicial**
  - [ ] Todos los contenedores corriendo (`docker-compose ps`)
  - [ ] Frontend accesible en `https://tudominio.com`
  - [ ] Backend respondiendo en `/api/health`
  - [ ] MongoDB accesible internamente
  - [ ] Redis respondiendo

- [ ] **Testing en Producción**
  - [ ] Login de usuarios funcional
  - [ ] Creación de posts funcional
  - [ ] Conexión de wallet funcional
  - [ ] Transacciones blockchain exitosas
  - [ ] Upload de imágenes funcional

- [ ] **Monitoreo**
  - [ ] Logs sin errores críticos
  - [ ] CPU y memoria en niveles normales
  - [ ] Disco con espacio suficiente
  - [ ] Alertas de Discord funcionando

---

## 📊 Métricas de Éxito

Después de 24 horas en producción, verifica:

- [ ] Uptime > 99.5%
- [ ] Tiempo de respuesta API < 500ms (promedio)
- [ ] Sin errores 5xx en logs
- [ ] Uso de memoria < 80%
- [ ] Uso de CPU < 70%
- [ ] Espacio en disco > 20% libre

---

## 🆘 Plan de Rollback

En caso de problemas críticos:

```bash
# 1. Detener servicios
docker-compose -f docker-compose.production.yml down

# 2. Restaurar versión anterior
git checkout <commit-anterior>

# 3. Rebuild y restart
docker-compose -f docker-compose.production.yml up -d --build

# 4. Verificar
docker-compose ps
```

---

## 📞 Contactos de Emergencia

- **DevOps**: [Nombre] - [Email/Teléfono]
- **Backend Dev**: [Nombre] - [Email/Teléfono]
- **Frontend Dev**: [Nombre] - [Email/Teléfono]
- **Blockchain Dev**: [Nombre] - [Email/Teléfono]

---

**Última revisión**: {{ Fecha del deployment }}
**Aprobado por**: {{ Nombre del responsable }}
