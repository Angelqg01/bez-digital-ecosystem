# Sistema de Gestión de Usuarios y Roles - BeZhas Platform

## 📋 Resumen Ejecutivo

Se ha implementado un sistema completo de gestión de usuarios con **RBAC (Role-Based Access Control)**, validaciones robustas, y paneles de administración tanto para usuarios como para administradores.

---

## 🏗️ Arquitectura Implementada

### **Backend (Node.js + Express)**

#### 1. **Modelo de Datos** (`backend/models/mockModels.js`)
```javascript
// Roles disponibles
USER, CERTIFIED_USER, EDITOR, MODERATOR, DEVELOPER, ADMIN

// Niveles de suscripción
FREE, PREMIUM, VIP

// Campos del usuario
{
  walletAddress: string (unique),
  username: string,
  firstName: string,
  lastName: string,
  bio: string,
  email: string,
  avatarUrl: string,
  coverUrl: string,
  interests: array,
  role: UserRole,
  subscription: SubscriptionTier,
  isVerified: boolean,
  isBanned: boolean,
  createdAt: date,
  updatedAt: date
}
```

#### 2. **Validaciones con Zod** (`backend/lib/validations/user.validation.js`)
- `userProfileSchema`: Validación para actualizaciones de perfil de usuario
- `adminUserUpdateSchema`: Validación para acciones administrativas
- `userFilterSchema`: Validación para filtros de búsqueda

#### 3. **Middleware de Autenticación** (`backend/middleware/auth.middleware.js`)
- `requireAuth`: Verifica autenticación por wallet address
- `requireAdmin`: Verifica privilegios de administrador
- `requireModerator`: Verifica privilegios de moderador o superior
- `requireOwnership`: Verifica que el usuario sea propietario del recurso

#### 4. **API Endpoints**

**Rutas de Usuario** (`backend/routes/users.routes.js`):
```
GET  /api/users/profile/:address         - Obtener perfil
PUT  /api/users/profile/:address         - Actualizar perfil (con validación Zod)
POST /api/users/track-visit              - Registrar visita
POST /api/users/sync-activity            - Sincronizar actividad
POST /api/users/track-interaction        - Registrar interacción
GET  /api/users/activity/:address        - Obtener historial
GET  /api/users/stats/:address           - Obtener estadísticas
```

**Rutas de Admin** (`backend/routes/admin.users.routes.js`):
```
GET  /api/admin/users                    - Listar usuarios (con filtros)
GET  /api/admin/users/:userId            - Ver detalles de usuario
PUT  /api/admin/users/:userId            - Actualizar rol/suscripción/estado
POST /api/admin/users/:userId/ban        - Banear/desbanear usuario
POST /api/admin/users/:userId/verify     - Verificar/remover verificación
GET  /api/admin/users/stats/overview     - Estadísticas globales
```

---

### **Frontend (React + Vite + Wagmi)**

#### 1. **Componente de Edición de Perfil**
**Archivo**: `frontend/src/components/profile/ProfileEditForm.jsx`

**Características**:
- ✅ Previsualización de avatar y cover en tiempo real
- ✅ Validación de formularios
- ✅ Gestión de intereses con tags
- ✅ Contador de caracteres para bio (500 max)
- ✅ Estados de carga y feedback visual
- ✅ Integración con Web3 (wallet address)

**Campos editables**:
- Nombre y apellidos
- Username
- Email
- Biografía (500 caracteres)
- Avatar URL
- Cover URL
- Intereses (lista de tags)

#### 2. **Tabla de Administración de Usuarios**
**Archivo**: `frontend/src/components/admin/AdminUserTable.jsx`

**Características**:
- ✅ **Búsqueda avanzada**: Por nombre, email o wallet
- ✅ **Filtros múltiples**: Rol, suscripción, estado (banned/active)
- ✅ **Estadísticas en tiempo real**: Total usuarios, activos, verificados, baneados
- ✅ **Acciones rápidas** (Dropdown por usuario):
  - Cambiar rol (USER → ADMIN)
  - Verificar/remover verificación
  - Banear/reactivar usuario
- ✅ **UI Responsiva**: Adaptable a móvil y desktop
- ✅ **Badges visuales**: Colores por rol y suscripción
- ✅ **Optimistic UI**: Actualización inmediata sin recargar

**Roles con badges de color**:
- 🔒 ADMIN: Rojo
- 💻 DEVELOPER: Morado
- ⚠️ MODERATOR: Amarillo
- ✏️ EDITOR: Verde
- ✅ CERTIFIED_USER: Azul
- 👤 USER: Gris

**Suscripciones**:
- 👑 VIP: Morado
- ⭐ PREMIUM: Amarillo
- 🆓 FREE: Gris

#### 3. **Páginas**

**Página de Edición de Perfil** (`frontend/src/pages/ProfileEditPage.jsx`):
- Ruta: `/profile/edit`
- Protegida (requiere wallet conectada)
- Botón "Volver" para navegación
- Carga automática de datos del usuario actual

**Página de Administración de Usuarios** (`frontend/src/pages/admin/AdminUsersPage.jsx`):
- Ruta: `/admin/users-management`
- Protegida (requiere rol ADMIN)
- Header con gradiente y estadísticas
- Integra `AdminUserTable`

---

## 🚀 Cómo Usar

### Para Usuarios Normales:

1. **Editar Perfil**:
   - Ir a `/profile/edit` o click en "Editar Perfil" desde el menú
   - Modificar campos deseados
   - Click en "Guardar Cambios"
   - Redirect automático al perfil actualizado

