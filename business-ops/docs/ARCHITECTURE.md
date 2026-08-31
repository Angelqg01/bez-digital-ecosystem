# Arquitectura

OPERANT está organizado en capas. Las capas de **negocio** (agentes, memoria, guardrails)
se replican lógicamente por cada tenant; la **infraestructura** es compartida pero con
aislamiento estricto de datos.

```
   CANALES (web · WhatsApp · Telegram · email · API)
                      │
              ┌───────▼────────┐
              │ TenantManager  │  ← identifica empresa, aísla su espacio
              └───────┬────────┘
                      │  (un espacio por tenant)
              ┌───────▼────────┐
              │  Orchestrator  │  ← "Director General IA" (Nivel 1)
              │   + TaskQueue  │
              └───────┬────────┘
            ┌─────────┼─────────┐
       ┌────▼───┐ ┌───▼────┐ ┌──▼─────┐
       │ Sales  │ │Support │ │  ...   │  ← DepartmentManagers (Nivel 2)
       │  Mgr   │ │  Mgr   │ │        │
       └────┬───┘ └────────┘ └────────┘
            │
   ┌────────┼────────┬──────────┐
┌──▼──┐ ┌───▼──┐ ┌───▼───┐ ┌────▼────┐
│Hunt │ │Score │ │Outreach│ │Negotiate│  ← Especialistas (Nivel 3)
└──┬──┘ └──────┘ └───┬────┘ └─────────┘
   │                 │
   │         ┌───────▼────────┐
   └────────►│   Guardrails   │  ← PolicyEngine + RedLines + HITL + Audit
             └───────┬────────┘
                     │ (acción permitida)
             ┌───────▼────────┐
             │   Connectors   │  ← CRM · Email · Pago · Calendario...
             └────────────────┘

   Transversal: ModelGateway (modelos) · MemoryManager (memoria/RAG)
```

## Flujo de una solicitud

1. Un cliente final escribe por cualquier canal.
2. `TenantManager` enruta al espacio aislado de esa empresa.
3. El `Orchestrator` **clasifica la intención** (modelo barato) → departamento.
4. Encola la tarea en `TaskQueue` y registra en `AuditLog`.
5. El `DepartmentManager` correspondiente **descompone** la tarea y la reparte entre sus
   especialistas.
6. Cada especialista **razona** (`think()` con RAG de memoria) y, si necesita **actuar**
   (`act()`), la acción pasa por `PolicyEngine`:
   - permitida → se ejecuta vía connector;
   - línea roja → se pausa y se pide **aprobación humana** (HITL);
   - bloqueada → se rechaza.
7. El resultado se sintetiza, se guarda en memoria (aprendizaje) y se devuelve.

## Principios de diseño

- **Agentes pequeños y especializados** > un súper-agente. Más fiables, más baratos, más
  fáciles de depurar.
- **Una sola puerta a los modelos** (`ModelGateway`): cambiar de proveedor o versión no
  toca ningún agente.
- **Aislamiento por tenant desde el día 1**: imposible que un cliente vea datos de otro.
- **Autónomo por defecto, humano para lo irreversible.**
