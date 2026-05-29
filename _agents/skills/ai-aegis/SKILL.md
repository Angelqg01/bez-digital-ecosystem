---
name: AI/AEGIS Configuration
description: Configuration and management of the AEGIS AI monitoring system and OpenCLaw agent
---

# AI/AEGIS SKILL

## Componentes IA de BeZhas

### AEGIS (Monitoring + Validation)
- **Ubicación**: `aegis/` (Python/FastAPI)
- **Puerto**: 8000 (dev), aegis.bez.digital (prod)
- **Función**: Monitoreo de anomalías, validación de transacciones, ML re-training

### OpenCLaw Agent (Customer-Facing)
- **Ubicación**: `backend/services/payment-openclaw-bridge.js`
- **Rutas**: `backend/routes/openclaw.routes.js` → `/api/openclaw/*`
- **Función**: Provisionar credenciales, chat IA, gestión de plataformas

### AI Services Backend
| Servicio | Archivo | Función |
|---|---|---|
| Unified AI | `unified-ai.service.js` (21KB) | Multi-provider gateway |
| AI Provider | `ai-provider.service.js` (14KB) | Provider selection |
| AI Gateway | `aiGateway.service.js` (13.9KB) | Rate limiting + routing |
| RAG | `rag.service.js` (15KB) | Retrieval Augmented Generation |
| ML Service | `ml.service.js` (7.8KB) | Machine learning models |

## AEGIS API Endpoints
```
Base URL: http://localhost:8000/api/aegis

Control:
  PUT    /control/set_mode                ← autonomous | suggest
  POST   /control/pause                   ← Emergency stop
  POST   /control/resume                  ← Resume operations
  POST   /control/trigger_action          ← Manual action
  POST   /control/approve_action/:id      ← Approve AI suggestion
  POST   /control/reject_action/:id       ← Reject suggestion

Config:
  PUT    /config/anomaly_threshold        ← 0.0-1.0
  POST   /model/mark_false_positive       ← Mark false positive
  POST   /model/retrain                   ← Re-train model

Telemetry:
  PUT    /config/telemetry                ← On/Off
  PUT    /config/telemetry_samplerate     ← Sample rate

Monitoring:
  GET    /status                          ← General status
  GET    /suggestions/pending             ← Pending suggestions
```

## OpenCLaw API Endpoints
```
Base URL: /api/openclaw

POST   /provision         ← Provision client credentials
POST   /revoke            ← Revoke client access
POST   /rotate            ← Rotate credentials
GET    /client/:address   ← Get client credentials
POST   /chat              ← Chat with AI agent
GET    /platforms          ← Available platforms
POST   /connect           ← Connect third-party platform
DELETE /disconnect/:id    ← Disconnect platform
GET    /stats             ← Statistics
GET    /health            ← Health check
```

## LLM Integration
OpenCLaw intenta usar en este orden:
1. `unified-ai.service.js` (multi-provider)
2. `ai-provider.service.js` (single provider)
3. Fallback pre-programado (sin LLM)

## Patrones de Anomalías Conocidos
- Rate > 10 requests/second desde misma IP → posible DDoS
- Amount > 50,000 BEZ en una transacción → review requerido
- > 10 provisiones en 1 hora → posible abuso

## Persistence & Configuration
OpenCLaw utiliza una arquitectura de persistencia completa:
- **Modelo de Datos**: `OpenClawClient.model.js` (MongoDB) reemplaza el almacenamiento en memoria.
- **Configuración Dinámica**: Límites, planes (starter, pro, etc.) y TTL de credenciales se gestionan desde `GlobalSettings.model.js`.
- **Sincronización**: Los cambios en el panel de administración se reflejan instantáneamente en los nuevos provisionamientos.

## Configuración en .env
```env
# AI & OpenClaw Configuration
OPENCLAW_API_KEY=bzh_3p_openclaw_agent_dev_key_2026
OPENCLAW_URL=http://localhost:3001/api/openclaw
AEGIS_API_KEY=bzh_3p_aegis_bridge_dev_key_2026
AEGIS_URL=http://localhost:8000/api/aegis
```
