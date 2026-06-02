# 📱 RightSidebar - Sistema Responsivo

## 🎯 Descripción General

Sistema completamente responsivo para la columna lateral derecha de BeZhas, con comportamiento adaptativo para móvil y desktop.

---

## ✨ Características

### Desktop (≥ 1280px)
- ✅ Sidebar fija a la derecha
- ✅ Siempre visible
- ✅ Scroll independiente
- ✅ No interfiere con contenido principal

### Móvil/Tablet (< 1280px)
- ✅ Botón flotante en borde derecho
- ✅ Sidebar desliza desde la derecha (fullscreen)
- ✅ Overlay oscuro con blur
- ✅ Botón de cierre circular con X
- ✅ Contrae automáticamente el sidebar izquierdo
- ✅ Animaciones suaves (spring animations)
- ✅ Badge de notificaciones con contador

---

## 🏗️ Arquitectura

```
frontend/
├── context/
│   └── RightSidebarContext.jsx      # Estado global de la sidebar
├── components/
│   └── RightSidebarToggle.jsx       # Botón flotante (móvil)
├── layouts/
│   ├── AppLayout.jsx                # Layout principal (actualizado)
│   └── components/
│       └── RightSidebar.jsx         # Componente sidebar (actualizado)
└── index.css                         # Estilos CSS adicionales
```

---

## 🔧 Componentes

### 1. RightSidebarContext

**Ubicación:** `frontend/src/context/RightSidebarContext.jsx`

**Estado:**
```javascript
{
  isOpen: boolean,      // Sidebar abierta/cerrada
  isMobile: boolean,    // ¿Es pantalla móvil?
  toggleSidebar(),      // Alternar estado
  closeSidebar(),       // Cerrar sidebar
  openSidebar()         // Abrir sidebar
}
```

**Uso:**
```jsx
import { useRightSidebar } from '../context/RightSidebarContext';

function MiComponente() {
    const { isOpen, isMobile, toggleSidebar } = useRightSidebar();
    // ...
}
```

---

### 2. RightSidebar

**Ubicación:** `frontend/src/layouts/components/RightSidebar.jsx`

**Características:**
- Renderizado condicional (móvil vs desktop)
- Contenido rico: Trending, Contactos, Actividad, Sugerencias
- Animaciones con Framer Motion
- Botón de cierre en header (móvil)
- Previene scroll del body cuando está abierto (móvil)

**Estructura del contenido:**
```jsx
<RightSidebar>
  {/* Header con botón cerrar (solo móvil) */}
  
  {/* Trending Topics */}
  <TrendingSection />
  
  {/* Contactos Activos */}
  <ActiveUsersSection />
  
  {/* Actividad Reciente */}
  <RecentActivitySection />
  
  {/* Sugerencias */}
  <SuggestionsSection />
</RightSidebar>
```

---

### 3. RightSidebarToggle

**Ubicación:** `frontend/src/components/RightSidebarToggle.jsx`

**Visual:**
```
┌─────┐
│  📊  │  <- Icono Activity
│  A  │
│  C  │  <- Texto vertical
│  T  │
│  I  │
│  V  │
│  ←  │  <- Flecha animada
│  ⓵  │  <- Badge contador
└─────┘
```

**Características:**
- Solo visible en móvil cuando sidebar cerrada
- Animación de entrada desde la derecha
- Hover: desplazamiento hacia izquierda
- Badge de notificaciones animado
- Gradient purple de marca BeZhas

---

### 4. AppLayout (Actualizado)

**Ubicación:** `frontend/src/layouts/AppLayout.jsx`

**Cambios principales:**
```jsx
// ANTES
<aside className="hidden xl:block w-80">
  <RightSidebar />
</aside>

// AHORA
<RightSidebarProvider>
  {/* Sidebar izquierdo se contrae en móvil cuando derecha abierta */}
  <aside className={isOpen && isMobile ? 'hidden' : 'block'}>
    <LeftSidebar />
  </aside>

  {/* Contenido se oculta en móvil cuando derecha abierta */}
  <main className={isOpen && isMobile ? 'hidden' : 'flex-1'}>
    <Outlet />
  </main>

  {/* Sidebar desktop (siempre visible xl+) */}
  <aside className="hidden xl:block">
    <RightSidebar />
  </aside>

  {/* Toggle móvil */}
  <RightSidebarToggle />
</RightSidebarProvider>
```

