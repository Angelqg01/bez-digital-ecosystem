# 🔑 Admin Dashboard - Snippets de Código Clave

## Referencia Rápida de Implementación

---

## 📊 1. KPI Card Component

Tarjeta de estadística con gradiente y animaciones:

```jsx
const StatCard = ({ icon: Icon, label, value, change, trend, color = 'blue' }) => {
  const colors = {
    blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/30',
    green: 'from-green-500/20 to-green-600/5 border-green-500/30',
    purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/30',
    orange: 'from-orange-500/20 to-orange-600/5 border-orange-500/30',
    red: 'from-red-500/20 to-red-600/5 border-red-500/30',
    cyan: 'from-cyan-500/20 to-cyan-600/5 border-cyan-500/30'
  };

  const iconColors = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400',
    red: 'text-red-400',
    cyan: 'text-cyan-400'
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-6 backdrop-blur-sm hover:scale-105 transition-transform duration-200`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg bg-gray-800/50 ${iconColors[color]}`}>
          <Icon size={24} />
        </div>
        {change && (
          <div className={`flex items-center gap-1 text-sm font-medium ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
            <TrendingUp size={16} className={trend === 'down' ? 'rotate-180' : ''} />
            {change}
          </div>
        )}
      </div>
      <div>
        <p className="text-gray-400 text-sm mb-1">{label}</p>
        <p className="text-3xl font-bold text-white">{value}</p>
      </div>
    </div>
  );
};
```

**Uso:**
```jsx
<StatCard
  icon={Users}
  label="Usuarios Totales"
  value={stats.totalUsers.toLocaleString()}
  change="+12%"
  trend="up"
  color="blue"
