# 🚀 Quick Start - Panel Admin

## ⚡ Configuración Rápida (3 pasos)

### 1️⃣ Configura el acceso admin
Abre la consola del navegador (F12) y ejecuta:

```javascript
localStorage.setItem('adminToken', 'admin-dev-token-2025');
localStorage.setItem('role', 'admin');
localStorage.setItem('isLoggedIn', 'true');
location.reload();
```

### 2️⃣ Accede al panel
Navega a: **http://localhost:5173/admin/panel**

O desde el sidebar: **Administración → Panel Admin**

### 3️⃣ Verifica el backend
```powershell
cd backend
npm run dev
```

---

## 🎯 Características del Panel

### Dashboard
- 📊 Analytics con gráficos Recharts
- 📈 Métricas de crecimiento
- 💹 Distribución de tokens
- ⚡ Estado del sistema

### Usuarios
- 👥 Lista paginada
- 🔍 Búsqueda y filtros
- ✅ Acciones en masa
- 🔐 Gestión de roles

### Sistema
- 🖥️ Info del servidor
- 📊 Estadísticas DB
- 📝 Logs en tiempo real
- 🔧 Herramientas admin

---

## 🛠️ Sidebar Mejorado

### Características:
- ✅ Se contrae/expande con un click
- ✅ Mantiene el scroll al navegar
- ✅ Responsive (móvil + desktop)
- ✅ 7 categorías organizadas

### Atajos:
- **Desktop:** Click en icono ☰ para contraer
- **Mobile:** Click fuera para cerrar
- **Navegación:** Links no reinician scroll

---

## 📚 Documentación Completa

- **Guía completa:** `ADMIN_SETUP.md`
- **Changelog:** `CHANGELOG_ADMIN.md`
- **Script utilidad:** `frontend/public/admin-setup.js`

---

## 🆘 Problema Común

**No veo "Panel Admin" en el sidebar**  
→ Verifica que tengas role='admin' en localStorage

**Error 401 en peticiones**  
→ Configura adminToken='admin-dev-token-2025'

**Backend no responde**  
→ Ejecuta `cd backend && npm run dev`

---

✨ **¡Listo! Ya puedes usar el panel admin completo.**
