# 🔌 Sistema de Gestión de Plugins - BeZhas

## 📋 Descripción General

El **Sistema de Gestión de Plugins** es una funcionalidad avanzada del Panel de Administración que permite a los administradores gestionar las actualizaciones de plugins del sistema de manera inteligente, con recomendaciones de IA y control granular de versiones.

## 🎯 Características Principales

### ✅ Gestión Completa de Versiones
- **Vista general** de todos los plugins instalados
- **Estado en tiempo real** de cada plugin (actualizado, pendiente, error)
- **Historial de versiones** con changelog detallado
- **Identificación de versiones estables** y experimentales

### 🤖 Recomendaciones de IA
- **Análisis automático** de actualizaciones mediante IA
- **Evaluación de riesgos** (bajo, medio, alto)
- **Resumen de cambios** y breaking changes
- **Recomendaciones personalizadas** de actualización

### 🔄 Actualización Inteligente
- **Actualización individual** por plugin
- **Actualización masiva** ("Actualizar Todos")
- **Rollback automático** a última versión estable
- **Validación previa** mediante firma de administrador

### 📊 Dashboard Visual
- **Estadísticas en tiempo real**: Total plugins, actualizados, pendientes, con errores
- **Badges de estado** con iconos dinámicos
- **Timeline de versiones** expandible
- **Integración con GitHub** para seguimiento

## 🚀 Cómo Usar

### 1. Acceso al Panel
1. Inicia sesión como administrador en BeZhas
2. Ve a **Panel de Administración**
3. Haz clic en la pestaña **"Plugins"**

### 2. Ver Estado de Plugins
- La vista principal muestra todos los plugins con:
  - Nombre y descripción
  - Versión actual vs. disponible
  - Estado (actualizado, pendiente actualización, error)
  - Badge de versión estable

### 3. Consultar Recomendación de IA
1. Si hay una actualización disponible, verás el botón **"Consejo IA"**
2. Haz clic para obtener un análisis detallado de:
   - Nivel de riesgo de la actualización
   - Resumen de cambios
   - Recomendación específica
   - Breaking changes (si aplica)

### 4. Actualizar un Plugin
**Opción A: Actualización Individual**
1. Haz clic en **"Actualizar"** junto al plugin deseado
2. Confirma la acción
3. El sistema instalará automáticamente la última versión

**Opción B: Actualización Masiva**
1. Haz clic en **"Actualizar Todos"** en la parte superior
2. Confirma la acción
3. El sistema actualizará todos los plugins que tengan versiones disponibles

### 5. Rollback (Volver Atrás)
Si algo sale mal:
1. Haz clic en **"Rollback"** junto al plugin problemático
2. El sistema instalará automáticamente la última **versión estable** anterior
3. Se registrará la acción en el log de auditoría

### 6. Ver Historial de Versiones
1. Haz clic en el botón **desplegable** (flecha abajo) del plugin
2. Verás una lista completa de versiones anteriores con:
   - Número de versión
   - Fecha de lanzamiento
   - Changelog (si está disponible)
   - Botón para instalar esa versión específica

## 🏗️ Arquitectura Técnica

### Frontend
```
frontend/src/components/admin/PluginManager.jsx
```
- **Framework**: React con Hooks
- **UI**: Tailwind CSS + Lucide Icons
- **Estado**: useState para manejo local
- **HTTP Client**: Axios (vía http service)

### Backend
```
backend/routes/pluginRoutes.js
```
**Endpoints disponibles:**
- `GET /api/plugins` - Listar todos los plugins
- `GET /api/plugins/:id/advice` - Obtener consejo de IA (requiere admin)
- `PATCH /api/plugins/:id/update` - Actualizar plugin (requiere admin)
- `PATCH /api/plugins/:id/rollback` - Rollback a versión estable (requiere admin)
- `POST /api/plugins/update-all` - Actualizar todos los plugins (requiere admin)

### Base de Datos (Prisma)
```prisma
model Plugin {
  id                String
  name              String
  slug              String
  description       String?
  repoUrl           String
  currentVersionId  String?
  status            Status (ACTIVE, INACTIVE, UPDATING, ERROR)
  versions          PluginVersion[]
  logs              UpdateLog[]
}

model PluginVersion {
  id          String
  pluginId    String
  versionTag  String
  isStable    Boolean
  changelog   String?
  zipUrl      String?
}

model UpdateLog {
  id            String
  pluginId      String
  adminWallet   String
  action        Action (UPDATE, ROLLBACK, INSTALL)
  fromVersion   String?
  toVersion     String?
  status        LogStatus (SUCCESS, FAILED)
  timestamp     DateTime
}
```

## 🔒 Seguridad

### Autenticación y Autorización
- **Middleware**: `validateAdminSignature`
- **Requiere**: Firma de wallet del administrador en headers
- **Validación**: Dirección de wallet verificada contra lista de admins

