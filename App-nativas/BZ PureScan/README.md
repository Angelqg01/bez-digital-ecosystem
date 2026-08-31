# BZ PureScan 🥬🔍

**BZ PureScan** es una aplicación de escaneo de trazabilidad alimentaria con IA de borde, análisis semántico con Gemini y sincronización blockchain nativa para BeZhas Food Oracle.

## 🎯 Características

- **Escaneo de Borde (YOLOv8)**: Inferencia local para detección ultra-rápida de productos
- **Análisis Semántico**: Gemini 2.0 Flash para análisis bromatológico en tiempo real
- **Blockchain L2**: Acuñación automática de Digital Product Passports (DPP) en Polygon/BSC
- **Inventario en Tiempo Real**: Gestión de stock con filtros avanzados
- **Identidad Digital**: Perfil DID con credenciales verificadas
- **Dashboard Operacional**: Métricas y alertas en vivo
- **Responsive**: Optimizado para dispositivos móviles y tablets

## 🛠️ Stack Tecnológico

- **Frontend**: React 18 + Vite 5
- **Estilos**: Tailwind CSS + Framer Motion
- **Web3**: ethers.js (preparado para integración)
- **UI Components**: Lucide React
- **HTTP Client**: Axios

## 📦 Instalación

### Requisitos
- Node.js 16+
- npm o pnpm

### Setup

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus valores

# 3. Compilar Tailwind (primera vez)
npm run build:css

# 4. Iniciar servidor de desarrollo
npm run dev
```

La app estará disponible en `http://localhost:3018`

## 📂 Estructura del Proyecto

```
src/
├── pages/
│   ├── Dashboard.jsx    # Visión general operativa
│   ├── Scanner.jsx      # Interfaz de escaneo AR
│   ├── Storage.jsx      # Gestión de inventario
│   └── Profile.jsx      # Perfil DID y credenciales
├── hooks/
│   └── useCustom.js     # Hooks personalizados (scan, fetch, etc.)
├── api.js               # Cliente HTTP y mock data
├── App.jsx              # Ruteador principal
├── index.css            # Estilos globales + Tailwind
└── main.jsx             # Entry point
```

## 🚀 Uso

### Flujo de Escaneo Típico

1. **Navegar a Scanner** → Toca el botón de cámara
2. **Captura y Análisis**:
   - Edge AI detecta productos (YOLOv8)
   - Gemini analiza características bromatológicas
   - Blockchain acuña DPP NFT
3. **Resultados** → Ver detalles, compartir o exportar

### Gestión de Inventario

- **Storage Tab**: Lista todos los items con filtros por estado
- **Búsqueda**: Filtra por producto o SKU
- **Acciones**: Export, limpieza de items verificados

### Perfil DID

- Ver tu identidad digital en BeZhas
- Gestionar credenciales y métodos de verificación
- Configurar API keys para integración

## 🔌 Integración API

### Endpoints Esperados

```
POST /api/purescan/analyze
  Body: { detections[], metrics{} }
  Response: { analysis{}, processing_time_ms }

POST /api/purescan/blockchain/sync
  Body: { analysis{}, dppData{} }
  Response: { transaction{}, token_id }

GET /api/purescan/inventory
  Query: { filters? }
  Response: [ { id, sku, product, quantity, status } ]

GET /api/purescan/profile/did
  Response: { did, name, verified, credentials[] }
```

### Mock Mode

Si el backend no está disponible, la app usa datos simulados. Configurable en `api.js`:

```javascript
// Fallback automático a mock si API falla
const response = await api.post('/analyze', data)
  .catch(err => generateMockData.geminiAnalysis(scanData))
```

## 🎨 Design System

Siguiendo el **Editorial Logistics Design System** de BeZhas:

- **Paleta**: Deep Navy (`#101922`) + Neon (`#39ff14`) + Primary (`#2b8cee`)
- **Tipografía**: Space Grotesk (display) + Inter (body)
- **No-Line Rule**: Sin bordes 1px, usa glassmorphism + tonal shifts
- **Spacing**: 24px gaps para "editorial breathing room"

### Componentes Tailwind Disponibles

```css
/* Cards */
.card          /* Base card con glassmorphism */
.card.glass    /* Aún más translúcido */
.card.elevated /* Con sombra ambient */

/* Botones */
.btn
.btn-primary   /* Gradient azul → cyan */
.btn-secondary /* Ghost style */
.btn-icon      /* Circular icon button */
.btn-icon-lg   /* Circular large button */

/* Status */
.status-badge
.status-badge.verified
.status-badge.pending
.status-badge.error
```

## 🧪 Testing

### Setup de Pruebas
```bash
npm install --save-dev vitest @testing-library/react
npm run test
```

### Test de Integración
```bash
# Verificar que todos los hooks funcionan
npm run test:hooks

# Test E2E del flujo de scanning
npm run test:scan
```

## ⚡ Optimización & Performance

### Code Splitting
```javascript
// React.lazy para rutas no críticas
const Profile = React.lazy(() => import('./pages/Profile'))
```

### Lazy Loading de Imágenes
```html
<img src="..." loading="lazy" />
```

### Memoization
- `React.memo()` en componentes puros
- `useCallback()` en event handlers
- `useMemo()` para cálculos costosos

### Bundle Size
```bash
# Analizar bundle
npm run build && npm run analyze
```

**Tamaño objetivo**: <150KB gzipped

## 🔒 Seguridad

⚠️ **Nunca** almacenar:
- Private keys
- API tokens en código
- Datos sensibles en localStorage

✅ **Mejores prácticas**:
- Variables de entorno para secrets
- HTTPS en producción
- CORS configurado correctamente
- Validación de input en cliente + servidor

## 📱 Deployment

### Vercel
```bash
vercel deploy
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run build
EXPOSE 3018
CMD ["npm", "run", "preview"]
```

### Build Estático
```bash
npm run build
# Salida en dist/
```

## 🤝 Contribución

1. Fork el repo
2. Crea rama: `git checkout -b feature/mi-feature`
3. Commit: `git commit -am 'Add feature'`
4. Push: `git push origin feature/mi-feature`
5. PR a `main`

## 📞 Soporte

- **Issues**: GitHub Issues
- **Docs**: `./doc/` folder
- **Email**: dev@bez.digital

## 📄 Licencia

BeZhas Proprietary - Todos los derechos reservados 2024-2026

---

**Hecho con ❤️ by Yoel @ BeZhas**

*Última actualización: Marzo 2026*
