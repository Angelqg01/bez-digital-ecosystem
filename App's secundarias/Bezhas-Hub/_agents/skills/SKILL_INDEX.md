---
name: BeZhas SKILL System Index
description: Master index of all AI learning skills for BeZhas platform management
---

# 🧠 BeZhas SKILL System — Índice Maestro

Sistema de aprendizaje continuo para la IA de BeZhas (OpenCLaw/AEGIS).
Cada SKILL contiene instrucciones, configuraciones, soluciones y patrones que la IA puede reutilizar
para reducir tokens y ser más autónoma con cada interacción.

## Skills Disponibles

| # | Skill | Descripción | Ruta |
|---|---|---|---|
| 1 | Platform Management | Gestión general de la plataforma | [SKILL.md](platform-management/SKILL.md) |
| 2 | Payment System | BEZ-Pay (Native), Stripe, Bank Transfer | [SKILL.md](payment-system/SKILL.md) |
| 3 | Blockchain Contracts | Contratos, ABIs, deployment, gas | [SKILL.md](blockchain-contracts/SKILL.md) |
| 4 | Bridge Adapters | Conexión con plataformas terceras | [SKILL.md](bridge-adapters/SKILL.md) |
| 5 | AI/AEGIS | Configuración de AEGIS y OpenCLaw | [SKILL.md](ai-aegis/SKILL.md) |
| 6 | Deployment | GCP Cloud Run, Docker, rollback | [SKILL.md](deployment/SKILL.md) |
| 7 | Testing | 36 test files categorizados | [SKILL.md](testing/SKILL.md) |
| 8 | Feedback Loop | Error log + Optimization log | [SKILL.md](feedback-loop/SKILL.md) |
| 9 | Third Party Integration | Shopify, WooCommerce, Airbnb | [SKILL.md](third-party/SKILL.md) |

## 📚 Training Corpus (158+ documentos organizados)

| Recurso | Descripción | Ruta |
|---|---|---|
| Training Index | 158+ MDs en 9 categorías | [TRAINING_INDEX.md](training-corpus/TRAINING_INDEX.md) |
| Project Structure | Mapa completo del proyecto | [PROJECT_STRUCTURE.md](training-corpus/PROJECT_STRUCTURE.md) |
| Automation Map | 12 flujos automatizados | [AUTOMATION_MAP.md](training-corpus/AUTOMATION_MAP.md) |
| Manifest (JSON) | Índice máquina para la IA | [training-manifest.json](training-corpus/training-manifest.json) |

## 📋 Workflows (slash commands)

| Comando | Descripción | Ruta |
|---|---|---|
| `/deploy` | Deploy a GCP Cloud Run | [deploy.md](../workflows/deploy.md) |
| `/test-payment` | Testear pagos E2E | [test-payment.md](../workflows/test-payment.md) |
| `/add-adapter` | Crear nuevo bridge adapter | [add-adapter.md](../workflows/add-adapter.md) |
| `/troubleshoot` | Diagnóstico de problemas | [troubleshoot.md](../workflows/troubleshoot.md) |

## Cómo Funciona

```
Problema/Tarea detectada
        │
        ▼
 ┌──────────────┐
 │ Consultar     │ ← La IA busca en SKILL_INDEX primero
 │ SKILL_INDEX   │
 └──────┬───────┘
        │
        ▼
 ┌──────────────┐
 │ Leer SKILL.md│ ← Encuentra instrucciones específicas
 │ del área      │
 └──────┬───────┘
        │
        ▼
 ┌──────────────┐
 │ ¿Necesita más│ ← Si necesita más contexto
 │ contexto?    │
 └──────┬───────┘
        │ SÍ
        ▼
 ┌──────────────┐
 │ Consultar    │ ← Busca en 158+ docs categorizados
 │ TRAINING_    │
 │ INDEX.md     │
 └──────┬───────┘
        │
        ▼
 ┌──────────────┐
 │ Ejecutar      │ ← Aplica la solución documentada
 │ Acción        │
 └──────┬───────┘
        │
        ▼
 ┌──────────────┐
 │ Feedback Loop│ ← Registra resultado en error-log.md
 │ Actualizar   │    u optimization-log.md
 └──────────────┘
```

## Reglas del Sistema
1. **SIEMPRE** consultar SKILL antes de investigar desde cero
2. **Registrar** soluciones nuevas en la SKILL correspondiente
3. **Actualizar** `error-log.md` cuando se resuelve un problema
4. **Nunca** duplicar información entre SKILLs — usar links
5. **Consultar** `TRAINING_INDEX.md` cuando necesites documentación histórica
