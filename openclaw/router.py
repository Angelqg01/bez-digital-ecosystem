"""
OpenClaw Dynamic Task Router — Enrutamiento inteligente por tipo de tarea.

Decide qué modelo usar (Claude, GPT-4o, DeepSeek, Ollama) basado en:
  - Tipo de tarea (spam, análisis, cálculo, generación)
  - Costo/latencia requerido
  - Disponibilidad de Ollama
  - Cache hit en ChromaDB

Fallback chain: si el modelo preferido falla → siguiente.
"""

import hashlib
from enum import Enum
from dataclasses import dataclass
from typing import Optional, Dict, Any


class ModelHint(Enum):
    """Sugerencia de modelo preferido para la tarea."""
    CLAUDE = "claude"           # Mejor para: razonamiento complejo, seguridad
    GPT4O = "gpt-4o"            # Mejor para: cálculos, análisis profundo
    DEEPSEEK = "deepseek"       # Mejor para: matemáticas, código
    OLLAMA = "ollama"           # Mejor para: tareas baratas, local, sumarizaciones
    FAST = "fast"               # Mejor para: respuestas rápidas (cualquier modelo)
    AUTO = "auto"               # Sistema decide automáticamente


@dataclass
class TaskMetadata:
    """Metadata de la tarea para enrutamiento."""
    task_type: str              # "spam_check", "math_solve", "code_review", etc.
    priority: int = 5           # 1-10 (10 = urgente, usa GPT-4o/Claude)
    max_tokens: int = 2000      # Presupuesto de tokens
    cache_allowed: bool = True  # ¿Puedo usar respuesta cacheada?
    model_hint: ModelHint = ModelHint.AUTO
    user_id: Optional[str] = None


