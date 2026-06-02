# 🧪 Guía de Pruebas - Admin Dashboard BeZhas

## ✅ Estado del Sistema

### Servidores Activos
- ✅ **Backend**: http://127.0.0.1:3001 (Running)
- ✅ **Frontend**: http://localhost:5173/ (Running)
- ✅ **WebSocket**: ws://localhost:3002 (Ready)
- ⚠️ **Redis**: No conectado (opcional - solo afecta queue de validaciones)

---

## 🎯 Cómo Probar el Admin Dashboard

### 1. Acceder al Panel
**URL**: http://localhost:5173/admin

### 2. Tabs Disponibles

#### 📊 **Tab: Overview (Vista General)**
**Qué probar:**
- [ ] Ver las 4 KPI cards con métricas
  * Total Usuarios
  * Total Posts
  * Transacciones
  * Revenue
- [ ] Verificar el gráfico de línea "Usuarios Activos (Última Semana)"
- [ ] Verificar el gráfico de dona "Distribución de Contenido"
- [ ] Hacer clic en "Exportar Datos" (debe descargar CSV)

**Endpoints involucrados:**
- `GET /api/admin/stats` → Métricas generales

---

#### 👥 **Tab: Users (Gestión de Usuarios)**
**Qué probar:**

**Filtros:**
- [ ] Escribir en el campo "Buscar" (ej: "user")
- [ ] Seleccionar un rol: Admin, User, Moderator
- [ ] Seleccionar un estado: Active, Inactive, Banned
- [ ] Hacer clic en "Exportar" para descargar CSV de usuarios

**Tabla de usuarios:**
- [ ] Ver lista de usuarios con avatares, emails, roles y estados
- [ ] Hacer clic en icono **👁️ (Eye)** para ver detalles
- [ ] Hacer clic en icono **👤 (UserX/UserCheck)** para activar/desactivar
- [ ] Hacer clic en icono **🗑️ (Trash)** para eliminar

**Paginación:**
- [ ] Hacer clic en botones "◀ Previous" y "Next ▶"
- [ ] Hacer clic en números de página (1, 2, 3...)
- [ ] Verificar el contador "Mostrando 1 a 10 de 50 resultados"

**Endpoints involucrados:**
- `GET /api/admin/users?page=1&limit=10&search=...&role=...&status=...`
- `POST /api/admin/users/:id/view`
- `POST /api/admin/users/:id/activate`
- `POST /api/admin/users/:id/deactivate`
- `DELETE /api/admin/users/:id`

---

#### 📝 **Tab: Content (Gestión de Contenido)**
**Estado**: Placeholder implementado

**Qué esperar:**
- Mensaje: "Moderación de posts, reels y artículos pendientes de aprobación"

**Endpoints planificados:**
- `GET /api/admin/content`
- `POST /api/admin/content/:id/approve`
- `POST /api/admin/content/:id/reject`

---

#### 🚨 **Tab: Reports (Sistema de Reportes)**
**Estado**: Placeholder implementado

**Qué esperar:**
- Mensaje: "X reportes pendientes de revisión"

**Endpoints planificados:**
- `GET /api/admin/reports`
- `POST /api/admin/reports/:id/resolve`

---

#### 📜 **Tab: Logs (Logs de Actividad)**
**Qué probar:**
- [ ] Ver lista de acciones administrativas recientes
- [ ] Verificar timestamps con formato local
- [ ] Verificar que muestre el admin que realizó cada acción
- [ ] Realizar alguna acción en otro tab y verificar que aparezca un nuevo log

**Endpoints involucrados:**
- `GET /api/admin/activity-logs?limit=50`
- `POST /api/admin/activity-logs` (automático al realizar acciones)

---

## 🔄 Pruebas de WebSocket (Tiempo Real)

### Cómo probar actualizaciones en vivo:

1. **Abre dos ventanas del navegador** con el Admin Dashboard
2. **En la ventana 1**: Ve al tab "Users"
3. **En la ventana 2**: Mantén el tab "Overview" abierto
4. **En la ventana 1**: Activa/desactiva un usuario
5. **En la ventana 2**: Deberías ver actualización de KPIs en tiempo real

**WebSocket Events:**
```javascript
// Eventos que se envían automáticamente:
- 'stats_update'    → Actualiza métricas del Overview
- 'new_user'        → Notifica nuevo usuario registrado
- 'new_report'      → Notifica nuevo reporte
- 'activity_log'    → Agrega log en tiempo real
```

---

## 📊 Prueba de Exportación CSV

### Pasos:
1. Ve al tab **"Users"**
2. (Opcional) Aplica filtros
3. Haz clic en **"Exportar"**
4. Verifica que se descargue archivo `usuarios_2025-10-14.csv`

### Formato esperado:
```csv
id,username,email,role,status,createdAt,lastLogin
1,admin_user,admin@bez.digital,admin,active,2025-01-10,2025-01-14
2,john_doe,john@example.com,user,active,2025-01-12,2025-01-14
```

---

## 🧪 Testing de Endpoints (Opcional)

### Usando curl o Postman:

#### Obtener estadísticas:
```bash
curl http://localhost:3001/api/admin/stats
```

