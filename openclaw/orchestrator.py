"""
BeZhas Orchestrator — Wire together Gatekeeper + Router + Cache + Engine + Ollama.

Este es el punto de entrada único para el flujo de un request:

    request
      │
      ▼
    1. AegisGatekeeper.evaluate()   ← pattern-match rápido (~1ms)
      │
      ▼   safe/suspicious/block
    2. ResponseCache.get()           ← si cache_allowed
      │   hit → return
      ▼   miss
    3. TaskRouter.route()            ← elige modelo + fallback + tokens
      │
      ▼
    4. OllamaLifecycle.warm_if_needed()  ← si toca calentar el local
      │
      ▼
    5. BeZhasAgentManager.complete()     ← llamada real al LLM
      │
      ▼
    6. ResponseCache.put()               ← si cache_allowed y hubo respuesta
      │
      ▼
    response

Compatible con el resto del ecosistema (agent-runtime + aegis) porque
solo expone `complete_request()` como interfaz asíncrona.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional

from aegis_gatekeeper import AegisGatekeeper, GateVerdict
from response_cache import ResponseCache
from ollama_lifecycle import OllamaLifecycle
from router import TaskRouter, TaskMetadata, ModelHint

log = logging.getLogger("BeZhas.Orchestrator")


@dataclass
class OrchestratorResult:
    """Resultado unificado de una llamada al orquestador."""
    ok: bool
    content: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    cache_hit: bool = False
    gate_verdict: str = "safe"
    route: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
    signals: List[str] = field(default_factory=list)


class BeZhasOrchestrator:
    """
    Orquesta el flujo completo: gate → cache → route → engine.

    El `engine` es cualquier objeto con método async `complete(messages, ...)`.
    En producción se le pasa un `BeZhasAgentManager`; en tests, un fake.
    """

    def __init__(
        self,
        engine: Any,                      # BeZhasAgentManager o fake con .complete()
        gatekeeper: Optional[AegisGatekeeper] = None,
        router: Optional[TaskRouter] = None,
        cache: Optional[ResponseCache] = None,
        ollama: Optional[OllamaLifecycle] = None,
    ):
        self.engine = engine
        self.gatekeeper = gatekeeper or AegisGatekeeper()
        self.router = router or TaskRouter()
        self.cache = cache or ResponseCache()
        self.ollama = ollama or OllamaLifecycle()
        self._queue_length = 0
        self.stats = {"served": 0, "blocked": 0, "cached": 0, "engine_calls": 0}

    def report_queue(self, length: int) -> None:
        """Actualiza métrica de cola (para el warm-start proactivo)."""
        self._queue_length = length
        self.ollama.report_queue(length)

    async def complete_request(
        self,
        user_input: str,
        messages: List[Dict[str, str]],
        task_type: str = "question_answer",
        priority: int = 5,
        max_tokens: int = 2000,
        user_id: Optional[str] = None,
        cache_allowed: bool = True,
    ) -> OrchestratorResult:
        """
        Flujo completo end-to-end. NUNCA lanza excepción — todo se materializa
        como OrchestratorResult(ok=False, error=...).
        """
        # ── 1. Gate ─────────────────────────────────────────────────────
        gate = self.gatekeeper.evaluate(user_input, user_id=user_id, task_type=task_type)
        if gate.verdict == GateVerdict.BLOCK:
            self.stats["blocked"] += 1
            log.warning(f"🚫 Blocked: {gate.reason} signals={gate.signals}")
            return OrchestratorResult(
                ok=False, gate_verdict="block", error=f"blocked: {gate.reason}",
                signals=gate.signals,
            )

        # Si es suspicious, forzamos ruteo local (Ollama) y desactivamos cache
        if gate.verdict == GateVerdict.SUSPICIOUS:
            cache_allowed = False
            log.info(f"⚠️  Suspicious: forcing local model (Ollama), signals={gate.signals}")

        # ── 2. Cache lookup ─────────────────────────────────────────────
        if cache_allowed:
            cached = self.cache.get(task_type, messages)
            if cached is not None:
                self.stats["cached"] += 1
                self.stats["served"] += 1
                return OrchestratorResult(
                    ok=True, content=cached["content"],
                    provider="cache", model="cache", cache_hit=True,
                    gate_verdict=gate.verdict.value,
                    signals=gate.signals,
                )

        # ── 3. Router ───────────────────────────────────────────────────
        # Si el gate marcó suspicious, forzamos hint OLLAMA
        model_hint = ModelHint.OLLAMA if gate.verdict == GateVerdict.SUSPICIOUS else ModelHint.AUTO
        meta = TaskMetadata(
            task_type=task_type, priority=priority, max_tokens=max_tokens,
            cache_allowed=cache_allowed, model_hint=model_hint, user_id=user_id,
        )
        route = self.router.route(meta, queue_length=self._queue_length)

        # ── 4. Warm-start Ollama si toca ────────────────────────────────
        needs_local = route["primary_model"] == "ollama" or route.get("warm_start_ollama")
        if needs_local:
            warmed = self.ollama.warm_if_needed(explicit_request=(route["primary_model"] == "ollama"))
            if not warmed and route["primary_model"] == "ollama":
                log.warning("Ollama no pudo cargarse; usando fallback API")
                route["primary_model"] = route["fallback_chain"][0] if route["fallback_chain"] else "claude"

        if self.ollama.is_hot():
            self.ollama.touch()

        # ── 5. Engine ───────────────────────────────────────────────────
        try:
            self.stats["engine_calls"] += 1
            engine_response = await self.engine.complete(
                messages=messages,
                max_tokens=max_tokens,
                skill=None,
            )
        except Exception as e:
            log.error(f"❌ Engine error: {e}")
            return OrchestratorResult(
                ok=False, gate_verdict=gate.verdict.value,
                error=f"engine_error: {e}", route=route, signals=gate.signals,
            )

        # ── 6. Cache put ────────────────────────────────────────────────
        content = engine_response.get("content") if isinstance(engine_response, dict) else str(engine_response)
        if cache_allowed and content:
            self.cache.put(task_type, messages, content)

        self.stats["served"] += 1
        return OrchestratorResult(
            ok=True, content=content,
            provider=engine_response.get("provider") if isinstance(engine_response, dict) else None,
            model=engine_response.get("model") if isinstance(engine_response, dict) else None,
            cache_hit=False,
            gate_verdict=gate.verdict.value,
            route=route,
            signals=gate.signals,
        )

    def metrics(self) -> Dict[str, Any]:
        """Métricas agregadas para exponer en /metrics."""
        return {
            "orchestrator": self.stats,
            "gate": self.gatekeeper.summary(),
            "cache": self.cache.summary(),
            "ollama": self.ollama.summary(),
        }
