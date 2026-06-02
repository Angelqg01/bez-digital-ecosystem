# ✅ Checklist de Pruebas - Sistema de Guías y Google Translate

## 🎯 Estado: EN PROGRESO

---

## 📋 Pruebas Generales

### 1. Google Translate Widget (Global)
- [ ] **Visibilidad**: Widget visible en la esquina superior derecha
- [ ] **Posicionamiento**: No obstruye contenido importante
- [ ] **Funcionalidad**: Al hacer clic muestra selector de idiomas
- [ ] **Idiomas Disponibles**: Muestra los 13 idiomas configurados
- [ ] **Traducción**: Seleccionar un idioma traduce la interfaz
- [ ] **Persistencia**: Mantiene idioma seleccionado al cambiar de página
- [ ] **Diseño**: Estilos personalizados de Bezhas aplicados
- [ ] **Responsive**: Funciona bien en móvil/tablet/desktop

### 2. Botón de Ayuda Flotante
- [ ] **Visibilidad**: Botón (?) visible en la esquina inferior derecha
- [ ] **Animación**: Efecto de pulso activo
- [ ] **Posicionamiento**: No obstruye contenido principal
- [ ] **Z-index**: Se muestra sobre otros elementos
- [ ] **Hover**: Efecto de scale al pasar el mouse
- [ ] **Responsive**: Posición correcta en todos los dispositivos

---

## 📄 Pruebas por Página

### HomePage (/)
- [ ] **PageGuide**: Botón flotante visible
- [ ] **Contenido**: Muestra guía DEFAULT
- [ ] **Apertura**: Panel se desliza correctamente
- [ ] **Cierre**: Se cierra con X o backdrop
- [ ] **Google Translate**: Widget visible y funcional

### DAO Page (/dao-page)
- [ ] **PageGuide**: Botón flotante visible
- [ ] **Contenido**: Muestra guía de DAO con:
  - [ ] Descripción de gobernanza
  - [ ] 4+ funcionalidades
  - [ ] 5+ casos de uso
  - [ ] 2+ problemas comunes
- [ ] **Scroll**: Scroll funciona dentro del panel
- [ ] **Diseño**: Gradientes indigo/purple aplicados
- [ ] **Google Translate**: Traduce correctamente

### Marketplace (/nft-marketplace)
- [ ] **PageGuide**: Botón flotante visible
- [ ] **Contenido**: Muestra guía de MARKETPLACE
- [ ] **Funcionalidad**: Panel abre/cierra correctamente
- [ ] **Google Translate**: Traduce correctamente

### DeFi Hub (/defi)
- [ ] **PageGuide**: Botón flotante visible
- [ ] **Contenido**: Muestra guía de DEFI
- [ ] **Casos de Uso**: Ejemplos de swaps, préstamos, farming
- [ ] **FAQ**: Problemas comunes visibles

### Logistics (/logistics)
- [ ] **PageGuide**: Botón flotante visible
- [ ] **Contenido**: Muestra guía de LOGISTICS
- [ ] **Información**: Trazabilidad IoT, Supply Chain
- [ ] **Google Translate**: Traduce correctamente

### Developer Console (/developer-console)
- [ ] **PageGuide**: Botón flotante visible
- [ ] **Contenido**: Muestra guía de SDK_API
- [ ] **Información**: API, Webhooks, SDK
- [ ] **Casos de Uso**: Ejemplos de integración

### Real Estate Game (/real-estate)
- [ ] **PageGuide**: Botón flotante visible
- [ ] **Contenido**: Muestra guía de RWA
- [ ] **Información**: Tokenización de activos
- [ ] **Casos de Uso**: Inversión fraccionada

### BeVIP (/vip)
- [ ] **PageGuide**: Botón flotante visible
- [ ] **Contenido**: Muestra guía de VIP
- [ ] **Información**: Niveles, beneficios, fees
- [ ] **Google Translate**: Traduce correctamente

### BeZhas Feed (/feed)
- [ ] **PageGuide**: Botón flotante visible
- [ ] **Contenido**: Muestra guía de SOCIAL
- [ ] **Información**: Red social Web3, monetización
- [ ] **Google Translate**: Traduce correctamente

