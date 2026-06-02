# Aegis Control API - Dashboard Backend

API de control para el dashboard de administración del servicio de IA Aegis que monitorea la plataforma BeZhas Web3.

## 🚀 Características

- **Control de Autonomía**: Cambia entre modo autónomo y modo de sugerencias
- **Gestión de Acciones**: Aprueba/rechaza sugerencias de la IA
- **Configuración del Modelo**: Ajusta umbrales de detección y marca falsos positivos
- **Re-entrenamiento**: Inicia trabajos de re-entrenamiento del modelo
- **Telemetría**: Controla la recopilación de datos del frontend
- **Monitoreo**: Consulta el estado del sistema en tiempo real

## 📋 Endpoints Implementados

### Sección de Control

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `PUT` | `/api/aegis/control/set_mode` | Cambia el modo de operación (autonomous/suggest) |
| `POST` | `/api/aegis/control/pause` | Pausa de emergencia del sistema |
| `POST` | `/api/aegis/control/resume` | Resume las operaciones después de una pausa |
| `POST` | `/api/aegis/control/trigger_action` | Ejecuta una acción manual de mantenimiento |
| `POST` | `/api/aegis/control/approve_action/{suggestion_id}` | Aprueba una sugerencia de la IA |
| `POST` | `/api/aegis/control/reject_action/{suggestion_id}` | Rechaza una sugerencia de la IA |

### Sección de Configuración

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `PUT` | `/api/aegis/config/anomaly_threshold` | Ajusta el umbral de detección de anomalías |
| `POST` | `/api/aegis/model/mark_false_positive` | Marca un log como falso positivo |
| `POST` | `/api/aegis/model/retrain` | Inicia un trabajo de re-entrenamiento |
| `GET` | `/api/aegis/model/retrain/status/{job_id}` | Consulta el estado de un re-entrenamiento |

### Sección de Telemetría

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `PUT` | `/api/aegis/config/telemetry` | Habilita/deshabilita la telemetría |
| `PUT` | `/api/aegis/config/telemetry_samplerate` | Ajusta la tasa de muestreo |

### Sección de Monitoreo

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/aegis/status` | Obtiene el estado general del sistema |
| `GET` | `/api/aegis/suggestions/pending` | Lista de sugerencias pendientes |

## 🛠️ Instalación

### 1. Instalar dependencias

```bash
cd aegis
pip install -r requirements-control.txt
```

### 2. Ejecutar el servidor

```bash
# Modo desarrollo (con auto-reload)
python main.py

# O usando uvicorn directamente
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Acceder a la documentación

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 📝 Ejemplos de Uso

### Cambiar el modo de operación

```bash
curl -X PUT http://localhost:8000/api/aegis/control/set_mode \
  -H "Content-Type: application/json" \
  -d '{"mode": "autonomous"}'
```

Respuesta:
```json
{
  "status": "success",
  "message": "Modo cambiado a 'autonomous' exitosamente",
  "data": {
    "mode": "autonomous",
    "changed_at": "2025-11-02T10:30:00.000Z"
  },
  "timestamp": "2025-11-02T10:30:00.000Z"
}
```

### Ajustar umbral de detección de anomalías

```bash
curl -X PUT http://localhost:8000/api/aegis/config/anomaly_threshold \
  -H "Content-Type: application/json" \
  -d '{"level": 0.7}'
```

### Aprobar una sugerencia

```bash
curl -X POST http://localhost:8000/api/aegis/control/approve_action/sug_12345 \
  -H "Content-Type: application/json" \
  -d '{"feedback": "Acción correcta, proceder"}'
```

### Marcar un falso positivo

```bash
curl -X POST http://localhost:8000/api/aegis/model/mark_false_positive \
  -H "Content-Type: application/json" \
  -d '{
    "log_id": "log_12345",
    "reason": "Usuario legítimo con comportamiento inusual pero válido"
  }'
```

### Iniciar re-entrenamiento

```bash
curl -X POST "http://localhost:8000/api/aegis/model/retrain?include_false_positives=true&include_approved_actions=true"
```

### Obtener estado del sistema

```bash
curl http://localhost:8000/api/aegis/status
```

## 🏗️ Estructura del Proyecto