/>
```

---

## 🎨 2. Tab Button Component

Botones de navegación con gradiente activo:

```jsx
const TabButton = ({ id, icon: Icon, label, count }) => (
  <button
    onClick={() => setActiveTab(id)}
    className={`flex items-center gap-3 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
      activeTab === id
        ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/30'
        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-white'
    }`}
  >
    <Icon size={20} />
    <span>{label}</span>
    {count !== undefined && (
      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
        activeTab === id ? 'bg-white/20' : 'bg-gray-700'
      }`}>
        {count}
      </span>
    )}
  </button>
);
```

**Uso:**
```jsx
<TabButton id="users" icon={Users} label="Usuarios" count={stats.totalUsers} />
```

---

## 📈 3. Chart.js Configuration

Configuración global de gráficos:

```javascript
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: { 
        color: '#94a3b8', 
        font: { size: 11 } 
      }
    },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      titleColor: '#f1f5f9',
      bodyColor: '#cbd5e1',
      borderColor: '#334155',
      borderWidth: 1,
      padding: 12,
      displayColors: true
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(148, 163, 184, 0.1)' },
      ticks: { color: '#64748b' }
    },
    x: {
      grid: { color: 'rgba(148, 163, 184, 0.1)' },
      ticks: { color: '#64748b' }
    }
  }
};
```

**Gráfico de Línea:**
```jsx
const userGrowthData = {
  labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
  datasets: [
    {
      label: 'Nuevos Usuarios',
      data: [12, 19, 15, 25, 22, 30, 23],
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      tension: 0.4,
      fill: true
    },
    {
      label: 'Usuarios Activos',
      data: [850, 870, 865, 890, 885, 905, 892],
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      tension: 0.4,
      fill: true
    }
  ]
};

<Line data={userGrowthData} options={chartOptions} />
```

**Gráfico de Dona:**
```jsx
const contentDistributionData = {
  labels: ['Posts', 'NFTs', 'Artículos', 'Reels', 'Otros'],
  datasets: [{
    data: [45, 25, 15, 10, 5],
    backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'],
    borderColor: '#1e293b',
    borderWidth: 2
  }]
};

<Doughnut data={contentDistributionData} options={chartOptions} />
```

**Gráfico de Barras:**
```jsx
const revenueData = {
  labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct'],
  datasets: [{
    label: 'Ingresos ($)',
    data: [3200, 4100, 3800, 5200, 4900, 6100, 5800, 7200, 6800, 8100],
    backgroundColor: 'rgba(16, 185, 129, 0.8)',
    borderColor: '#10b981',
    borderWidth: 2,
    borderRadius: 6
  }]
};

<Bar data={revenueData} options={chartOptions} />
```

---

## 🔄 4. WebSocket Integration (Opcional)

Conexión robusta con manejo de errores:

```javascript
useEffect(() => {
  let ws = null;
  try {
    ws = new WebSocket('ws://localhost:3002');
    
    ws.onopen = () => {
      console.log('✅ WebSocket connected - Real-time updates active');
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Actualizar estadísticas en tiempo real
        if (data.type === 'stats_update') {
          setStats(prev => ({ ...prev, ...data.payload }));
        }
        // Notificar nuevos usuarios
        else if (data.type === 'new_user') {
          fetchUsers();
        }
        // Notificar nuevos reportes
        else if (data.type === 'new_report') {
          fetchReports();
        }
        // Agregar log de actividad
        else if (data.type === 'activity_log') {
          setActivityLogs(prev => [data.payload, ...prev].slice(0, 50));
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };
    
    ws.onerror = (error) => {
      console.warn('⚠️ WebSocket no disponible - Dashboard funcionará sin actualizaciones en tiempo real');
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };
  } catch (error) {
    console.warn('⚠️ WebSocket no disponible - Dashboard funcionará sin actualizaciones en tiempo real');
  }

  return () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  };
}, []);
```

---

## 🔍 5. Sistema de Filtros

Filtros avanzados con URLSearchParams:

```jsx
// Estado de filtros
const [userFilter, setUserFilter] = useState({ 
  search: '', 
  role: 'all', 
  status: 'all', 
  dateFrom: '', 
  dateTo: '' 
});

// Aplicar filtros
const fetchUsers = async () => {
  try {
    const params = new URLSearchParams({
      page: currentPage,
      limit: itemsPerPage,
      search: userFilter.search,
      role: userFilter.role !== 'all' ? userFilter.role : '',
      status: userFilter.status !== 'all' ? userFilter.status : ''
    });

    const response = await fetch(`/api/admin/users?${params}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
    });
    const data = await response.json();
    
    setUsers(data.users || []);
    setTotalItems(data.total || 0);
  } catch (error) {
    console.error('Error fetching users:', error);
  }
};
```

**UI de Filtros:**
```jsx
<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
  {/* Búsqueda */}
  <div>
    <label className="block text-sm text-gray-400 mb-2">🔍 Buscar</label>
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
      <input
        type="text"
        placeholder="Nombre, email..."
        value={userFilter.search}
        onChange={(e) => setUserFilter({...userFilter, search: e.target.value})}
        className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
      />
    </div>
  </div>
  
  {/* Selector de Rol */}
  <div>
    <label className="block text-sm text-gray-400 mb-2">👤 Rol</label>
    <select
      value={userFilter.role}
      onChange={(e) => setUserFilter({...userFilter, role: e.target.value})}
      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
    >
      <option value="all">Todos</option>
      <option value="user">Usuario</option>
      <option value="creator">Creador</option>
      <option value="moderator">Moderador</option>
      <option value="admin">Admin</option>
    </select>
  </div>
  
  {/* Selector de Estado */}
  <div>
    <label className="block text-sm text-gray-400 mb-2">📊 Estado</label>
    <select
      value={userFilter.status}
      onChange={(e) => setUserFilter({...userFilter, status: e.target.value})}
      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
    >
      <option value="all">Todos</option>
      <option value="active">Activo</option>
      <option value="inactive">Inactivo</option>
      <option value="suspended">Suspendido</option>
    </select>
  </div>

  {/* Botón Aplicar */}
  <div>
    <label className="block text-sm text-gray-400 mb-2">🎯 Acciones</label>
    <button
      onClick={fetchUsers}
      className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-all"
    >
      Aplicar Filtros
    </button>
  </div>
