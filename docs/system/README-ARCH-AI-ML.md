# BeZhas AI/ML Architecture

## Componentes

- **Frontend (Vite/React):**
  - Captura métricas (Core Web Vitals, errores JS, navegación, clicks) y las envía en batch a `/api/v1/telemetry`.
  - Hooks: `useTelemetry`, `usePageView`.

- **Backend (Node.js/Express):**
  - Recibe eventos de telemetría, los enruta a BullMQ (Redis) y los reenvía a Aegis (Python).
  - Workers para colas: telemetry, web3Events, anomalyDetection, autoHealing, contactSync.

- **Aegis (Python/FastAPI):**
  - Recibe eventos, ejecuta modelos ML (anomaly, UX, sentiment), toma decisiones y ejecuta auto-healing.
  - Conecta a MongoDB (persistencia) y Redis (cache/rate limit).

- **Redis:**
  - Backend de colas BullMQ y cache para Aegis.

- **MongoDB:**
  - Persistencia de eventos, logs, resultados ML.

- **TimescaleDB:**
  - Analítica avanzada de series temporales (opcional).

## Flujo de datos

1. **Frontend** → POST `/api/v1/telemetry` → **Backend**
2. **Backend** → BullMQ (Redis) → **Worker**
3. **Worker** → HTTP POST → **Aegis** (`/aegis/v1/ingest/telemetry`)
4. **Aegis** → ML/AI → Decisión/Auto-healing → DB/Redis

## Testing

- Probar envío de telemetría:

```sh
curl -X POST http://localhost:3001/api/v1/telemetry \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test-session-1","events":[{"eventType":"test","eventName":"manual-curl","timestamp":'$(date +%s)' }]}'
```

- Verificar logs de workers y Aegis:
  - Backend: `docker logs bezhas-backend`
  - Aegis: `docker logs bezhas-aegis`

- Validar procesamiento ML:
  - Consultar `/aegis/v1/health` y `/aegis/v1/stats`

- Confirmar auto-healing:
  - Simular eventos anómalos y revisar logs/acciones

## Orquestación

Levantar todo con:

```sh
docker compose up --build
```

## Seguridad
- Cambia las variables de entorno y contraseñas en `.env` y `.env.example`.

---

Documentación generada automáticamente por GitHub Copilot.
