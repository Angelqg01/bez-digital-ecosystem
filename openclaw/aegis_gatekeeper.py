"""
Aegis Gatekeeper — Pre-flight filter que corre ANTES de OpenClaw.

Motivación: hoy Aegis detecta spam/fraude *después* de que OpenClaw ya gastó
tokens en la API cara. Invertir el flujo:

    Request → Aegis Gatekeeper →
      ✅ safe        → OpenClaw (ruteo dinámico)
      ⚠️ suspicious  → OpenClaw degradado (Ollama-only, sin cadena API)
      ❌ block       → rechazo inmediato, no cuesta tokens

El gatekeeper no llama a modelos — usa reglas rápidas + heurísticas +
diccionarios de patrones. Costo << 1ms por request.
"""

import re
from enum import Enum
from dataclasses import dataclass, field
from typing import List, Optional


class GateVerdict(Enum):
    """Veredicto del gatekeeper para un request entrante."""
    SAFE       = "safe"        # Pasar a OpenClaw con ruteo normal
    SUSPICIOUS = "suspicious"  # Pasar pero degradado a Ollama (no gastar API)
    BLOCK      = "block"       # Rechazar antes de tocar OpenClaw


@dataclass
class GateDecision:
    """Resultado detallado de una evaluación del gatekeeper."""
    verdict: GateVerdict
    reason: str = ""
    signals: List[str] = field(default_factory=list)
    risk_score: float = 0.0  # 0.0 = safe, 1.0 = block


class AegisGatekeeper:
    """
    Filtro pre-OpenClaw. Reglas duras + heurísticas de riesgo.

    No sustituye al monitor de Aegis (ese observa el comportamiento *ex-post*);
    este actúa *ex-ante* para no gastar tokens en tráfico obviamente malo.
    """

    # Patrones de bloqueo directo (regex insensibles a mayúsculas)
    BLOCK_PATTERNS = [
        r"(?:ignore|forget|disregard).{0,20}(?:previous|prior|above).{0,20}instructions",
        r"system\s*prompt\s*(?:leak|reveal|show|print)",
        r"(?:api[_ ]?key|private[_ ]?key|mnemonic|seed[_ ]?phrase)\s*[:=]",
        # Extracción masiva de datos sensibles
        r"dump\s+all\s+(?:users?|wallets?|balances?|contracts?)",
        r"drop\s+(?:table|database)",
        r"select\s+.*\s+from\s+.*\s+where\s+1\s*=\s*1",
    ]

    # Patrones sospechosos (no bloquean, degradan a modelo local)
    SUSPICIOUS_PATTERNS = [
        r"jailbreak|DAN mode|developer mode",
        r"pretend\s+to\s+be\s+(?:another|different)\s+ai",
        r"bypass\s+(?:safety|filter|guardrail)",
        r"how\s+to\s+(?:hack|exploit|crack)",
    ]

    # Longitudes anómalas
    MAX_INPUT_CHARS = 50_000  # >50K chars → sospechoso (posible spam/DoS)
    MIN_MEANINGFUL_CHARS = 3

    def __init__(self, block_patterns: Optional[List[str]] = None,
                 suspicious_patterns: Optional[List[str]] = None,
                 max_input_chars: int = 50_000):
        self.block_res = [re.compile(p, re.IGNORECASE) for p in (block_patterns or self.BLOCK_PATTERNS)]
        self.susp_res  = [re.compile(p, re.IGNORECASE) for p in (suspicious_patterns or self.SUSPICIOUS_PATTERNS)]
        self.max_input_chars = max_input_chars

        self.stats = {"safe": 0, "suspicious": 0, "block": 0, "total": 0}

    def evaluate(self, user_input: str, user_id: Optional[str] = None,
                 task_type: str = "") -> GateDecision:
        """
        Evalúa un request entrante y devuelve un veredicto.
        NO hace llamadas de red. NO llama a modelos. Puro pattern matching + heurísticas.
        """
        self.stats["total"] += 1
        signals: List[str] = []
        risk = 0.0

        if not isinstance(user_input, str):
            return self._decide(GateVerdict.BLOCK, "non_string_input", signals=["not_a_string"], risk=1.0)

        stripped = user_input.strip()

        # 1. Vacío o basura
        if len(stripped) < self.MIN_MEANINGFUL_CHARS:
            return self._decide(GateVerdict.BLOCK, "input_too_short", signals=["empty_input"], risk=1.0)

        # 2. Longitud anómala (posible DoS o spam)
        if len(user_input) > self.max_input_chars:
            signals.append(f"input_too_long:{len(user_input)}")
            risk += 0.5

        # 3. Patrones de bloqueo → BLOCK inmediato
        for rx in self.block_res:
            if rx.search(user_input):
                signals.append(f"block_pattern:{rx.pattern[:40]}")
                return self._decide(GateVerdict.BLOCK,
                                    f"matched_block_pattern",
                                    signals=signals, risk=1.0)

        # 4. Patrones sospechosos → SUSPICIOUS (degradar a Ollama)
        for rx in self.susp_res:
            if rx.search(user_input):
                signals.append(f"susp_pattern:{rx.pattern[:40]}")
                risk += 0.35

        # 5. Ratio de caracteres no-ASCII muy alto → sospechoso (obfuscación)
        non_ascii = sum(1 for c in user_input if ord(c) > 127)
        if len(user_input) > 20 and non_ascii / len(user_input) > 0.6:
            signals.append("high_non_ascii_ratio")
            risk += 0.2

        # 6. Repetición extrema (posible bombing)
        if len(user_input) > 100:
            unique_ratio = len(set(user_input)) / len(user_input)
            if unique_ratio < 0.05:
                signals.append("low_char_diversity")
                risk += 0.4

        # 7. Decisión final por risk_score
        if risk >= 0.7:
            return self._decide(GateVerdict.BLOCK, "risk_threshold_exceeded", signals=signals, risk=risk)
        if risk >= 0.3:
            return self._decide(GateVerdict.SUSPICIOUS, "risk_moderate", signals=signals, risk=risk)

        return self._decide(GateVerdict.SAFE, "clean", signals=signals, risk=risk)

    def _decide(self, verdict: GateVerdict, reason: str,
                signals: List[str], risk: float) -> GateDecision:
        self.stats[verdict.value] += 1
        return GateDecision(verdict=verdict, reason=reason,
                            signals=signals, risk_score=round(risk, 3))

    def summary(self) -> dict:
        """Estadísticas para exponer en /metrics."""
        total = max(self.stats["total"], 1)
        return {
            **self.stats,
            "block_rate": round(self.stats["block"] / total, 4),
            "suspicious_rate": round(self.stats["suspicious"] / total, 4),
        }