### Para Administradores:

1. **Gestionar Usuarios**:
   - Ir a `/admin/users-management`
   - Usar filtros para encontrar usuarios específicos
   - Click en ⋮ (tres puntos) de cualquier usuario
   - Seleccionar acción deseada:
     - **Cambiar Rol**: Promover a Moderador, Admin, etc.
     - **Verificar**: Agregar badge de verificación
     - **Banear**: Suspender cuenta temporalmente

2. **Buscar Usuarios**:
   - Buscar por nombre, email o wallet address
   - Filtrar por rol (USER, ADMIN, etc.)
   - Filtrar por suscripción (FREE, PREMIUM, VIP)
   - Filtrar por estado (Activo/Baneado)

---

## 🔒 Seguridad

### Validaciones Backend:
- ✅ **Zod Schema Validation**: Todos los inputs validados
- ✅ **Middleware de Autorización**: Verificación estricta de roles
- ✅ **Prevención de Auto-degradación**: Un admin no puede quitarse sus propios privilegios
- ✅ **Verificación de Ownership**: Solo el dueño o admin puede modificar un perfil

### Validaciones Frontend:
- ✅ Email format validation
- ✅ URL format validation (avatarUrl, coverUrl)
- ✅ Character limits (username 3-20, bio 500)
- ✅ Protected Routes (requieren wallet conectada)
- ✅ Admin Routes (requieren rol ADMIN)

---

## 📊 Estadísticas y Métricas

El endpoint `/api/admin/users/stats/overview` retorna:
```json
{
  "total": 150,
  "byRole": {
    "USER": 120,
    "CERTIFIED_USER": 15,
    "EDITOR": 8,
    "MODERATOR": 5,
    "DEVELOPER": 1,
    "ADMIN": 1
  },
  "bySubscription": {
    "FREE": 100,
    "PREMIUM": 40,
    "VIP": 10
  },
  "verified": 50,
  "banned": 5,
  "active": 145
}
```

---

## 🎨 Diseño UI/UX

### Componentes Destacados:
- **Formulario de Perfil**: Card con shadow, gradientes purple/pink
- **Tabla de Admin**: Responsive, hover effects, dropdown actions
- **Badges**: Color-coded por rol y suscripción
- **Loading States**: Spinners y skeleton screens
- **Toast Notifications**: Feedback inmediato de acciones

### Dark Mode:
- ✅ Totalmente compatible
- ✅ Colores adaptados para ambos temas
- ✅ Contraste óptimo en texto y badges

---

## 🧪 Testing Recomendado

### Backend:
1. Crear usuario y verificar campos por defecto
2. Actualizar perfil sin autenticación (debe fallar)
3. Intentar cambiar rol sin ser admin (debe fallar)
4. Admin intenta degradarse a sí mismo (debe fallar)
5. Banear usuario y verificar que no pueda acceder

### Frontend:
1. Navegar a `/profile/edit` sin wallet (debe redirect)
2. Editar perfil y verificar actualización
3. Acceder a `/admin/users-management` sin rol admin
4. Filtrar usuarios por diferentes criterios
5. Cambiar rol de un usuario y verificar actualización en UI

---

## 📦 Archivos Creados/Modificados

### Backend:
- ✅ `models/mockModels.js` - Actualizado con roles y suscripciones
- ✅ `lib/validations/user.validation.js` - **NUEVO**
- ✅ `middleware/auth.middleware.js` - Actualizado con nuevas funciones
- ✅ `routes/users.routes.js` - Actualizado con validaciones Zod
- ✅ `routes/admin.users.routes.js` - **NUEVO**
- ✅ `server.js` - Registrada nueva ruta de admin

### Frontend:
- ✅ `components/profile/ProfileEditForm.jsx` - **NUEVO**
- ✅ `components/admin/AdminUserTable.jsx` - **NUEVO**
- ✅ `pages/ProfileEditPage.jsx` - **NUEVO**
- ✅ `pages/admin/AdminUsersPage.jsx` - **NUEVO**
- ✅ `App.jsx` - Agregadas rutas nuevas

---

## 🔧 Variables de Entorno Necesarias

```env
# Backend
PORT=3001
NODE_ENV=development
JWT_SECRET=your_secret_key
AUTH_BYPASS_ENABLED=true  # Solo para desarrollo

# Frontend
VITE_API_URL=http://localhost:3001
```

---

## 🎯 Próximos Pasos Sugeridos

1. **Migrar a Base de Datos Real**:
   - Reemplazar `mockModels` con Prisma + PostgreSQL/MongoDB
   - Mantener la misma estructura de datos

2. **Autenticación Avanzada**:
   - Implementar SIWE (Sign-In with Ethereum)
   - JWT tokens con refresh tokens
   - 2FA para administradores

3. **Notificaciones**:
   - Email notifications cuando rol cambia
   - Push notifications para usuarios baneados

4. **Auditoría**:
   - Log de todas las acciones administrativas
   - Historial de cambios de roles

5. **Permisos Granulares**:
   - Crear sistema de permisos más detallado
   - Roles personalizados por organizaciones

---

## 📞 Soporte

Para cualquier duda sobre la implementación, revisar:
- Documentación de Zod: https://zod.dev
- Documentación de Wagmi: https://wagmi.sh
- Documentación de React Router: https://reactrouter.com

---

**Estado**: ✅ **IMPLEMENTADO Y LISTO PARA USAR**

**Autor**: Senior Full-Stack Web3 Engineer
**Fecha**: Diciembre 2025
**Versión**: 1.0.0
