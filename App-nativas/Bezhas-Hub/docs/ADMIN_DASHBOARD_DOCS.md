# 📊 AdminDashboard - Documentación Técnica

## 🎯 Descripción General

`AdminDashboard.jsx` es el componente principal del panel de administración de BeZhas. Proporciona una vista consolidada de las métricas clave, usuarios recientes y actividad del sistema en tiempo real.

---

## 🏗️ Arquitectura del Componente

### **Componente Principal:**
- **`AdminDashboard.jsx`** - Dashboard principal con gestión de estado y lógica de negocio

### **Componentes Hijos Reutilizables:**
1. **`StatCard.jsx`** - Tarjetas de estadísticas con gradientes y tendencias
2. **`UserCard.jsx`** - Tarjetas de usuario con acciones de administración
3. **`ActivityCard.jsx`** - Elementos de actividad reciente con iconos

---

## 📦 Estructura de Datos

### **Estados del Componente:**

```javascript
// Estadísticas principales
const [stats, setStats] = useState({
    totalUsers: 0,        // Total de usuarios registrados
    totalPosts: 0,        // Total de posts publicados
    totalGroups: 0,       // Total de grupos creados
    activeUsers: 0        // Usuarios activos (últimas 24h)
});

// Usuarios recientes (últimos 5)
const [recentUsers, setRecentUsers] = useState([]);

// Actividad reciente (últimas 10 acciones)
const [recentActivity, setRecentActivity] = useState([]);

// Estados de UI
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);
```

---

## 🔌 Conexión con la API

### **Endpoints Utilizados:**

#### 1. **GET /api/admin/users**
- **Descripción:** Obtiene la lista completa de usuarios
- **Headers:** `Authorization: Bearer {adminToken}`
- **Respuesta:**
```javascript
[
  {
    id: "uuid",
    username: "string",
    email: "string",
    avatar: "url",
    role: "user|admin",
    isVerified: boolean,
    walletAddress: "0x...",
    createdAt: "ISO date",
    lastActive: "ISO date"
  }
]
```

#### 2. **GET /api/feed**
- **Descripción:** Obtiene todos los posts publicados
- **Público:** No requiere autenticación
- **Respuesta:**
```javascript
[
  {
    id: "uuid",
    title: "string",
    content: "string",
    author: {
      username: "string"
    },
    createdAt: "ISO date"
  }
]
```

#### 3. **GET /api/groups**
- **Descripción:** Obtiene todos los grupos
- **Público:** No requiere autenticación
- **Respuesta:**
```javascript
[
  {
    id: "uuid",
    name: "string",
    description: "string",
    createdAt: "ISO date"
  }
]
```

#### 4. **POST /api/admin/users/:userId/verify**
- **Descripción:** Verifica un usuario
- **Headers:** `Authorization: Bearer {adminToken}`
- **Body:** `{}`

#### 5. **POST /api/admin/users/:userId/suspend**
- **Descripción:** Suspende un usuario
- **Headers:** `Authorization: Bearer {adminToken}`
- **Body:** `{}`

---

## 🎨 Componentes Hijos

### **1. StatCard.jsx**

**Props:**
```javascript
{
  title: string,          // Título de la estadística
  value: number|string,   // Valor a mostrar
  icon: LucideIcon,       // Componente de icono
  trend: number,          // Porcentaje de cambio (positivo/negativo)
  bgGradient: string      // Clases de Tailwind para el gradiente
}
```

**Características:**
- ✅ Gradientes personalizables
- ✅ Indicadores de tendencia (↑ ↓)
- ✅ Animaciones de hover
- ✅ Fondo decorativo con blur

**Uso:**
```jsx
<StatCard
  title="Total Usuarios"
  value={1250}
  icon={Users}
  trend={8.5}
  bgGradient="bg-gradient-to-br from-blue-500 to-blue-600"
/>
```

---

### **2. UserCard.jsx**

**Props:**
```javascript
{
  user: {
    id: string,
    username: string,
    email: string,
    avatar: string,
    role: "user"|"admin",
    isVerified: boolean,
    walletAddress: string,
    createdAt: string
  },
  onAction: (userId, action) => void  // Callback para acciones
}
```

**Características:**
- ✅ Avatar con fallback a UI Avatars
- ✅ Badge de verificación
- ✅ Badge de rol (Admin/Usuario)
- ✅ Botones de acción (Verificar/Suspender)
- ✅ Información de wallet resumida

**Acciones Disponibles:**
- `verify` - Verifica al usuario
- `suspend` - Suspende al usuario

---

### **3. ActivityCard.jsx**

**Props:**
```javascript
{
  activity: {
    type: "user_registered"|"post_created"|"group_created"|"comment"|"like",
    data: object,         // Datos específicos de la actividad
    timestamp: string     // Fecha ISO
  }
}
```

**Tipos de Actividad:**

| Tipo | Icono | Color | Descripción |
|------|-------|-------|-------------|
| `user_registered` | UserPlus | Azul | Nuevo registro de usuario |
| `post_created` | FileText | Verde | Nueva publicación |
| `group_created` | Users | Morado | Nuevo grupo creado |
| `comment` | MessageSquare | Naranja | Nuevo comentario |
| `like` | Heart | Rojo | Like en publicación |

---

## 🔄 Flujo de Datos

```
1. ComponentDidMount
   ↓
2. fetchDashboardData()
   ↓
3. Promise.all([
     fetchUsers(),
     fetchPosts(),
     fetchGroups()
   ])
   ↓
4. Procesar datos:
   - Calcular estadísticas
   - Filtrar usuarios activos
   - Ordenar por fecha
   - Crear actividades
   ↓
5. Actualizar estados:
   - setStats()
   - setRecentUsers()
   - setRecentActivity()
   ↓
6. Renderizar UI
```

