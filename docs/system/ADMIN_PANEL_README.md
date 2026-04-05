# 🎯 Admin Panel - BeZhas Web3

## 🚀 Inicio Rápido

### Requisitos Previos
- Node.js 18+
- pnpm
- Backend corriendo en puerto 3000
- Base de datos configurada

### Instalación

```bash
# Instalar dependencias
cd frontend
pnpm install

# Iniciar servidor de desarrollo
pnpm dev
```

### Acceso

1. **URL**: `http://localhost:5173/admin`
2. **Login**: `/admin-login`
3. **Credenciales de prueba**:
   - Email: `admin@bezhas.com`
   - Password: `Admin123!`

---

## 📋 Características Principales

### ✅ Completado

- [x] **Dashboard Principal** con KPIs en tiempo real
- [x] **Sistema de Telemetría** integrado en todas las páginas
- [x] **Panel de Analíticas** con gráficas y visualizaciones
- [x] **Gestión de Usuarios** con filtros y acciones masivas
- [x] **Chat IA Aegis** para consultas administrativas
- [x] **Panel de Acciones** con auto-healing
- [x] **Gestión de Tesorería** Web3
- [x] **Sistema de Logs** con filtrado
- [x] **Autenticación y Autorización** robusta

---

## 🏗️ Estructura del Proyecto

```
frontend/src/
├── pages/
│   └── AdminDashboard.jsx          # Página principal (939 líneas)
├── components/
│   └── admin/
│       ├── StatCard.jsx            # Tarjetas de KPIs
│       ├── UserCard.jsx            # Tarjetas de usuarios
│       ├── ActivityCard.jsx        # Tarjetas de actividad
│       ├── TreasuryManagement.jsx  # Gestión de tesorería
│       ├── TelemetryAnalyticsPanel.jsx  # Panel de telemetría y ML
│       ├── AdminAegisChatPanel.jsx      # Chat con IA Aegis
│       └── AdminAegisActionsPanel.jsx   # Panel de acciones admin
├── utils/
│   └── telemetry.js                # Sistema de telemetría
└── layouts/
    └── AdminLayout.jsx             # Layout con sidebar

backend/
├── routes/
│   ├── admin-panel.routes.js      # Endpoints para panel admin
│   ├── telemetry.routes.js        # Endpoints de telemetría
│   └── aegis.routes.js            # Proxy a servicio Aegis
└── middleware/
    ├── auth.middleware.js         # Autenticación JWT
    └── admin.middleware.js        # Verificación de roles
```

---

## 🎨 Tabs y Funcionalidades

### 1. 📊 Resumen (Dashboard)
- **KPIs principales**: Usuarios, Posts, Grupos, Usuarios Activos 24h
- **Panel de Telemetría**: Eventos, errores, navegación, performance
- **Chat Aegis**: Asistente IA para consultas
- **Panel de Acciones**: Auto-healing y optimización

### 2. 💰 Tesorería
- **Conexión Web3**: Gestión de contratos inteligentes
- **Balances**: Visualización de saldos de todos los contratos
- **Transacciones**: Historial y ejecución de operaciones

### 3. 📈 Analíticas
- **KPIs detallados**: Métricas avanzadas de la plataforma
- **Timeline**: Gráfica de actividad de últimos 7 días
- **Distribución**: Pie chart de distribución de tokens

### 4. 👥 Usuarios
- **Listado completo**: Tabla con paginación
- **Filtros**: Por rol, verificación, estado
- **Búsqueda**: En tiempo real por username/email
- **Acciones**: Verificar, suspender, editar
- **Acciones masivas**: Operaciones bulk

### 5. 📝 Actividad
- **Log de eventos**: En tiempo real
- **Filtros**: Por tipo de evento
- **Detalles**: Timestamp, usuario, acción

### 6. 🗂️ Contenido
- **Moderación**: Revisión de posts
- **NFTs**: Gestión de marketplace
- **Reportes**: Revisión de reportes de usuarios

### 7. ⚙️ Sistema
- **Estado**: Uptime, versión, salud
- **Hardware**: CPU, memoria, disco
- **Logs**: Con filtrado por nivel (error, warn, info)

---

## 🔒 Seguridad

### Autenticación
- JWT con expiración de 24 horas
- Refresh tokens para sesiones largas
- Almacenamiento seguro en httpOnly cookies