</div>
```

---

## 📄 6. Paginación

Sistema de paginación completo:

```jsx
// Estado
const [currentPage, setCurrentPage] = useState(1);
const [itemsPerPage] = useState(10);
const [totalItems, setTotalItems] = useState(0);

// Cálculos
const totalPages = Math.ceil(totalItems / itemsPerPage);
const startItem = (currentPage - 1) * itemsPerPage + 1;
const endItem = Math.min(currentPage * itemsPerPage, totalItems);

// UI
<div className="flex items-center justify-between px-6 py-4 bg-gray-800/30 border-t border-gray-700/50">
  <div className="text-sm text-gray-400">
    Mostrando {startItem} - {endItem} de {totalItems} usuarios
  </div>
  <div className="flex items-center gap-2">
    <button
      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
      disabled={currentPage === 1}
      className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
    >
      <ChevronLeft size={18} />
    </button>
    <span className="px-4 py-2 bg-gray-700 text-white rounded-lg font-medium">
      {currentPage} / {totalPages}
    </span>
    <button
      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
      disabled={currentPage === totalPages}
      className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
    >
      <ChevronRight size={18} />
    </button>
  </div>
</div>
```

---

## 💾 7. Exportación CSV

Función completa de exportación:

```javascript
/**
 * Exportar datos a CSV
 */
const exportToCSV = (data, filename) => {
  const csv = convertToCSV(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Convertir array de objetos a CSV
 */
const convertToCSV = (data) => {
  if (!data || data.length === 0) return '';
  
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => 
    Object.values(row).map(val => 
      typeof val === 'string' && val.includes(',') ? `"${val}"` : val
    ).join(',')
  );
  
  return [headers, ...rows].join('\n');
};
```

**Botón de Exportación:**
```jsx
<button
  onClick={() => exportToCSV(users, 'usuarios')}
  className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg border border-green-500/30 transition-all"
>
  <Download size={18} />
  Exportar CSV
</button>
```

---

## 🎯 8. Acciones CRUD

Funciones de acciones administrativas:

```javascript
/**
 * Acciones de usuario
 */
const handleUserAction = async (userId, action) => {
  try {
    const response = await fetch(`/api/admin/users/${userId}/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    });

    if (response.ok) {
      await fetchUsers();
      addActivityLog({
        action: `user_${action}`,
        target: `user_${userId}`,
        details: `Usuario ${action === 'activate' ? 'activado' : action === 'deactivate' ? 'desactivado' : 'eliminado'}`
      });
    }
  } catch (error) {
    console.error(`Error ${action} user:`, error);
  }
};

/**
 * Acciones de contenido
 */
const handleContentAction = async (contentId, action) => {
  try {
    const response = await fetch(`/api/admin/content/${contentId}/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      },
      body: JSON.stringify({ 
        reason: action === 'reject' ? 'Violación de términos' : '' 
      })
    });

    if (response.ok) {
      await fetchContent();
      addActivityLog({
        action: `content_${action}`,
        target: `content_${contentId}`,
        details: `Contenido ${action === 'approve' ? 'aprobado' : 'rechazado'}`
      });
    }
  } catch (error) {
    console.error(`Error ${action} content:`, error);
  }
};

/**
 * Acciones de reportes
 */