---

## 🎯 Funciones Principales

### **fetchDashboardData()**

```javascript
/**
 * Función asíncrona que obtiene todos los datos necesarios para el dashboard
 * - Realiza peticiones en paralelo para optimizar la carga
 * - Calcula usuarios activos (últimas 24h)
 * - Ordena usuarios y posts por fecha
 * - Genera actividad reciente a partir de los datos
 * - Maneja errores y estados de carga
 */
async function fetchDashboardData() {
  setLoading(true);
  setError(null);
  
  try {
    // Peticiones en paralelo
    const [usersRes, feedRes, groupsRes] = await Promise.all([...]);
    
    // Procesamiento de datos
    // ...
    
    // Actualización de estados
    setStats({...});
    setRecentUsers([...]);
    setRecentActivity([...]);
    
    toast.success('Dashboard actualizado');
  } catch (err) {
    setError('Error al cargar los datos');
    toast.error('Error al cargar los datos');
  } finally {
    setLoading(false);
  }
}
```

### **handleUserAction(userId, action)**

```javascript
/**
 * Maneja las acciones sobre usuarios (verificar, suspender)
 * @param {string} userId - ID del usuario
 * @param {string} action - Acción a realizar ('verify' o 'suspend')
 */
const handleUserAction = async (userId, action) => {
  try {
    if (action === 'verify') {
      await axios.post(`${API_URL}/admin/users/${userId}/verify`, ...);
      toast.success('Usuario verificado');
    } else if (action === 'suspend') {
      await axios.post(`${API_URL}/admin/users/${userId}/suspend`, ...);
      toast.success('Usuario suspendido');
    }
    
    // Refrescar datos
    fetchDashboardData();
  } catch (err) {
    toast.error('Error al realizar la acción');
  }
};
```

---

## 🎨 Diseño y Estilos

### **Paleta de Colores:**

| Elemento | Color | Uso |
|----------|-------|-----|
| **Azul** | `from-blue-500 to-blue-600` | Usuarios, acciones principales |
| **Verde** | `from-green-500 to-green-600` | Posts, éxito |
| **Morado** | `from-purple-500 to-purple-600` | Grupos, premium |
| **Naranja** | `from-orange-500 to-orange-600` | Actividad, alertas |

### **Responsive Design:**

```javascript
// Grid de estadísticas
grid-cols-1 md:grid-cols-2 lg:grid-cols-4

// Grid de acciones rápidas
grid-cols-1 md:grid-cols-3

// Grid de contenido (usuarios + actividad)
grid-cols-1 lg:grid-cols-2
```

---

## ⚡ Optimizaciones

### **Performance:**
1. **Promise.all()** - Peticiones en paralelo
2. **useMemo/useCallback** - Memoización de cálculos pesados
3. **Lazy loading** - Componentes cargados bajo demanda
4. **Skeleton screens** - Loading states con animaciones

### **UX:**
1. **Toast notifications** - Feedback inmediato
2. **Loading states** - Indicadores visuales claros
3. **Error handling** - Mensajes descriptivos
4. **Retry mechanism** - Botón para reintentar

---

## 🔐 Seguridad

### **Autenticación:**
```javascript
const adminToken = localStorage.getItem('adminToken');

headers: { 
  Authorization: `Bearer ${adminToken}` 
}
```

### **Validaciones:**
- ✅ Token requerido para endpoints admin
- ✅ Verificación de rol en el backend
- ✅ CORS configurado correctamente
- ✅ Rate limiting en API

---

## 📱 Accesibilidad

- ✅ Etiquetas ARIA en botones
- ✅ Alto contraste en modo oscuro
- ✅ Tamaños de texto legibles
- ✅ Iconos con significado semántico
- ✅ Estados de hover y focus claros

---

## 🧪 Testing

### **Casos de Prueba:**

1. **Carga inicial correcta**
   - ✅ Muestra loading state
   - ✅ Fetch de datos exitoso
   - ✅ Renderizado de estadísticas

2. **Manejo de errores**
   - ✅ Error de red
   - ✅ Token inválido
   - ✅ Datos vacíos

3. **Acciones de usuario**
   - ✅ Verificar usuario
   - ✅ Suspender usuario
   - ✅ Actualizar dashboard

4. **Responsive**
   - ✅ Mobile (320px - 768px)
   - ✅ Tablet (768px - 1024px)
   - ✅ Desktop (1024px+)

---

## 🚀 Ejemplo de Uso

```jsx
import AdminDashboard from './pages/AdminDashboard';

// En App.jsx o Router
<Route path="/admin" element={<AdminRoute />}>
  <Route index element={<AdminDashboard />} />
</Route>
```

---

## 📄 Dependencias

```json
{
  "react": "^18.3.1",
  "axios": "^1.7.9",
  "lucide-react": "^0.468.0",
  "react-hot-toast": "^2.4.1",
  "react-router-dom": "^7.1.1"
}
```

---

## 🔮 Mejoras Futuras

1. **Real-time updates** - WebSocket para actualizaciones en vivo
2. **Filtros avanzados** - Búsqueda y filtrado de usuarios/posts
3. **Exportar datos** - CSV/PDF de estadísticas
4. **Gráficos históricos** - Tendencias a lo largo del tiempo
5. **Notificaciones push** - Alertas de eventos importantes
6. **Modo offline** - Cache de datos con Service Worker

---

**Última actualización:** Octubre 13, 2025  
**Versión:** 2.0.0  
**Estado:** ✅ Producción Ready