### Autorización
- Verificación de rol admin en cada request
- Middleware de autorización en todas las rutas
- Rate limiting para prevenir abuso

### Validación
- Sanitización de inputs
- Protección contra SQL injection
- Protección contra XSS
- CSRF tokens implementados

---

## 📡 API Endpoints

### Admin Panel
```http
GET  /api/admin/stats                    # KPIs generales
GET  /api/admin/users/recent             # Usuarios recientes
GET  /api/admin/activity/recent          # Actividad reciente
GET  /api/admin-panel/analytics/overview # Overview de analíticas
GET  /api/admin-panel/analytics/timeline # Timeline de actividad
GET  /api/admin-panel/system/health      # Estado del sistema
GET  /api/admin-panel/system/logs        # Logs del sistema
```

### Telemetría
```http
POST /api/telemetry/events               # Enviar eventos
GET  /api/telemetry/events               # Obtener eventos
POST /api/telemetry/flush                # Limpiar eventos
```

### Aegis (IA)
```http
POST /api/aegis/chat                     # Chat con IA
POST /api/aegis/admin-action             # Ejecutar acción admin
```

### Gestión de Usuarios
```http
GET  /api/admin-panel/users/list         # Listar usuarios
POST /api/admin/users/:id/verify         # Verificar usuario
POST /api/admin/users/:id/suspend        # Suspender usuario
POST /api/admin-panel/users/bulk-action  # Acción masiva
```

---

## 🧪 Testing

### Ejecutar Tests
```bash
# Tests unitarios
pnpm test

# Tests de integración
pnpm test:integration

# Tests E2E
pnpm test:e2e

# Coverage
pnpm test:coverage
```

### Pruebas Manuales
Ver `ADMIN_PANEL_TESTING.md` para checklist completo de pruebas.

---

## 📚 Documentación

- **Documentación Completa**: `ADMIN_PANEL_DOCUMENTATION.md`
- **Guía de Pruebas**: `ADMIN_PANEL_TESTING.md`
- **Changelog**: Ver commits en `git log`

---

## 🐛 Troubleshooting

### El panel no se carga
```bash
# Verificar backend
curl http://localhost:3000/api/admin/stats

# Verificar .env
cat frontend/.env | grep VITE_API_URL
```

### KPIs muestran 0
```bash
# Verificar datos en DB
psql -U postgres -d bezhas_db -c "SELECT COUNT(*) FROM users;"
```

### Chat Aegis no responde
```bash
# Verificar servicio Aegis
curl http://localhost:8000/health

# Ver logs
docker logs aegis-service
```

Ver más en sección de Troubleshooting de `ADMIN_PANEL_TESTING.md`.

---

## 🚀 Deployment

### Frontend
```bash
# Build para producción
cd frontend
pnpm build

# Preview
pnpm preview
```

### Backend
```bash
# Build
cd backend
npm run build

# Start en producción
NODE_ENV=production npm start
```

### Docker
```bash
# Build y deploy con docker-compose
docker-compose up --build -d
```

---

## 🔄 Actualizaciones Recientes

### v1.0.0 (2025-10-22)
- ✅ Implementación completa del Panel de Administración
- ✅ Integración de sistema de telemetría
- ✅ Chat IA Aegis funcional
- ✅ Panel de acciones con auto-healing
- ✅ Gestión completa de usuarios
- ✅ Analíticas avanzadas con gráficas
- ✅ Documentación completa

---

## 👥 Equipo

**Desarrollado por**: Equipo BeZhas  
**Mantenido por**: @YourUsername  
**Contribuidores**: Ver `CONTRIBUTORS.md`

---

## 📝 Licencia

MIT License - Ver `LICENSE` para más detalles.

---

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama: `git checkout -b feature/nueva-funcionalidad`
3. Commit: `git commit -m 'Agregar nueva funcionalidad'`
4. Push: `git push origin feature/nueva-funcionalidad`
5. Abre un Pull Request

---

## 📞 Soporte

- **Email**: support@bezhas.com
- **Discord**: [BeZhas Community](https://discord.gg/bezhas)
- **Docs**: [docs.bezhas.com](https://docs.bezhas.com)
- **Issues**: [GitHub Issues](https://github.com/bezhas/bezhas-web3/issues)

---

## ⭐ Agradecimientos

Gracias a todos los contribuidores y la comunidad BeZhas por hacer este proyecto posible.

**¡Disfruta del Panel de Administración BeZhas!** 🎉
