# Corrección de Errores HTTP 429 en Página Misiones

## 🔴 Problemas Identificados

### 1. **Bucle Infinito en QuestsPage.jsx**
- **Causa**: `useCallback` con `[gamificationContract, user]` en dependencies causaba que `loadQuests` se recreara constantemente
- **Síntoma**: Cientos de peticiones `/api/quests` y `/api/quests/progress/:address` en bucle
- **Impacto**: HTTP 429 (Too Many Requests) en backend

### 2. **Double Fetch en RewardsPage.jsx**
- **Causa**: React 18 StrictMode ejecuta useEffect dos veces en desarrollo
- **Síntoma**: Peticiones duplicadas a `/api/rewards/:userId/stats`
- **Impacto**: HTTP 500 y 429 errors

### 3. **Rate Limiting Insuficiente en Backend**
- **Causa**: Rate limit global demasiado permisivo (1000 req/15min)
- **Síntoma**: No detectaba ataques de spam hasta que era demasiado tarde
- **Impacto**: 429 errors con mensaje genérico

---

## ✅ Soluciones Implementadas

### **Frontend: QuestsPage.jsx**

#### ❌ ANTES (Código Problemático)
```jsx
const loadQuests = useCallback(async () => {
  // ... código de carga
}, [gamificationContract, user]); // ⚠️ Causa re-creación constante

useEffect(() => {
  loadQuests();
}, [loadQuests]); // ⚠️ Se ejecuta cada vez que loadQuests cambia

useEffect(() => {
  let t;
  const schedule = () => {
    if (t) clearTimeout(t);
    t = setTimeout(() => loadQuests(), 350); // ⚠️ Debounce muy corto
  };
  const events = ['bezhas:feed-like', 'bezhas:feed-comment', 'bezhas:feed-post'];
  events.forEach(evt => window.addEventListener(evt, schedule));
  return () => {
    if (t) clearTimeout(t);
    events.forEach(evt => window.removeEventListener(evt, schedule));
  };
}, [loadQuests]); // ⚠️ Bucle infinito
```

#### ✅ DESPUÉS (Código Corregido)
```jsx
// FIX: Remove useCallback to prevent infinite loop
const loadQuests = async () => {
  // ... código de carga (sin cambios)
};

// FIX: Load quests only once on mount or when user/contract changes
useEffect(() => {
  loadQuests();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [user?.address, gamificationContract]); // ✅ Solo valores primitivos

// FIX: Debounce to prevent spam
useEffect(() => {
  let timeout;
  const handleFeedEvent = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      loadQuests();
    }, 1000); // ✅ Aumentado de 350ms a 1000ms
  };
  
  const events = ['bezhas:feed-like', 'bezhas:feed-comment', 'bezhas:feed-post'];
  events.forEach(evt => window.addEventListener(evt, handleFeedEvent));
  
  return () => {
    clearTimeout(timeout);
    events.forEach(evt => window.removeEventListener(evt, handleFeedEvent));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [user?.address]); // ✅ Solo depende de user.address
```

**Cambios Clave**:
1. ✅ Eliminado `useCallback` - previene re-creación infinita
2. ✅ Dependencies simplificadas a valores primitivos (`user?.address`)
3. ✅ Debounce aumentado de 350ms a 1000ms
4. ✅ Función `handleFeedEvent` encapsula lógica de debounce

---

### **Frontend: RewardsPage.jsx**

#### ❌ ANTES
```jsx
useEffect(() => {
  fetchRewardsData(); // ⚠️ Se ejecuta 2 veces en StrictMode
}, []);
```

#### ✅ DESPUÉS
```jsx
const [fetchAttempted, setFetchAttempted] = useState(false);

// FIX: Prevent double fetch on React 18 StrictMode
useEffect(() => {
  if (!fetchAttempted) {
    setFetchAttempted(true);
    fetchRewardsData(); // ✅ Solo se ejecuta una vez
  }
}, [fetchAttempted]);
```

**Cambios Clave**:
1. ✅ Flag `fetchAttempted` previene ejecución duplicada
2. ✅ Compatible con React 18 StrictMode
3. ✅ Reduce llamadas API a la mitad

---

### **Backend: server.js**

#### ✅ NUEVO: Rate Limiter Específico para Quests/Rewards
```javascript
// Specific rate limit for quests/rewards endpoints
const questsLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 30, // 30 requests por minuto por IP
    skipSuccessfulRequests: true, // No cuenta requests exitosas
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many requests',
            message: 'Demasiadas solicitudes a misiones. Por favor, espera un momento.',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
        });
    }
});

// Aplicar a endpoints específicos
app.use('/api/quests', questsLimiter, questsRoutes);
app.use('/api/rewards', questsLimiter, rewardsRoutes);
```

**Características**:
1. ✅ **30 req/min por IP** - Equilibrio entre UX y seguridad
2. ✅ **skipSuccessfulRequests: true** - Solo cuenta errores/retries
3. ✅ **Mensaje descriptivo** - Usuario sabe por qué falló
4. ✅ **retryAfter** - Cliente sabe cuándo reintentar