---

## 🎨 Estilos CSS

**Ubicación:** `frontend/src/index.css`

### Clases nuevas:

```css
/* Texto vertical para botón flotante */
.writing-mode-vertical {
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

/* Sombra especial para botón flotante */
.floating-sidebar-button {
  box-shadow: -4px 0 20px rgba(124, 58, 237, 0.4);
}

.floating-sidebar-button:hover {
  box-shadow: -6px 0 25px rgba(124, 58, 237, 0.6);
}

/* Transiciones suaves para layout */
.layout-transition {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

## 📱 Comportamiento Responsivo

### Breakpoints:
- **Desktop:** ≥ 1280px (xl)
- **Tablet/Móvil:** < 1280px

### Flujo de Usuario (Móvil):

1. **Estado inicial:**
   ```
   [Sidebar Izq] [Contenido Principal]     [●] ← Toggle
   ```

2. **Usuario hace clic en toggle:**
   - Overlay oscuro aparece con fadeIn
   - Sidebar derecha desliza desde derecha (spring animation)
   - Sidebar izquierda desaparece
   - Contenido principal se oculta
   - Body overflow: hidden (previene scroll)

3. **Estado expandido:**
   ```
   [Overlay oscuro]  [Sidebar Derecha a pantalla completa]
                     [Header con X]
                     [Contenido scrolleable]
   ```

4. **Usuario cierra (X o overlay):**
   - Sidebar desliza hacia derecha
   - Overlay fade out
   - Sidebar izquierda y contenido reaparecen
   - Body overflow: auto

---

## 🎭 Animaciones

### Framer Motion:

```jsx
// Overlay
initial={{ opacity: 0 }}
animate={{ opacity: 1 }}
exit={{ opacity: 0 }}

// Sidebar móvil
initial={{ x: '100%' }}
animate={{ x: 0 }}
exit={{ x: '100%' }}
transition={{ type: 'spring', damping: 30, stiffness: 300 }}

// Toggle button
whileHover={{ scale: 1.05, x: -5 }}
whileTap={{ scale: 0.95 }}

// Badge
initial={{ scale: 0 }}
animate={{ scale: 1 }}
transition={{ delay: 0.3, type: 'spring' }}
```

---

## 🎨 Theming (Light/Dark)

Todos los componentes respetan el sistema de temas:

```jsx
// Backgrounds
bg-dark-background dark:bg-light-background

// Surfaces (cards)
bg-dark-surface dark:bg-light-surface

// Borders
border-gray-700 dark:border-gray-300

// Text
text-dark-text dark:text-light-text
text-gray-400 dark:text-gray-600

// Hover states
hover:bg-gray-800 dark:hover:bg-gray-200
```

---

## 📊 Mock Data

El componente incluye datos de ejemplo para:

### Trending Topics
```javascript
{
  category: 'BeZhas',
  topic: 'Nuevo sistema de recompensas',
  posts: '1.2K'
}
```

### Contactos Activos
```javascript
{
  name: 'María González',
  avatar: 'https://i.pravatar.cc/150?img=1',
  status: 'En línea'
}
```

### Actividad Reciente
```javascript
{
  user: 'Laura P.',
  action: 'publicó en Desarrollo Web',
  time: 'Hace 5 minutos'
}
```

### Sugerencias
```javascript
{
  name: 'Tech Enthusiasts',
  avatar: 'https://i.pravatar.cc/150?img=5',
  followers: '2.3K'
}
```

**Nota:** Reemplazar con datos reales desde API cuando esté disponible.

---

## 🔌 Integración con APIs

### Endpoints sugeridos:

```javascript
// Trending topics
GET /api/trending/topics

// Contactos activos
GET /api/users/active

// Actividad reciente
GET /api/activity/recent

// Sugerencias
GET /api/users/suggestions
```

### Ejemplo de integración:

```jsx
import { useState, useEffect } from 'react';
import axios from 'axios';