---

## 🎨 Pruebas de Diseño

### Panel de Guía
- [ ] **Header**: Título con gradiente indigo/purple
- [ ] **Secciones**: 4 secciones claramente separadas
- [ ] **Iconos**: SVG icons renderizados correctamente
- [ ] **Colores**: Paleta de colores consistente
- [ ] **Tipografía**: Fuentes legibles y jerarquía clara
- [ ] **Borders**: Bordes con efecto glow sutiles
- [ ] **Backdrop**: Blur + transparencia negra
- [ ] **Scrollbar**: Scrollbar personalizada visible

### Animaciones
- [ ] **Entrada**: Panel desliza desde la derecha (300ms)
- [ ] **Salida**: Panel sale hacia la derecha
- [ ] **Backdrop**: Fade in/out suave
- [ ] **Hover**: Efectos en botones y cards
- [ ] **Sin lag**: Animaciones fluidas sin retrasos

### Responsive
- [ ] **Desktop (>1024px)**: Panel 450px ancho
- [ ] **Tablet (768-1024px)**: Panel 450px ancho
- [ ] **Móvil (<768px)**: Panel ancho completo
- [ ] **Botón flotante**: Posición correcta en todos los tamaños

---

## 🌍 Pruebas de Traducción

### Idiomas Principales
- [ ] **Español**: Idioma por defecto, sin cambios
- [ ] **Inglés**: Traduce interfaz completa
- [ ] **Francés**: Traduce correctamente
- [ ] **Alemán**: Traduce correctamente
- [ ] **Portugués**: Traduce correctamente

### Funcionalidad
- [ ] **Selector**: Dropdown muestra todos los idiomas
- [ ] **Traducción**: Cambia al seleccionar idioma
- [ ] **Persistencia**: Mantiene idioma al navegar
- [ ] **Contenido Dinámico**: Traduce contenido cargado dinámicamente
- [ ] **Sin errores**: No aparece banner de Google
- [ ] **Performance**: No afecta velocidad de carga

---

## 🔧 Pruebas Técnicas

### Performance
- [ ] **Tiempo de carga**: <2 segundos
- [ ] **FPS**: >55 fps con animaciones
- [ ] **Memory**: No hay memory leaks
- [ ] **Bundle size**: Componentes no aumentan mucho el bundle

### localStorage
- [ ] **Guarda estado**: Marca guías como "vistas"
- [ ] **Auto-apertura**: Solo abre en primera visita
- [ ] **Limpieza**: Puede resetear estado limpiando localStorage

### Consola
- [ ] **Sin errores**: Console.log sin errores
- [ ] **Sin warnings**: No hay warnings de React
- [ ] **Scripts**: Google Translate carga correctamente

---

## 🐛 Pruebas de Casos Extremos

### Edge Cases
- [ ] **Sin conexión**: Widget de Google Translate maneja error
- [ ] **Contenido largo**: Scroll funciona con mucho contenido
- [ ] **Apertura rápida**: No hay glitches al abrir/cerrar rápido
- [ ] **Múltiples páginas**: Funciona al navegar entre páginas
- [ ] **Recarga**: Estado se mantiene tras F5

### Compatibilidad
- [ ] **Chrome**: Funciona correctamente
- [ ] **Firefox**: Funciona correctamente
- [ ] **Safari**: Funciona correctamente (si aplica)
- [ ] **Edge**: Funciona correctamente

---

## 📊 Resultados

### ✅ Pasadas: 0/80+
### ❌ Fallidas: 0
### ⏭️ Pendientes: 80+

---

## 📝 Notas de Prueba

### Bugs Encontrados:
- Ninguno por ahora

### Mejoras Sugeridas:
- Por determinar después de las pruebas

### Issues:
- Ninguno

---

## 🎉 Estado Final

**ESTADO**: 🟡 EN PRUEBAS

**Fecha**: 15 de Enero de 2026  
**Tester**: Sistema de Testing Automatizado  
**Versión**: 1.0.0
