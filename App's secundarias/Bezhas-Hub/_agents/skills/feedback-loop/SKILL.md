---
name: Feedback Loop
description: System for continuously improving the BeZhas AI through error logging, solution tracking, and optimization recording
---

# Feedback Loop SKILL

## Propósito
Este sistema permite que la IA de BeZhas (OpenCLaw/AEGIS) aprenda de cada
interacción, error y optimización. Cada vez que se resuelve un problema,
se registra aquí para que la IA sea más autónoma en el futuro.

## Cómo Funciona

```
Error/Problema detectado
        │
        ▼
¿Existe en error-log.md?  ──── SÍ ──→  Aplicar solución documentada
        │                                        │
        NO                                       ▼
        │                                   Resultado OK? ──→ FIN
        ▼                                        │
  Investigar solución                            NO
        │                                        │
        ▼                                        ▼
  Aplicar solución                    Marcar como "necesita revisión"
        │                             Actualizar error-log.md
        ▼
  ¿Funcionó?
     │       │
    SÍ      NO
     │       │
     ▼       ▼
  Registrar  Escalar a humano
  en error-  Registrar intento
  log.md     fallido
```

## Archivos del Feedback Loop

### error-log.md
Registro de errores encontrados y sus soluciones.
Formato:
```markdown
### [FECHA] ERROR: <descripción corta>
- **Síntoma**: qué se observó
- **Causa**: por qué ocurrió
- **Solución**: qué se hizo para resolverlo
- **Estado**: ✅ Resuelto | ⚠️ Parcial | ❌ Sin resolver
- **Archivos afectados**: lista de archivos modificados
```

### optimization-log.md
Registro de optimizaciones aplicadas.
Formato:
```markdown
### [FECHA] OPT: <descripción corta>
- **Área**: payment | bridge | deployment | ai | ...
- **Antes**: estado anterior
- **Después**: estado optimizado
- **Impacto**: métrica de mejora
```

## Reglas para la IA
1. **SIEMPRE** buscar en error-log.md antes de investigar un problema
2. **SIEMPRE** registrar la solución después de resolver un problema
3. **NUNCA** repetir una investigación si la solución ya está documentada
4. Cada entrada ahorra tokens en futuras interacciones
5. Priorizar soluciones verificadas (estado ✅)
6. Si una solución parcial no funciona, buscar alternativas y actualizar

## Sistema de Autonomía IA (OpenCLaw/AEGIS)

Para reducir el consumo de tokens y aumentar la autonomía, la IA debe seguir estas reglas dinámicas:

1. **Auto-Documentación**: Después de cada solución exitosa, crear un micro-documento en `learning-vault/<fecha>-solucion.md` que resuma la lógica aplicada.
2. **Registro de Automatización**: Cada vez que se usa una herramienta de CLI (gcloud, npx, npm), se registra en `automation-trace/` para que la IA sepa qué comandos funcionan en qué entorno.
3. **Optimización del Contexto**: Al final de cada sesión, actualizar el `TRAINING_INDEX.md` si se han creado nuevos archivos de configuración o entrenamiento.
4. **Enseñanza Recíproca**: La IA BeZhas utiliza estas SKILLs para gestionar la plataforma sin necesidad de que el humano repita los parámetros de configuración.

## Ubicación de los Logs y Corpus
- `_agents/skills/feedback-loop/error-log.md`
- `_agents/skills/feedback-loop/optimization-log.md`
- `_agents/skills/feedback-loop/learning-vault/` (Lecciones de la IA)
- `_agents/skills/feedback-loop/automation-trace/` (Rastreo de autonomía)