const handleReportAction = async (reportId, action) => {
  try {
    const response = await fetch(`/api/admin/reports/${reportId}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      },
      body: JSON.stringify({ action })
    });

    if (response.ok) {
      await fetchReports();
      addActivityLog({
        action: 'report_resolved',
        target: `report_${reportId}`,
        details: `Reporte resuelto - ${action}`
      });
    }
  } catch (error) {
    console.error('Error resolving report:', error);
  }
};

/**
 * Agregar log de actividad
 */
const addActivityLog = async (log) => {
  try {
    await fetch('/api/admin/activity-logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      },
      body: JSON.stringify({
        ...log,
        admin: 'current_admin',
        timestamp: new Date().toISOString()
      })
    });
    
    await fetchActivityLogs();
  } catch (error) {
    console.error('Error adding log:', error);
  }
};
```

---

## 🔄 9. Botón de Refresh

Función de actualización manual:

```javascript
const [refreshing, setRefreshing] = useState(false);

const handleRefresh = async () => {
  setRefreshing(true);
  await Promise.all([
    fetchStats(),
    fetchUsers(),
    fetchContent(),
    fetchReports(),
    fetchActivityLogs()
  ]);
  setRefreshing(false);
};
```

**UI:**
```jsx
<button
  onClick={handleRefresh}
  disabled={refreshing}
  className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg border border-blue-500/30 transition-all disabled:opacity-50"
>
  <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
  Actualizar
</button>
```

---

## 🎨 10. Badges de Estado

Sistema de badges coloridos:

```jsx
{/* Badge de Rol */}
<span className={`px-3 py-1 rounded-full text-xs font-medium ${
  user.role === 'admin' ? 'bg-red-500/20 text-red-400' :
  user.role === 'moderator' ? 'bg-purple-500/20 text-purple-400' :
  user.role === 'creator' ? 'bg-blue-500/20 text-blue-400' :
  'bg-gray-500/20 text-gray-400'
}`}>
  {user.role}
</span>

{/* Badge de Estado */}
<span className={`px-3 py-1 rounded-full text-xs font-medium ${
  user.status === 'active' ? 'bg-green-500/20 text-green-400' :
  user.status === 'suspended' ? 'bg-red-500/20 text-red-400' :
  'bg-gray-500/20 text-gray-400'
}`}>
  {user.status}
</span>

{/* Badge de Tipo de Contenido */}
<span className={`px-3 py-1 rounded-full text-xs font-medium ${
  item.type === 'post' ? 'bg-blue-500/20 text-blue-400' :
  item.type === 'nft' ? 'bg-purple-500/20 text-purple-400' :
  item.type === 'article' ? 'bg-cyan-500/20 text-cyan-400' :
  'bg-pink-500/20 text-pink-400'
}`}>
  {item.type}
</span>

{/* Badge de Estado de Contenido */}
<span className={`px-3 py-1 rounded-full text-xs font-medium ${
  item.status === 'approved' ? 'bg-green-500/20 text-green-400' :
  item.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
  item.status === 'flagged' ? 'bg-red-500/20 text-red-400' :
  'bg-gray-500/20 text-gray-400'
}`}>
  {item.status}
</span>
```

---

## 📊 11. Tabla de Usuarios Completa

Tabla responsiva con todas las columnas:

```jsx
<div className="bg-gray-900/50 rounded-xl border border-gray-700/50 overflow-hidden">
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead className="bg-gray-800/50">
        <tr>
          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Usuario</th>
          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Email</th>
          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Rol</th>
          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Estado</th>
          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Posts</th>
          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Balance</th>
          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Última Actividad</th>
          <th className="px-6 py-4 text-center text-sm font-semibold text-gray-300">Acciones</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-700/50">
        {users.map((user) => (
          <tr key={user.id} className="hover:bg-gray-800/30 transition-colors">
            {/* Usuario con Avatar */}
            <td className="px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                  {user.username[0].toUpperCase()}
                </div>
                <span className="text-white font-medium">{user.username}</span>
              </div>
            </td>
            
            {/* Email */}
            <td className="px-6 py-4 text-gray-400">{user.email}</td>
            
            {/* Rol Badge */}
            <td className="px-6 py-4">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                user.role === 'admin' ? 'bg-red-500/20 text-red-400' :
                user.role === 'moderator' ? 'bg-purple-500/20 text-purple-400' :
                user.role === 'creator' ? 'bg-blue-500/20 text-blue-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {user.role}
              </span>
            </td>
            
            {/* Estado Badge */}
            <td className="px-6 py-4">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                user.status === 'active' ? 'bg-green-500/20 text-green-400' :
                user.status === 'suspended' ? 'bg-red-500/20 text-red-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {user.status}
              </span>
            </td>
            
            {/* Posts */}
            <td className="px-6 py-4 text-gray-300">{user.posts}</td>
            
            {/* Balance */}
            <td className="px-6 py-4 text-green-400 font-medium">
              ${user.balance.toLocaleString()}
            </td>
            
            {/* Última Actividad */}
            <td className="px-6 py-4 text-gray-400 text-sm">{user.lastActive}</td>
            
            {/* Acciones */}
            <td className="px-6 py-4">
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => handleUserAction(user.id, 'view')}
                  className="p-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all"
                  title="Ver detalles"
                >
                  <Eye size={16} />
                </button>
                {user.status === 'active' ? (
                  <button
                    onClick={() => handleUserAction(user.id, 'deactivate')}
                    className="p-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg transition-all"
                    title="Desactivar"
                  >
                    <UserX size={16} />
                  </button>
                ) : (
                  <button
                    onClick={() => handleUserAction(user.id, 'activate')}
                    className="p-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-all"
                    title="Activar"
                  >
                    <UserCheck size={16} />
                  </button>
                )}
                <button
                  onClick={() => handleUserAction(user.id, 'delete')}
                  className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all"
                  title="Eliminar"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>
```

---

## 📋 12. Timeline de Logs

Timeline vertical con línea conectora:

```jsx
<div className="space-y-4">
  {activityLogs.map((log, index) => (
    <div key={log.id} className="flex items-start gap-4 relative">
      {/* Línea conectora */}
      {index !== activityLogs.length - 1 && (
        <div className="absolute left-[15px] top-8 w-0.5 h-full bg-gray-700"></div>
      )}
      
      {/* Icono */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0 relative z-10">
        <Activity size={16} className="text-white" />
      </div>
      
      {/* Contenido */}
      <div className="flex-1 bg-gray-800/50 rounded-lg p-4 border border-gray-700/30">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h4 className="font-semibold text-white mb-1">{log.details}</h4>
            <p className="text-sm text-gray-400">
              Admin: <span className="text-blue-400">{log.admin}</span> • 
              Target: <span className="text-purple-400">{log.target}</span>
            </p>
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap">{log.timestamp}</span>
        </div>
      </div>
    </div>
  ))}
</div>
```

---

## 🚀 Quick Start

### Importaciones Necesarias:

```javascript
import { useState, useEffect } from 'react';
import {
  Users, FileText, Activity, DollarSign, TrendingUp,
  AlertCircle, CheckCircle, Clock, Download, Filter,
  Search, Calendar, UserCheck, UserX, Eye, Trash2,
  MoreVertical, ChevronLeft, ChevronRight, RefreshCw,
  Shield, Award, Target, Zap, Bell, Settings, ShoppingCart
} from 'lucide-react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Registrar componentes de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);
```

---

## 🎨 Clases Tailwind Clave

### Glassmorphism:
```css
bg-gray-800/50 backdrop-blur-sm
```

### Gradientes:
```css
bg-gradient-to-br from-blue-500/20 to-blue-600/5
bg-gradient-to-r from-blue-500 to-purple-500
```

### Animaciones:
```css
hover:scale-105 transition-transform duration-200
hover:bg-gray-700/50 transition-all
```

### Bordes con transparencia:
```css
border border-gray-700/50
border-blue-500/30
```

### Shadow con color:
```css
shadow-lg shadow-blue-500/30
```

---

**📚 Documentación completa en:**
- `ADMIN-DASHBOARD-COMPLETE.md`
- `ADMIN-DASHBOARD-LAYOUT.md`
- `CONSOLE-ERRORS-ANALYSIS.md`

**🚀 Panel listo para producción!**