### Auditoría
- **Todas las acciones** se registran en `UpdateLog`
- **Información registrada**:
  - Wallet del administrador que ejecutó la acción
  - Tipo de acción (UPDATE, ROLLBACK, INSTALL)
  - Versiones involucradas (desde/hasta)
  - Estado del resultado (SUCCESS, FAILED)
  - Timestamp

## 🎨 Estados Visuales

### Badges de Estado
| Estado | Color | Icono | Descripción |
|--------|-------|-------|-------------|
| **Actualizado** | Verde | CheckCircle | Plugin en última versión |
| **Actualización disponible** | Amarillo | Clock | Nueva versión disponible |
| **Actualizando** | Azul | RefreshCw (girando) | Actualización en progreso |
| **Error** | Rojo | AlertTriangle | Error en el plugin |

### Nivel de Riesgo de IA
| Nivel | Color | Descripción |
|-------|-------|-------------|
| **Low** | Verde | Actualización segura, sin breaking changes |
| **Medium** | Amarillo | Cambios menores, revisar antes de actualizar |
| **High** | Rojo | Breaking changes, requiere testing extenso |

## 📝 Ejemplo de Uso

### Escenario: Actualizar el Plugin de Chat AI

1. **Estado inicial**:
   - Chat AI está en v1.2.3
   - Nueva versión v1.3.0 disponible

2. **Solicitar consejo de IA**:
   ```
   Análisis de IA:
   - Riesgo: BAJO
   - Resumen: Mejoras de rendimiento y corrección de bugs menores
   - Recomendación: Actualizar inmediatamente
   - Breaking Changes: Ninguno
   ```

3. **Actualizar**:
   - Clic en "Actualizar"
   - Sistema instala v1.3.0
   - Log registra: Admin 0x1234...5678 actualizó de v1.2.3 → v1.3.0

4. **Si hay problemas**:
   - Clic en "Rollback"
   - Sistema revierte a v1.2.3 (última estable)
   - Log registra: Admin 0x1234...5678 hizo rollback de v1.3.0 → v1.2.3

## 🔧 Configuración

### Variables de Entorno
```env
# No se requieren variables adicionales
# Usa las existentes del sistema de admin
```

### Integración con IA
El sistema usa el servicio `UnifiedAI` para análisis:
```javascript
const advice = await UnifiedAI.process('CHAT', {
  message: `Analiza esta actualización de plugin:...`,
  context: { userId: 'system', task: 'plugin-analysis' }
});
```

## 🧪 Testing

### Probar el Sistema
```bash
# 1. Iniciar el backend
cd backend
npm run dev

# 2. Iniciar el frontend
cd frontend
npm run dev

# 3. Acceder al panel
http://localhost:5173/admin-panel
```

### Datos de Prueba (Seed)
Para poblar la base de datos con plugins de ejemplo:
```bash
cd backend
npm run seed:plugins
```

## 📊 Métricas Disponibles

El dashboard muestra:
- **Total Plugins**: Número total de plugins registrados
- **Actualizados**: Plugins en la última versión
- **Pendientes**: Plugins con actualizaciones disponibles
- **Con Errores**: Plugins en estado de error

## 🛠️ Troubleshooting

### Problema: "Error cargando plugins"
**Solución**: 
- Verifica que el backend esté corriendo
- Confirma que la ruta `/api/plugins` esté registrada en `server.js`
- Revisa logs del backend para errores de base de datos

### Problema: "Consejo de IA no carga"
**Solución**:
- Verifica que las API keys de IA estén configuradas
- Confirma que el servicio `UnifiedAI` esté funcionando
- Revisa logs: `Error obteniendo consejo de IA`

### Problema: "Actualización falla"
**Solución**:
- Verifica que tengas permisos de administrador
- Confirma que la firma de wallet sea válida
- Usa "Rollback" para volver a una versión estable
- Revisa `UpdateLog` para detalles del error

## 🚧 Roadmap Futuro

### Próximas Características
- [ ] **Auto-update programado**: Actualizaciones automáticas en horarios configurados
- [ ] **Notificaciones push**: Alertas cuando hay actualizaciones críticas
- [ ] **Test automático**: Ejecutar tests antes de actualizar
- [ ] **Changelog visual**: Diff entre versiones con highlight de cambios
- [ ] **Dependencies check**: Verificar compatibilidad entre plugins
- [ ] **Backup automático**: Crear snapshot antes de cada actualización

## 📞 Soporte

Para problemas o preguntas sobre el sistema de plugins:
- **Documentación**: Este archivo
- **Issues**: GitHub Issues del proyecto
- **Logs**: `backend/logs/` y `UpdateLog` en DB

---

**Última actualización**: 2026-01-10  
**Versión del sistema**: 1.0.0  
**Autor**: BeZhas Development Team