class TaskRouter:
    """Enrutador dinámico de tareas a modelos."""

    def __init__(self, ollama_warm_start_threshold: int = 10):
        """
        Args:
            ollama_warm_start_threshold: si hay >N requests en cola, carga Ollama.
        """
        self.ollama_warm_start_threshold = ollama_warm_start_threshold
        self._task_queue_length = 0
        self._ollama_loaded = False

        # Matriz de enrutamiento: (task_type, priority) → ModelHint
        self.routing_matrix = {
            # Seguridad/compliance: siempre Claude (highest trust)
            ("spam_check", 9): ModelHint.CLAUDE,
            ("fraud_detect", 9): ModelHint.CLAUDE,
            ("compliance_audit", 8): ModelHint.CLAUDE,
            ("security_review", 8): ModelHint.CLAUDE,

            # Matemáticas/cálculos: GPT-4o o DeepSeek
            ("math_solve", 8): ModelHint.GPT4O,
            ("financial_calc", 8): ModelHint.GPT4O,
            ("technical_analysis", 7): ModelHint.DEEPSEEK,
            ("probability", 7): ModelHint.DEEPSEEK,

            # Código: DeepSeek o GPT-4o
            ("code_review", 7): ModelHint.DEEPSEEK,
            ("code_generate", 6): ModelHint.DEEPSEEK,
            ("code_debug", 7): ModelHint.DEEPSEEK,

            # Escritura/creatividad: Claude
            ("content_write", 6): ModelHint.CLAUDE,
            ("summarize", 5): ModelHint.OLLAMA,  # Barato, local
            ("email_draft", 6): ModelHint.CLAUDE,

            # Tareas baratas/rápidas: Ollama (si está disponible)
            ("sentiment_analyze", 4): ModelHint.OLLAMA,
            ("classify_text", 4): ModelHint.OLLAMA,
            ("extract_entities", 5): ModelHint.OLLAMA,

            # Análisis general: auto (sistema decide)
            ("analysis", 6): ModelHint.AUTO,
            ("research", 7): ModelHint.CLAUDE,
            ("question_answer", 5): ModelHint.AUTO,
        }

    def route(self, metadata: TaskMetadata, queue_length: int = 0) -> Dict[str, Any]:
        """
        Enruta una tarea al modelo preferido.

        Returns:
            {
                "primary_model": "claude" | "gpt-4o" | "deepseek" | "ollama",
                "fallback_chain": ["gpt-4o", "deepseek", "ollama"],
                "prefer_cached": bool,
                "warm_start_ollama": bool,
                "budget_tokens": int,
            }
        """
        self._task_queue_length = queue_length

        # 1. Buscar en matriz de enrutamiento
        route_key = (metadata.task_type, metadata.priority)
        hint = self.routing_matrix.get(route_key)

        # 2. Si no hay entrada exacta, usar el hint del usuario o auto-detect
        if hint is None:
            hint = metadata.model_hint
        if hint == ModelHint.AUTO:
            hint = self._auto_detect(metadata)

        # 3. Usar cache si es permitido y está disponible
        prefer_cached = metadata.cache_allowed and self._should_use_cache(metadata)

        # 4. Decidir si cargar Ollama
        warm_start_ollama = (
            hint == ModelHint.OLLAMA or
            (queue_length > self.ollama_warm_start_threshold and not self._ollama_loaded)
        )

        # 5. Construir cadena de fallback
        fallback_chain = self._fallback_chain_for(hint)

        return {
            "primary_model": hint.value,
            "fallback_chain": fallback_chain,
            "prefer_cached": prefer_cached,
            "warm_start_ollama": warm_start_ollama,
            "budget_tokens": metadata.max_tokens,
            "task_type": metadata.task_type,
            "priority": metadata.priority,
        }

    def _auto_detect(self, metadata: TaskMetadata) -> ModelHint:
        """Detecta el mejor modelo basado en task_type."""
        task_type = metadata.task_type.lower()

        # Heurísticas simples
        if any(x in task_type for x in ["spam", "fraud", "security", "compliance"]):
            return ModelHint.CLAUDE
        if any(x in task_type for x in ["math", "calc", "analyze", "quantify"]):
            return ModelHint.GPT4O
        if any(x in task_type for x in ["code", "debug", "refactor"]):
            return ModelHint.DEEPSEEK
        if any(x in task_type for x in ["summary", "classify", "extract"]):
            return ModelHint.OLLAMA if self._task_queue_length < 5 else ModelHint.FAST
        if any(x in task_type for x in ["write", "draft", "compose"]):
            return ModelHint.CLAUDE

        # Default: Claude para lo desconocido (es el más versátil)
        return ModelHint.CLAUDE

    def _should_use_cache(self, metadata: TaskMetadata) -> bool:
        """Decide si usar ChromaDB cache (heurística)."""
        # No cachear si es task urgente (priority 8+)
        if metadata.priority >= 8:
            return False
        # Cachear tareas repetitivas (department automation)
        if metadata.task_type in ["summarize", "classify_text", "sentiment_analyze"]:
            return True
        # Cachear si tenemos user_id (personalizaciones reutilizables)
        if metadata.user_id:
            return True
        return False

    def _fallback_chain_for(self, hint: ModelHint) -> list:
        """Cadena de fallback según el modelo preferido."""
        chains = {
            ModelHint.CLAUDE: ["gpt-4o", "deepseek", "ollama"],
            ModelHint.GPT4O: ["deepseek", "claude", "ollama"],
            ModelHint.DEEPSEEK: ["gpt-4o", "claude", "ollama"],
            ModelHint.OLLAMA: ["deepseek", "gpt-4o", "claude"],
            ModelHint.FAST: ["ollama", "deepseek", "gpt-4o"],
            ModelHint.AUTO: ["claude", "gpt-4o", "deepseek", "ollama"],
        }
        return chains.get(hint, chains[ModelHint.AUTO])

    def update_ollama_status(self, loaded: bool):
        """Notificar si Ollama se cargó o descargó."""
        self._ollama_loaded = loaded


def cache_key_for_task(task_type: str, input_hash: str) -> str:
    """Genera una clave de cache para una tarea."""
    combined = f"{task_type}:{input_hash}"
    return hashlib.sha256(combined.encode()).hexdigest()[:16]