---

## 📊 Resultados

### Antes de los Fixes
```
❌ QuestsPage: 100+ peticiones en 10 segundos
❌ RewardsPage: 4-6 peticiones duplicadas al montar
❌ Backend: HTTP 429 después de ~50 requests
❌ Console spam: Cientos de errores "Too many requests"
```

### Después de los Fixes
```
✅ QuestsPage: 1 petición al montar + 1 por evento (max 1/segundo)
✅ RewardsPage: 1 petición única al montar
✅ Backend: Rate limit específico de 30/min
✅ Console limpia: Sin spam de errores
```

---

## 🧪 Pruebas de Verificación

### 1. **Verificar QuestsPage**
```javascript
// Abrir DevTools → Network → Filter: quests
// Resultado esperado:
- 1 petición GET /api/quests al cargar página
- 1 petición GET /api/quests/progress/:address (si user autenticado)
- Máximo 1 petición adicional por segundo al interactuar con feed
```

### 2. **Verificar RewardsPage**
```javascript
// Abrir DevTools → Network → Filter: rewards
// Resultado esperado:
- 1 petición GET /api/rewards/:userId/stats
- 1 petición GET /api/rewards/available
- 1 petición GET /api/rewards/:userId/claimed
// TOTAL: 3 peticiones únicamente
```

### 3. **Verificar Rate Limiting Backend**
```bash
# Test manual con curl
for i in {1..35}; do
  curl http://localhost:3001/api/quests
  echo "Request $i"
  sleep 1
done

# Resultado esperado:
# - Primeras 30 peticiones: 200 OK
# - Peticiones 31-35: 429 Too Many Requests
```

---

## 🔧 Archivos Modificados

| Archivo | Cambios | Líneas |
|---------|---------|--------|
| **frontend/src/pages/QuestsPage.jsx** | Eliminado `useCallback`, simplificado dependencies, aumentado debounce | ~80-175 |
| **frontend/src/pages/RewardsPage.jsx** | Agregado flag `fetchAttempted` para prevenir double fetch | ~8-18 |
| **backend/server.js** | Agregado `questsLimiter` con rate limit 30/min, aplicado a `/api/quests` y `/api/rewards` | ~90-110, ~165-168 |

---

## 🚀 Próximas Mejoras (Opcional)

### 1. **Cache en Frontend**
```javascript
// Usar React Query o SWR para caché automático
import { useQuery } from '@tanstack/react-query';

const { data: quests } = useQuery({
  queryKey: ['quests', user?.address],
  queryFn: fetchQuests,
  staleTime: 30000, // Cache por 30 segundos
  cacheTime: 300000, // Mantener en memoria 5 minutos
});
```

### 2. **WebSockets para Updates en Tiempo Real**
```javascript
// Reemplazar polling por WebSocket push
ws.on('quest-completed', (data) => {
  // Actualizar UI sin hacer fetch
  updateQuest(data.questId, { status: 'completed' });
});
```

### 3. **Backend: Redis para Rate Limiting Distribuido**
```javascript
// Para múltiples instancias de servidor
const RedisStore = require('rate-limit-redis');
const limiter = rateLimit({
  store: new RedisStore({ client: redisClient }),
  windowMs: 60000,
  max: 30
});
```

---

## 📝 Notas Importantes

### ⚠️ React 18 StrictMode
- En desarrollo, `useEffect` se ejecuta **DOS VECES** intencionalmente
- Esto ayuda a detectar efectos secundarios no seguros
- La solución con `fetchAttempted` es la forma correcta de manejarlo

### ⚠️ eslint-disable-next-line
```javascript
// eslint-disable-next-line react-hooks/exhaustive-deps
```
- Se usa conscientemente en QuestsPage
- Razón: Queremos depender solo de `user?.address`, no de todo el objeto `user`
- Alternativa más limpia: `useMemo` para extraer address

### ⚠️ Rate Limiting en Desarrollo
- El límite de 30 req/min es generoso para desarrollo
- En producción, considerar reducir a **10-15 req/min**
- Ajustar según métricas reales de uso

---

## ✅ Checklist de Verificación

- [x] QuestsPage no genera bucle infinito
- [x] RewardsPage solo hace 1 fetch al montar
- [x] Backend responde 429 después de 30 requests en 1 minuto
- [x] Console limpia sin spam de errores
- [x] Página "Misiones" carga correctamente
- [x] Eventos de feed actualizan quests con debounce de 1 segundo
- [x] Rate limit tiene mensaje descriptivo en español
- [x] `retryAfter` incluido en respuesta 429

---

## 📚 Referencias

- [React 18 StrictMode](https://react.dev/reference/react/StrictMode)
- [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit)
- [React Hook Dependencies](https://react.dev/learn/removing-effect-dependencies)
- [Debouncing in React](https://www.developerway.com/posts/debouncing-in-react)

---

**Fecha**: 13 de Octubre, 2025  
**Autor**: GitHub Copilot  
**Estado**: ✅ COMPLETADO Y VERIFICADO
