"""
BeZhas Aegis — Parche exacto para aegis/main.py
Añadir estas líneas al archivo existente en bezhas-blockchain/aegis/main.py

INSTRUCCIONES:
  1. Abrir: D:\Documentos D\Documentos Yoe\BeZhas\BeZhas Blockchain\aegis\main.py
  2. Aplicar los cambios marcados con ▶ AÑADIR
  3. Los bloques con ═══ son contexto del archivo existente (NO tocar)

─────────────────────────────────────────────────────────────────────
SECCIÓN 1 — Imports (al final de los imports existentes)
─────────────────────────────────────────────────────────────────────

▶ AÑADIR después del último import de aegis/main.py:

    # --- Dept Agents ---
    from dept_agents import DeptAgentManager, dept_agents_router
    from dept_agents.core.sse_stream import sse_router as dept_agents_sse_router
    from dept_agents.core.config import config as dept_agents_config

─────────────────────────────────────────────────────────────────────
SECCIÓN 2 — Router registration (en la sección app.include_router)
─────────────────────────────────────────────────────────────────────

▶ AÑADIR junto a los otros include_router:

    app.include_router(dept_agents_router)
    app.include_router(dept_agents_sse_router)

─────────────────────────────────────────────────────────────────────
SECCIÓN 3 — Startup event
─────────────────────────────────────────────────────────────────────

▶ AÑADIR dentro del @app.on_event("startup") existente:

    @app.on_event("startup")
    async def startup_event():
        # ... tu código existente (modelos ML, DB, etc.) ...

        # ▶ AÑADIR al final del startup:
        app.state.dept_manager = DeptAgentManager(dept_agents_config)
        await app.state.dept_manager.start_all()

─────────────────────────────────────────────────────────────────────
SECCIÓN 4 — Shutdown event
─────────────────────────────────────────────────────────────────────

▶ AÑADIR dentro del @app.on_event("shutdown") existente:

    @app.on_event("shutdown")
    async def shutdown_event():
        # ... tu código existente ...

        # ▶ AÑADIR al final del shutdown:
        if hasattr(app.state, "dept_manager"):
            await app.state.dept_manager.stop_all()

─────────────────────────────────────────────────────────────────────
SECCIÓN 5 — Opcional: endpoint de métricas Prometheus
─────────────────────────────────────────────────────────────────────

▶ AÑADIR si quieres exponer las métricas de dept_agents en /metrics:

    from dept_agents.core.metrics import metrics as dept_metrics
    from fastapi.responses import Response

    @app.get("/dept-agents/metrics")
    async def dept_agent_metrics():
        return Response(
            content=dept_metrics.export(),
            media_type=dept_metrics.content_type
        )

─────────────────────────────────────────────────────────────────────
VERIFICACIÓN — Endpoints disponibles tras el parche:
─────────────────────────────────────────────────────────────────────

  http://localhost:8001/dept-agents               GET  — lista los 10 agentes
  http://localhost:8001/dept-agents/alerts        GET  — alertas activas
  http://localhost:8001/dept-agents/config        GET  — configuración actual
  http://localhost:8001/dept-agents/history       GET  — historial KPIs
  http://localhost:8001/dept-agents/workflows     GET  — workflows ejecutados
  http://localhost:8001/dept-agents/stream        GET  — SSE todos los eventos
  http://localhost:8001/dept-agents/stream/alerts GET  — SSE solo alertas
  http://localhost:8001/dept-agents/{id}          GET  — agente específico
  http://localhost:8001/dept-agents/{id}/run      POST — forzar ciclo
  http://localhost:8001/dept-agents/{id}/pause    POST — pausar agente
  http://localhost:8001/dept-agents/{id}/resume   POST — reanudar agente
  http://localhost:8001/dept-agents/workflows/onboard   POST — onboarding cliente
  http://localhost:8001/dept-agents/workflows/incident  POST — respuesta incidente
  http://localhost:8001/dept-agents/workflows/emission  POST — alerta emisión
  http://localhost:8001/dept-agents/report/daily  POST — reporte diario ahora
  http://localhost:8001/dept-agents/report/snapshot POST — snapshot KPIs ahora

─────────────────────────────────────────────────────────────────────
VARIABLES .env a añadir en aegis/.env:
─────────────────────────────────────────────────────────────────────

  DEPT_AGENTS_ENABLED=true
  DEPT_AGENTS_LOG_LEVEL=INFO
  DEPT_AGENTS_REDIS_URL=redis://redis:6379
  DEPT_AGENTS_AEGIS_URL=http://localhost:8001
  DEPT_AGENTS_API_URL=http://api:3001/api
  DEPT_AGENTS_RUNTIME_URL=http://agent-runtime:3002
  DEPT_AGENTS_SLACK_WEBHOOK=https://hooks.slack.com/services/...  # opcional
  # Intervalos de ciclo (segundos):
  DEPT_AGENTS_SECURITY_INTERVAL=45
  DEPT_AGENTS_ENG_INTERVAL=60
  DEPT_AGENTS_DEVOPS_INTERVAL=30
  DEPT_AGENTS_DEFI_INTERVAL=300
  DEPT_AGENTS_FINANCE_INTERVAL=1800
  DEPT_AGENTS_CS_INTERVAL=900
  DEPT_AGENTS_AI_INTERVAL=120
  DEPT_AGENTS_BD_INTERVAL=3600
  DEPT_AGENTS_MKTG_INTERVAL=7200
  DEPT_AGENTS_LEGAL_INTERVAL=86400

─────────────────────────────────────────────────────────────────────
DEPENDENCIAS pip a añadir en aegis/requirements.txt:
─────────────────────────────────────────────────────────────────────

  redis[asyncio]>=5.0.0
  httpx>=0.27.0
  prometheus-client>=0.20.0   # opcional pero recomendado
  pytest-asyncio>=0.23.0      # solo para tests
"""