**Respuesta esperada:**
```json
{
  "totalUsers": 1286,
  "activeUsers": 567,
  "totalPosts": 8901,
  "totalTransactions": 2345,
  "totalRevenue": 12345.67,
  "pendingReports": 23,
  "timestamp": "2025-10-14T..."
}
```

#### Obtener usuarios (con filtros):
```bash
curl "http://localhost:3001/api/admin/users?page=1&limit=10&role=admin"
```

**Respuesta esperada:**
```json
{
  "users": [...],
  "total": 5,
  "page": 1,
  "totalPages": 1
}
```

#### Activar usuario:
```bash
curl -X POST http://localhost:3001/api/admin/users/1/activate
```

---

## 🐛 Troubleshooting

### Problema: "No se ve el Admin Dashboard"
**Solución:**
- Verifica que ambos servidores estén corriendo
- Revisa la consola del navegador (F12) para errores
- Verifica que la URL sea exactamente: http://localhost:5173/admin

### Problema: "Los datos no se cargan"
**Solución:**
- Abre DevTools (F12) → Network tab
- Verifica que las llamadas a `/api/admin/*` respondan con status 200
- Si ves errores CORS, verifica configuración de backend

### Problema: "WebSocket no conecta"
**Solución:**
- Verifica que el backend esté corriendo
- Mira la consola del navegador, debería decir:
  ```
  ✅ WebSocket connected - Real-time updates active
  ```
- Si no conecta, el dashboard seguirá funcionando sin updates en vivo

### Problema: "Errores de Redis en consola del backend"
**Estado:** Normal, no afecta el Admin Dashboard
**Explicación:** Redis solo es necesario para el sistema de validaciones de blockchain
**Solución:** Puedes ignorar estos errores o instalar Redis si lo necesitas

---

## ✅ Checklist de Pruebas Completas

### Frontend
- [ ] Overview tab carga correctamente
- [ ] Users tab muestra tabla de usuarios
- [ ] Content tab muestra mensaje placeholder
- [ ] Reports tab muestra mensaje placeholder
- [ ] Logs tab muestra logs de actividad
- [ ] Navegación entre tabs funciona
- [ ] Gráficos se renderizan correctamente
- [ ] Filtros de búsqueda funcionan
- [ ] Paginación funciona
- [ ] Exportación CSV funciona
- [ ] Botones de acciones responden
- [ ] Dark mode se ve bien

### Backend
- [ ] Servidor arranca sin errores críticos
- [ ] Endpoint `/api/admin/stats` responde
- [ ] Endpoint `/api/admin/users` responde
- [ ] Endpoint `/api/admin/users/:id/activate` funciona
- [ ] Endpoint `/api/admin/users/:id/deactivate` funciona
- [ ] Endpoint `/api/admin/content` responde
- [ ] Endpoint `/api/admin/reports` responde
- [ ] Endpoint `/api/admin/activity-logs` responde
- [ ] WebSocket se conecta correctamente
- [ ] Logs aparecen en consola del servidor

### Integración
- [ ] Frontend se conecta al backend
- [ ] WebSocket funciona en tiempo real
- [ ] Acciones en Users actualizan los logs
- [ ] Exportación descarga archivo CSV válido
- [ ] Paginación obtiene datos del backend
- [ ] Filtros envían query params correctos

---

## 📈 Métricas de Performance

### Expected Load Times:
- **Initial Load**: < 2s
- **API Response**: < 200ms
- **WebSocket Latency**: < 50ms
- **Chart Render**: < 500ms
- **CSV Export**: < 1s

---

## 🎯 Casos de Uso Reales

### Caso 1: Administrador revisa usuarios nuevos
1. Accede al Admin Dashboard
2. Ve el Overview, nota "+12%" en Total Usuarios
3. Va al tab "Users"
4. Filtra por "role: User" y "status: Active"
5. Revisa los usuarios recientes
6. Exporta la lista en CSV para análisis

### Caso 2: Moderador maneja usuario problemático
1. Recibe notificación de reporte
2. Va al tab "Users"
3. Busca el usuario por email
4. Hace clic en "Ver detalles" (👁️)
5. Decide desactivar temporalmente
6. Hace clic en UserX para desactivar
7. Ve el log de actividad confirmando la acción

### Caso 3: Análisis de actividad diaria
1. Abre Admin Dashboard en la mañana
2. Tab "Overview" muestra KPIs del día
3. Gráfico de línea muestra tendencia de la semana
4. Exporta datos de usuarios para reporte semanal
5. Revisa logs para ver acciones de otros admins

---

## 🔐 Notas de Seguridad

**Importante:**
- Todos los endpoints están protegidos con `verifyAdminToken`
- Solo usuarios con rol "admin" pueden acceder
- Todas las acciones se registran en logs de auditoría
- Las eliminaciones son "soft delete" (no borran datos reales)

**Para producción:**
- [ ] Habilitar HTTPS
- [ ] Configurar CORS estricto
- [ ] Implementar rate limiting
- [ ] Agregar 2FA para admins
- [ ] Configurar backups de logs

---

## 📞 Soporte

Si encuentras bugs o tienes preguntas:
1. Revisa esta guía
2. Verifica los logs del servidor backend
3. Abre DevTools en el navegador (F12)
4. Consulta `docs/ADMIN-DASHBOARD-IMPROVEMENTS.md`

---

**¡Disfruta probando el nuevo Admin Dashboard!** 🚀
