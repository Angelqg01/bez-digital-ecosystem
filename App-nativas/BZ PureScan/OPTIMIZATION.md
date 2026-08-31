# 🚀 Guía de Optimización y Mejores Prácticas - BZ PureScan

## Performance Optimization

### 1. Bundle Size Optimization
```bash
# Analizar tamaño del bundle
npm run build --report

# Comprimir imágenes
# Usar WebP en lugar de PNG/JPG
# Lazy load images con loading="lazy"
```

### 2. Code Splitting
```javascript
// ✅ BIEN: Lazy load rutas no críticas
const Profile = React.lazy(() => import('./pages/Profile'))

// Suspense fallback
<Suspense fallback={<LoadingSpinner />}>
  <Profile />
</Suspense>
```

### 3. Memoization
```javascript
// ✅ Memorizar componentes puros
export const ManifestItem = React.memo(({ item }) => {
  return <div>{item.name}</div>
})

// ✅ Cachear funciones callback
const handleScan = useCallback(() => {
  startScan()
}, [startScan])

// ✅ Memorizar valores computados
const filteredItems = useMemo(() => {
  return items.filter(i => i.status === 'verified')
}, [items])
```

### 4. Network Optimization
```javascript
// ✅ Debounce búsquedas
const debouncedSearch = useDebounce(searchQuery, 300)

// ✅ Request batching
Promise.all([
  getInventory(),
  getAnalytics(),
  getDIDProfile()
])

// ✅ Request caching
const { data, refetch } = useFetch(getInventory)
```

### 5. CSS Optimization
- Usar Tailwind CSS (auto-purging)
- Minimal CSS variables
- Hardware acceleration con `will-change` (sparse)

```css
.scan-line {
  will-change: top;
  transform: translateZ(0);
}
```

## Code Quality

### 1. Component Structure
```javascript
// ✅ BIEN: Props desestructuradas, exports named
export const Scanner = ({ onResult, disabled }) => {
  // Component logic
}

// ❌ MALO: Props genéricas, exports default
const component = (props) => { }
```

### 2. State Management
- Local state: `useState()`
- Shared state: Context API o props drilling
- Global state: Considerar Redux si crece

### 3. Error Handling
```javascript
try {
  const result = await analyzeWithGemini(data)
} catch (error) {
  if (error.response?.status === 408) {
    showToast('Timeout - intenta de nuevo')
  } else {
    showToast(ERROR_MESSAGES.NETWORK_ERROR)
  }
}
```

### 4. Type Safety (Future TypeScript)
```typescript
// Cuando migres a TS
interface ScanResult {
  edge: EdgeDetection
  gemini: GeminiAnalysis
  tx: BlockchainTransaction
}
```

## Testing Strategy

### Unit Tests
```javascript
// Test hooks personalizados
test('useScanProcess starts scan and updates phase', async () => {
  const { result } = renderHook(() => useScanProcess())
  await act(async () => {
    result.current.startScan()
  })
  expect(result.current.phase).toBe('done')
})
```

### Integration Tests
```javascript
// Test flujo completo de scanning
test('Scanner: edge -> gemini -> blockchain', async () => {
  render(<Scanner />)
  const button = screen.getByRole('button', { name: /scan/i })
  await userEvent.click(button)
  expect(screen.getByText(/gemini/i)).toBeInTheDocument()
  // ... más assertions
})
```

### E2E Tests
```javascript
// Cypress/Playwright
describe('BZ PureScan E2E', () => {
  it('completes full scan flow', () => {
    cy.visit('/')
    cy.get('[data-test=scan-btn]').click()
    cy.get('[data-test=results]').should('be.visible')
  })
})
```

## Security Best Practices

### 1. Environment Variables
```bash
# ✅ BIEN: Usar .env.local
VITE_API_URL=...
VITE_CONTRACT_ADDRESS=...

# ❌ MALO: Hardcodear valores sensibles
const API_URL = "http://..."
```

### 2. Input Validation
```javascript
if (!isValidAddress(address)) {
  return { error: 'Invalid address' }
}

if (!/^0x[a-f0-9]{40}$/i.test(hash)) {
  throw new Error('Invalid hash')
}
```

### 3. CORS Handling
```javascript
// Backend debe configurar CORS correctamente
res.header('Access-Control-Allow-Origin', 'https://bez.digital')
res.header('Access-Control-Allow-Methods', 'GET,POST')
res.header('Access-Control-Max-Age', '86400')
```

### 4. XSS Prevention
```javascript
// ✅ BIEN: Tailwind y React escapeando automáticamente
<p>{userInput}</p>

// ❌ MALO: dangerouslySetInnerHTML
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

## SEO & Accessibility

### 1. Semantic HTML
```jsx
// ✅ BIEN
<button aria-label="Scan product" />
<section role="main">

// ❌ MALO
<div onClick={() => {}} />
```

### 2. Keyboard Navigation
```javascript
useEffect(() => {
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleStartScan()
  }
  document.addEventListener('keydown', handleKeyPress)
  return () => document.removeEventListener('keydown', handleKeyPress)
}, [])
```

### 3. ARIA Labels
```jsx
<button aria-label="Exportar inventario como CSV">
  <Download /> Export
</button>
```

## Deployment Checklist

- [ ] Variables de entorno configuradas
- [ ] SSL/HTTPS habilitado
- [ ] CORS correctamente configurado
- [ ] Rate limiting en backend
- [ ] Monitoring y logging
- [ ] Backup strategy
- [ ] Database optimization
- [ ] CDN para assets estáticos
- [ ] Service Worker para offline (PWA)
- [ ] Analytics implementado

## Monitoring & Analytics

### 1. Error Tracking
```javascript
import * as Sentry from "@sentry/react"

Sentry.captureException(error)
```

### 2. Performance Monitoring
```javascript
import { web } from 'core-vitals'

web.getCLS(console.log) // Cumulative Layout Shift
web.getFID(console.log) // First Input Delay
web.getFCP(console.log) // First Contentful Paint
```

### 3. User Analytics
```javascript
// Track important events
gtag.event('scan_completed', {
  quality_score: results.gemini.analysis.freshness_index,
  processing_time: progress
})
```

## Escalabilidad

### 1. Database Optimization
```sql
-- Índices necesarios
CREATE INDEX idx_scans_timestamp ON scans(created_at DESC)
CREATE INDEX idx_inventory_status ON inventory(status)
CREATE INDEX idx_did_address ON profiles(did_address)
```

### 2. Caching Strategy
```javascript
// Redis para datos frecuentes
const cachedInventory = await redis.get('inventory:all')
if (!cachedInventory) {
  inventory = await db.getInventory()
  redis.setex('inventory:all', 3600, JSON.stringify(inventory))
}
```

### 3. API Rate Limiting
```javascript
// Limitar requests por IP/usuario
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100 // requests por ventana
})

app.use('/api/purescan/', limiter)
```

## Metrics Objetivo

- 📊 Lighthouse Score: >90
- ⚡ FCP: <1.5s
- ⏱️ TTI: <3.5s
- 📦 Bundle Size: <150KB (gzipped)
- 🎯 Accuracy: >99%
- ⏳ Processing Time: <5s total

---

*Última actualización: Marzo 2026*
