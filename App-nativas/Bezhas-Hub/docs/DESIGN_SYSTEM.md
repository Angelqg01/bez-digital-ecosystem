# 🎨 BeZhas Web3 - Sistema de Diseño Light Mode

## 📋 Índice
1. [Introducción](#introducción)
2. [Paleta de Colores](#paleta-de-colores)
3. [Componentes](#componentes)
4. [Implementación](#implementación)
5. [Responsividad](#responsividad)
6. [Mejores Prácticas](#mejores-prácticas)

---

## 🌟 Introducción

Sistema de diseño completo para BeZhas Web3 con enfoque en **Light Mode** (paleta pastel/lavanda), completamente responsivo (Mobile-First) y optimizado para aplicaciones Web3.

### Características Principales
- ✅ Paleta de colores pastel/lavanda coherente
- ✅ Componentes reutilizables (Header, Sidebar, Cards)
- ✅ Diseño 100% responsivo (Mobile-First)
- ✅ Soporte Dark Mode incluido
- ✅ Animaciones suaves y modernas
- ✅ Accesibilidad incorporada

---

## 🎨 Paleta de Colores

### Colores Primarios (Lavanda/Morado)
```css
primary-50:  #faf5ff  /* Lavanda muy claro */
primary-100: #f3e8ff  /* Lavanda pastel */
primary-200: #e9d5ff  /* Lavanda claro */
primary-300: #d8b4fe  /* Lavanda medio */
primary-400: #c084fc  /* Lavanda */
primary-500: #a855f7  /* Morado lavanda */
primary-600: #9333ea  /* Morado (Principal) */
primary-700: #7e22ce  /* Morado oscuro */
```

### Colores Acento (Rosa Pastel)
```css
accent-50:  #fdf2f8  /* Rosa muy claro */
accent-100: #fce7f3  /* Rosa pastel */
accent-200: #fbcfe8  /* Rosa claro */
accent-300: #f9a8d4  /* Rosa medio */
accent-400: #f472b6  /* Rosa */
accent-500: #ec4899  /* Rosa fuerte */
accent-600: #db2777  /* Rosa oscuro */
```

### Colores Sky (Azul Pastel)
```css
sky-50:  #f0f9ff  /* Azul cielo muy claro */
sky-100: #e0f2fe  /* Azul cielo pastel */
sky-200: #bae6fd  /* Azul cielo claro */
sky-300: #7dd3fc  /* Azul cielo medio */
sky-400: #38bdf8  /* Azul cielo */
sky-500: #0ea5e9  /* Azul cielo fuerte */
```

### Backgrounds Light Mode
```css
light-bg:     #fdfbff  /* Fondo principal blanco-lavanda */
light-card:   #ffffff  /* Fondo tarjetas blanco puro */
light-hover:  #f8f4ff  /* Estado hover lavanda muy claro */
light-border: #e9d5ff  /* Bordes lavanda pastel */
light-muted:  #f3f4f6  /* Backgrounds secundarios */
```

### Textos
```css
text-primary:   #1f2937  /* Gris oscuro */
text-secondary: #6b7280  /* Gris medio */
text-muted:     #9ca3af  /* Gris claro */
text-accent:    #9333ea  /* Morado acento */
```

### Gradientes
```css
bg-gradient-light:   linear-gradient(135deg, #faf5ff 0%, #fdf2f8 100%)
bg-gradient-primary: linear-gradient(135deg, #e9d5ff 0%, #fbcfe8 100%)
bg-gradient-hero:    linear-gradient(135deg, #f0f9ff 0%, #faf5ff 50%, #fdf2f8 100%)
bg-gradient-card:    linear-gradient(180deg, #ffffff 0%, #faf5ff 100%)
```

---

## 🧩 Componentes

### 1. LightHeader
Header fijo y responsivo con búsqueda, notificaciones y menú de usuario.

**Props:**
```javascript
{
  onMenuToggle: () => void,  // Función para abrir/cerrar sidebar
  isMenuOpen: boolean        // Estado del sidebar
}
```

**Características:**
- Sticky header con backdrop blur
- Barra de búsqueda (desktop y mobile)
- Notificaciones con dropdown
- Menú de usuario
- Responsive (menú hamburguesa en móvil)

### 2. LightSidebar
Sidebar colapsable con navegación organizada por secciones.

**Props:**
```javascript
{
  isOpen: boolean,    // Estado de apertura
  onClose: () => void // Función para cerrar
}
```

**Características:**
- Navegación por secciones
- Indicador de página activa
- Badges para notificaciones
- CTA destacado (Crear NFT)
- Overlay en móvil
- Animaciones suaves

### 3. NFTCard
Card para mostrar NFTs con imagen, información y acciones.

**Props:**
```javascript
{
  image: string,
  title: string,
  creator: string,
  price: string,
  likes: number,
  views: number,
  trending: boolean,
  verified: boolean,
  onLike: () => void,
  onAddToCart: () => void,
  onClick: () => void
}
```

**Características:**
- Aspecto ratio 3:4 (estilo libro/póster)
- Hover con overlay y acciones
- Badges (trending, verified)
- Stats (likes, views)
- Animación de escala

### 4. CollectionCard
Card para mostrar colecciones con banner y estadísticas.

**Props:**
```javascript
{
  banner: string,
  avatar: string,
  name: string,
  creator: string,
  itemCount: string,
  floorPrice: string,
  volume: string,
  verified: boolean,
  onClick: () => void
}
```

### 5. CardGrid
Container responsivo para organizar cards.

**Props:**
```javascript
{
  children: ReactNode,
  columns: 2 | 3 | 4 | 5  // Número de columnas en desktop
}
```

**Breakpoints:**
```
columns={4}:
- Mobile: 1 columna
- Tablet (sm): 2 columnas
- Desktop (lg): 3 columnas
- Large Desktop (xl): 4 columnas
```

### 6. LightLayout
Layout principal que integra Header + Sidebar + Content.

**Props:**
```javascript
{
  children: ReactNode
}
```

**Estructura:**
```
<LightLayout>
  {/* Tu contenido aquí */}
</LightLayout>
```

---

## 🚀 Implementación

### Paso 1: Importar el CSS de tema

```javascript
// En tu archivo principal (main.jsx o App.jsx)
import './styles/theme.css';
```

### Paso 2: Configurar Tailwind

El archivo `tailwind.config.js` ya está configurado con la paleta completa.

### Paso 3: Usar el Layout

```javascript
import LightLayout from './components/layout/LightLayout';

function App() {
  return (
    <LightLayout>
      {/* Tu contenido */}
    </LightLayout>
  );
}
```

### Paso 4: Usar los Componentes

```javascript
import { NFTCard, CardGrid } from './components/cards/LightCards';

function MyPage() {
  return (
    <LightLayout>
      <CardGrid columns={4}>
        <NFTCard
          image="url"
          title="Mi NFT"
          creator="Artista"
          price="2.5"
          likes={100}
          views={500}
          trending={true}
          verified={true}
          onClick={() => console.log('click')}
        />
      </CardGrid>
    </LightLayout>
  );
}
```

---

## 📱 Responsividad (Mobile-First)

### Breakpoints de Tailwind
```css
sm:  640px   /* Tablet pequeña */
md:  768px   /* Tablet */
lg:  1024px  /* Desktop */
xl:  1280px  /* Desktop grande */
2xl: 1536px  /* Desktop extra grande */
```

### Estrategia Mobile-First

1. **Sidebar**
   - Móvil: Drawer con overlay
   - Desktop: Sidebar fijo

2. **Header**
   - Móvil: Logo + menú hamburguesa + acciones básicas
   - Desktop: Logo + búsqueda + todas las acciones

3. **Cards**
   - Móvil: 1 columna
   - Tablet: 2 columnas
   - Desktop: 3-4 columnas

4. **Espaciado**
   - Móvil: padding 1rem
   - Tablet: padding 1.5rem
   - Desktop: padding 2rem

### Ejemplos de Uso

```jsx
{/* Responsive padding */}
<div className="p-4 md:p-6 lg:p-8">

{/* Responsive grid */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

{/* Responsive text */}
<h1 className="text-2xl md:text-3xl lg:text-4xl">

{/* Hide on mobile */}
<div className="hidden md:block">

{/* Show only on mobile */}
<div className="md:hidden">
```

---

## ✨ Mejores Prácticas

### 1. Usa las Clases de Utilidad
```jsx
{/* ✅ Bueno - Usa clases predefinidas */}
<div className="card p-6">

{/* ❌ Evitar - Inline styles */}
<div style={{ padding: '24px', borderRadius: '12px' }}>
```

### 2. Animaciones Consistentes
```jsx
{/* Usa las animaciones del sistema */}
<div className="animate-fade-in">
<div className="animate-slide-up">
<div className="animate-scale-in">
```

### 3. Dark Mode Support
```jsx
{/* Siempre incluye variante dark */}
<div className="bg-white dark:bg-gray-800 text-text-primary dark:text-white">
```

### 4. Accesibilidad
```jsx
{/* Usa aria-labels */}
<button aria-label="Cerrar menú">

{/* Usa focus-visible */}
<button className="focus-visible:outline-2">
```

### 5. Componentes Reutilizables
```jsx
// Crea variantes del componente en vez de duplicar código
function MyCard({ variant = 'default' }) {
  const variants = {
    default: 'bg-white',
    primary: 'bg-gradient-primary',
    accent: 'bg-gradient-accent'
  };
  
  return <div className={`card ${variants[variant]}`} />;
}
```

---

## 🎯 Casos de Uso

### Homepage
```jsx
import LightHomePage from './pages/LightHomePage';
// Ya incluye Hero, Stats, NFTs y Colecciones
```

### Página Custom
```jsx
import LightLayout from './components/layout/LightLayout';
import { SimpleCard, CardGrid } from './components/cards/LightCards';

export default function MyPage() {
  return (
    <LightLayout>
      <h1 className="text-3xl font-bold text-gradient mb-6">
        Mi Página
      </h1>
      
      <CardGrid columns={3}>
        <SimpleCard
          image="url"
          title="Item 1"
          description="Descripción"
          tag="Nuevo"
        />
      </CardGrid>
    </LightLayout>
  );
}
```

---

## 🔧 Personalización

### Modificar Colores
Edita `tailwind.config.js`:
```javascript
colors: {
  primary: {
    600: '#TU_COLOR_AQUI',
  }
}
```

### Agregar Nuevas Animaciones
Edita `tailwind.config.js`:
```javascript
animation: {
  'mi-animacion': 'miKeyframe 0.3s ease-out',
},
keyframes: {
  miKeyframe: {
    '0%': { /* inicio */ },
    '100%': { /* fin */ },
  }
}
```

### Crear Nuevos Componentes
Sigue el patrón de los componentes existentes:
```jsx
export function MiComponente({ props }) {
  return (
    <div className="card bg-white dark:bg-gray-800">
      {/* Contenido */}
    </div>
  );
}
```

---

## 📚 Recursos Adicionales

- **Tailwind CSS:** https://tailwindcss.com/docs
- **Lucide Icons:** https://lucide.dev/
- **React Router:** https://reactrouter.com/

---

## 🎉 ¡Listo para Usar!

Tu sistema de diseño BeZhas Web3 está completo y listo para producción. Todos los componentes son:
- ✅ Responsivos (Mobile-First)
- ✅ Accesibles
- ✅ Con soporte Dark Mode
- ✅ Optimizados para performance
- ✅ Totalmente personalizables

**¡Comienza a construir tu aplicación Web3 ahora!** 🚀
