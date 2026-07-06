"""
Ollama Lifecycle Manager — Warm-start selectivo del modelo local.

Motivación: LLaMA Q3_K_M ocupa ~24GB VRAM cargado. Mantenerlo siempre en
memoria bloquea la GPU para otras tareas (Aegis ML, vision, etc.).

Política:
  - Si hay >=warm_threshold requests en cola → cargar Ollama (warm)
  - Si Ollama lleva idle_seconds sin usarse → descargar (cold)
  - Si un request pide Ollama explícitamente pero está cold → cargar sync

Este módulo NO carga el modelo (delega en llama-cpp-python); solo decide
CUÁNDO cargarlo/descargarlo y mantiene el flag `_ollama_loaded` que
consultan router y engine.
"""

import time
import threading
from enum import Enum
from dataclasses import dataclass, field
from typing import Callable, Optional


class OllamaState(Enum):
    COLD = "cold"       # No cargado, requiere warm-up (~30-60s)
    WARMING = "warming" # En proceso de carga
    HOT = "hot"         # Cargado, listo para requests
    COOLING = "cooling" # En proceso de descarga


@dataclass
class OllamaLifecycle:
    """
    Gestor de ciclo de vida de Ollama. Thread-safe (usa Lock interno).

    Args:
        warm_threshold: nº mín de requests en cola para pre-calentar
        idle_seconds: tiempo sin uso tras el cual descargar
    """
    warm_threshold: int = 10
    idle_seconds: float = 300.0  # 5 minutos idle → descargar
    loader: Optional[Callable[[], None]] = None
    unloader: Optional[Callable[[], None]] = None

    state: OllamaState = field(default=OllamaState.COLD, init=False)
    _lock: threading.Lock = field(default_factory=threading.Lock, init=False)
    _last_used: float = field(default=0.0, init=False)
    _queue_length: int = field(default=0, init=False)
    _load_count: int = field(default=0, init=False)
    _unload_count: int = field(default=0, init=False)

    def report_queue(self, queue_length: int) -> None:
        """Notifica el tamaño actual de la cola de requests."""
        with self._lock:
            self._queue_length = queue_length

    def should_warm(self, explicit_request: bool = False) -> bool:
        """
        Decide si hay que cargar Ollama ahora.
          - explicit_request=True → sí (siempre, bajo demanda)
          - queue >= warm_threshold → sí (proactivo)
        """
        with self._lock:
            if self.state in (OllamaState.HOT, OllamaState.WARMING):
                return False
            if explicit_request:
                return True
            return self._queue_length >= self.warm_threshold

    def should_cool(self, now: Optional[float] = None) -> bool:
        """Devuelve True si Ollama lleva idle > idle_seconds y está HOT."""
        with self._lock:
            if self.state != OllamaState.HOT:
                return False
            if self._last_used == 0.0:
                return False
            elapsed = (now or time.time()) - self._last_used
            return elapsed >= self.idle_seconds

    def mark_warming(self) -> bool:
        """Marca inicio de carga. Devuelve False si ya estaba HOT/WARMING."""
        with self._lock:
            if self.state in (OllamaState.HOT, OllamaState.WARMING):
                return False
            self.state = OllamaState.WARMING
            return True

    def mark_hot(self) -> None:
        """Marca fin de carga (Ollama listo)."""
        with self._lock:
            self.state = OllamaState.HOT
            self._last_used = time.time()
            self._load_count += 1

    def mark_cold(self) -> None:
        """Marca descarga completada."""
        with self._lock:
            self.state = OllamaState.COLD
            self._last_used = 0.0
            self._unload_count += 1

    def touch(self) -> None:
        """Registrar uso (resetea el timer de idle)."""
        with self._lock:
            if self.state == OllamaState.HOT:
                self._last_used = time.time()

    def is_hot(self) -> bool:
        with self._lock:
            return self.state == OllamaState.HOT

    def warm_if_needed(self, explicit_request: bool = False) -> bool:
        """
        Si toca calentar, invoca el loader y marca HOT.
        Devuelve True si Ollama quedó/estaba HOT tras la llamada.
        """
        if self.is_hot():
            return True
        if not self.should_warm(explicit_request=explicit_request):
            return False
        if not self.mark_warming():
            return False
        try:
            if self.loader:
                self.loader()
            self.mark_hot()
            return True
        except Exception:
            with self._lock:
                self.state = OllamaState.COLD
            return False

    def cool_if_idle(self, now: Optional[float] = None) -> bool:
        """Descarga Ollama si lleva demasiado tiempo idle."""
        if not self.should_cool(now=now):
            return False
        with self._lock:
            self.state = OllamaState.COOLING
        try:
            if self.unloader:
                self.unloader()
            self.mark_cold()
            return True
        except Exception:
            with self._lock:
                self.state = OllamaState.HOT
            return False

    def summary(self) -> dict:
        with self._lock:
            return {
                "state": self.state.value,
                "queue_length": self._queue_length,
                "warm_threshold": self.warm_threshold,
                "idle_seconds": self.idle_seconds,
                "load_count": self._load_count,
                "unload_count": self._unload_count,
                "seconds_since_last_use": (
                    round(time.time() - self._last_used, 2)
                    if self._last_used > 0 else None
                ),
            }