```
aegis/
├── main.py                      # Aplicación FastAPI principal
├── routers/
│   ├── __init__.py
│   └── control.py              # Router de control (este archivo)
├── models/                     # Modelos de ML (existentes)
├── core/                       # Lógica de negocio (existente)
├── utils/                      # Utilidades (existente)
└── requirements-control.txt    # Dependencias del API de control
```

## 🔧 Configuración

El sistema usa variables de entorno para configuración. Crea un archivo `.env`:

```env
# Server
HOST=0.0.0.0
PORT=8000
DEBUG=True

# Database (agregar cuando se implemente)
DATABASE_URL=postgresql://user:password@localhost:5432/aegis

# Redis (agregar cuando se implemente)
REDIS_URL=redis://localhost:6379/0

# Logging
LOG_LEVEL=INFO
```

## 📊 Modelos de Datos (Pydantic)

### SetModeRequest
```python
{
  "mode": "autonomous" | "suggest"
}
```

### TriggerActionRequest
```python
{
  "action": "purge_cache" | "reindex_feeds" | "restart_web3_listeners"
}
```

### ThresholdRequest
```python
{
  "level": 0.7  # Float entre 0.0 y 1.0
}
```

### FalsePositiveRequest
```python
{
  "log_id": "log_12345",
  "reason": "Razón opcional"
}
```

### TelemetryConfigRequest
```python
{
  "enabled": true
}
```

### SamplerateRequest
```python
{
  "rate": 0.1  # Float entre 0.0 y 1.0
}
```

### StandardResponse (todas las respuestas)
```python
{
  "status": "success" | "error",
  "message": "Mensaje descriptivo",
  "data": {
    // Datos específicos de la operación
  },
  "timestamp": "2025-11-02T10:30:00.000Z"
}
```

## 🔐 Seguridad

**TODO**: Implementar autenticación y autorización

```python
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Depends

security = HTTPBearer()

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    # Verificar JWT token
    pass

# Agregar a los endpoints:
@router.put("/control/set_mode", dependencies=[Depends(verify_token)])
```

## 📈 Próximos Pasos (TODOs)

### Base de Datos
- [ ] Implementar conexión a PostgreSQL/MongoDB
- [ ] Crear esquemas de tablas para logs, sugerencias, configuración
- [ ] Implementar persistencia de estados del sistema

### Integración con Node.js Backend
- [ ] Implementar cliente HTTP para llamar al backend de Node.js
- [ ] Sincronizar estados entre Aegis y el backend principal
- [ ] Implementar webhooks para notificaciones

### Workers y Jobs
- [ ] Implementar cola de trabajos (Celery/RQ)
- [ ] Crear worker para re-entrenamiento de modelos
- [ ] Implementar jobs programados para mantenimiento

### Autenticación
- [ ] Implementar autenticación JWT
- [ ] Agregar middleware de autorización
- [ ] Implementar roles (admin, viewer, operator)

### Monitoreo
- [ ] Implementar logging estructurado
- [ ] Agregar métricas de Prometheus
- [ ] Implementar health checks detallados

### Testing
- [ ] Crear tests unitarios para cada endpoint
- [ ] Implementar tests de integración
- [ ] Agregar tests de carga

## 🤝 Integración con Frontend

El dashboard de administrador (React/Vue) debe llamar a estos endpoints para:

1. **Controlar el modo de operación**: Switch entre autónomo y manual
2. **Revisar sugerencias pendientes**: Listar y aprobar/rechazar acciones
3. **Configurar sensibilidad**: Ajustar umbrales de detección
4. **Ver estado del sistema**: Monitorear salud y métricas
5. **Gestionar re-entrenamiento**: Iniciar y monitorear trabajos de ML

Ejemplo de integración en React:

```typescript
// services/aegisApi.ts
const API_URL = 'http://localhost:8000/api/aegis';

export const aegisApi = {
  async setMode(mode: 'autonomous' | 'suggest') {
    const response = await fetch(`${API_URL}/control/set_mode`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    });
    return response.json();
  },

  async getStatus() {
    const response = await fetch(`${API_URL}/status`);
    return response.json();
  },

  async approveSuggestion(suggestionId: string, feedback?: string) {
    const response = await fetch(
      `${API_URL}/control/approve_action/${suggestionId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback })
      }
    );
    return response.json();
  }
};
```

## 📞 Soporte

Para preguntas o issues, contactar al equipo de desarrollo de BeZhas.

## 📄 Licencia

Propiedad de BeZhas - Todos los derechos reservados