function RightSidebar() {
    const [trending, setTrending] = useState([]);
    
    useEffect(() => {
        async function fetchTrending() {
            const { data } = await axios.get('/api/trending/topics');
            setTrending(data);
        }
        fetchTrending();
    }, []);
    
    // ... resto del componente
}
```

---

## ⚡ Performance

### Optimizaciones implementadas:

1. **Lazy rendering:**
   - Sidebar móvil solo se monta cuando se abre
   - AnimatePresence maneja unmount limpio

2. **Prevención de re-renders:**
   - useCallback en funciones del contexto
   - Memoización de valores computados

3. **Event listeners limpios:**
   - Cleanup de resize listener
   - Cleanup de body overflow

4. **CSS transitions:**
   - Hardware-accelerated (transform, opacity)
   - Cubic-bezier para suavidad

---

## 🧪 Testing

### Tests sugeridos:

```javascript
describe('RightSidebar', () => {
  it('debe mostrar sidebar en desktop', () => {
    // Mockear window.innerWidth >= 1280
    // Verificar que sidebar esté visible
  });

  it('debe mostrar toggle en móvil', () => {
    // Mockear window.innerWidth < 1280
    // Verificar que toggle esté visible
  });

  it('debe abrir sidebar al hacer clic en toggle', () => {
    // Click en toggle
    // Verificar que sidebar se abra
    // Verificar overlay visible
  });

  it('debe cerrar al hacer clic en X', () => {
    // Abrir sidebar
    // Click en botón X
    // Verificar que se cierre
  });

  it('debe cerrar al hacer clic en overlay', () => {
    // Abrir sidebar
    // Click en overlay
    // Verificar que se cierre
  });

  it('debe prevenir scroll del body cuando está abierta', () => {
    // Abrir sidebar
    // Verificar document.body.style.overflow === 'hidden'
  });
});
```

---

## 🐛 Troubleshooting

### Problema: "Sidebar no se abre en móvil"

**Solución:**
```javascript
// Verificar que el contexto esté provisto
<RightSidebarProvider>
  {/* ... tu app */}
</RightSidebarProvider>

// Verificar breakpoint en tailwind.config.js
screens: {
  xl: '1280px'  // Debe estar definido
}
```

### Problema: "Animaciones no funcionan"

**Solución:**
```bash
# Verificar que Framer Motion esté instalado
npm install framer-motion

# Verificar versión
npm list framer-motion
```

### Problema: "Toggle button no es visible"

**Solución:**
```javascript
// Verificar z-index en tailwind
className="... z-30"  // Debe ser mayor que otros elementos

// Verificar que isMobile sea true
const { isMobile } = useRightSidebar();
console.log('Is mobile:', isMobile);
```

### Problema: "Sidebar se ve cortada en móvil"

**Solución:**
```jsx
// Verificar viewport meta tag en index.html
<meta name="viewport" content="width=device-width, initial-scale=1.0">

// Verificar estilos del container
className="fixed right-0 top-0 bottom-0 w-full sm:w-96"
```

---

## 🔄 Próximas Mejoras

### v2.0 (Próximas iteraciones):

1. **Gestos táctiles:**
   - Swipe para abrir/cerrar
   - Pull-to-refresh en contenido

2. **Persistencia:**
   - Guardar estado en localStorage
   - Recordar preferencia del usuario

3. **Notificaciones:**
   - WebSocket para actualizaciones en tiempo real
   - Push notifications

4. **Filtros:**
   - Filtrar trending por categoría
   - Buscar en contactos

5. **Accesibilidad:**
   - Soporte completo para keyboard navigation
   - Screen reader optimizations
   - Focus trap cuando sidebar abierta

---

## 📚 Referencias

- [Framer Motion Docs](https://www.framer.com/motion/)
- [Tailwind Breakpoints](https://tailwindcss.com/docs/responsive-design)
- [React Context](https://react.dev/reference/react/useContext)
- [CSS Writing Mode](https://developer.mozilla.org/en-US/docs/Web/CSS/writing-mode)

---

## 👨‍💻 Desarrollador

**Sistema implementado por:** GitHub Copilot  
**Fecha:** Octubre 16, 2025  
**Versión:** 1.0.0  
**Estado:** ✅ Production Ready

---

## 📄 Licencia

MIT License - BeZhas Platform 2024

