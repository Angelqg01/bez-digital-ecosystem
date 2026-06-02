"""
BeZhas Aegis — OpenClaw Client para Agentes Departamentales
Conecta los 10 agentes con el sistema de habilidades OpenClaw (@bezhas/openclaw-unified v2.0.0).

OpenClaw permite a los agentes:
  - Descubrir automáticamente todos los servicios de la plataforma
  - Invocar skills de cualquier servicio sin conocer su URL directa
  - Registrar sus propias habilidades para que otros agentes las usen
  - Monitorizar el estado de todas las plataformas del ecosistema
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional
import httpx

logger = logging.getLogger(__name__)


class OpenClawClient:
    """
    Cliente ligero para el API OpenClaw de BeZhas.
    Cada agente instancia uno de estos en on_start().

    Endpoints OpenClaw (puerto :3001/api/openclaw):
        GET  /status    — Estado del servidor OpenClaw
        GET  /platforms — Plataformas descubiertas automáticamente
        GET  /skills    — Skills disponibles en toda la plataforma
        POST /invoke    — Invocar una skill por nombre
    """

    BASE_URL = "http://localhost:3001/api/openclaw"

    def __init__(self, agent_id: str, http_client: httpx.AsyncClient):
        self.agent_id = agent_id
        self._http = http_client
        self._skills_cache: Dict[str, Dict] = {}
        self._platforms_cache: List[Dict] = []
        self._cache_ttl = 300  # segundos
        self._last_cache_refresh: float = 0.0

    # ------------------------------------------------------------------ #
    #  Discovery                                                           #
    # ------------------------------------------------------------------ #

    async def status(self) -> Dict:
        """Verifica que OpenClaw esté disponible."""
        try:
            r = await self._http.get(f"{self.BASE_URL}/status", timeout=5.0)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            logger.warning(f"[OpenClaw][{self.agent_id}] status failed: {e}")
            return {"status": "unavailable", "error": str(e)}

    async def get_platforms(self, force_refresh: bool = False) -> List[Dict]:
        """
        Retorna la lista de plataformas descubiertas por PlatformDiscovery.
        Incluye: Control Center, Web3 App, DeFi, Edge Node, API Backend, Aegis, etc.
        """
        import time
        now = time.monotonic()
        if not force_refresh and self._platforms_cache and (now - self._last_cache_refresh) < self._cache_ttl:
            return self._platforms_cache
        try:
            r = await self._http.get(f"{self.BASE_URL}/platforms")
            r.raise_for_status()
            self._platforms_cache = r.json().get("platforms", [])
            self._last_cache_refresh = now
            return self._platforms_cache
        except Exception as e:
            logger.warning(f"[OpenClaw][{self.agent_id}] get_platforms failed: {e}")
            return self._platforms_cache  # retorna caché aunque sea stale

    async def get_skills(self, platform: Optional[str] = None) -> List[Dict]:
        """
        Retorna todas las skills disponibles, opcionalmente filtradas por plataforma.
        Ejemplo de skill: {"name": "analyze-gas", "platform": "ai-engine", "description": "..."}
        """
        try:
            params = {"platform": platform} if platform else {}
            r = await self._http.get(f"{self.BASE_URL}/skills", params=params)
            r.raise_for_status()
            skills = r.json().get("skills", [])
            self._skills_cache = {s["name"]: s for s in skills}
            return skills
        except Exception as e:
            logger.warning(f"[OpenClaw][{self.agent_id}] get_skills failed: {e}")
            return list(self._skills_cache.values())

    async def skill_exists(self, skill_name: str) -> bool:
        """Verifica si una skill está disponible."""
        if skill_name in self._skills_cache:
            return True
        await self.get_skills()
        return skill_name in self._skills_cache

    # ------------------------------------------------------------------ #
    #  Invocation                                                          #
    # ------------------------------------------------------------------ #

    async def invoke(
        self,
        skill: str,
        params: Dict[str, Any],
        timeout: float = 30.0
    ) -> Dict[str, Any]:
        """
        Invoca una skill por nombre.
        OpenClaw resuelve automáticamente qué plataforma la sirve.

        Args:
            skill:   Nombre de la skill (e.g. "analyze-gas", "predict-demand")
            params:  Parámetros específicos de la skill
            timeout: Segundos máximos de espera

        Returns:
            Respuesta de la skill, o {"error": "..."} si falla
        """
        payload = {
            "skill": skill,
            "params": params,
            "caller_agent": self.agent_id,
        }
        try:
            r = await self._http.post(
                f"{self.BASE_URL}/invoke",
                json=payload,
                timeout=timeout
            )
            r.raise_for_status()
            result = r.json()
            logger.debug(f"[OpenClaw][{self.agent_id}] invoke '{skill}' → ok")
            return result
        except httpx.TimeoutException:
            logger.warning(f"[OpenClaw][{self.agent_id}] invoke '{skill}' timed out after {timeout}s")
            return {"error": "timeout", "skill": skill}
        except httpx.HTTPStatusError as e:
            logger.warning(f"[OpenClaw][{self.agent_id}] invoke '{skill}' HTTP {e.response.status_code}")
            return {"error": f"http_{e.response.status_code}", "skill": skill}
        except Exception as e:
            logger.warning(f"[OpenClaw][{self.agent_id}] invoke '{skill}' failed: {e}")
            return {"error": str(e), "skill": skill}

    async def invoke_many(
        self,
        calls: List[Dict[str, Any]],
        max_concurrency: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Invoca múltiples skills en paralelo con límite de concurrencia.

        Args:
            calls: Lista de {"skill": "...", "params": {...}}
            max_concurrency: Máximo de invocaciones simultáneas

        Returns:
            Lista de resultados en el mismo orden que calls
        """
        sem = asyncio.Semaphore(max_concurrency)

        async def _invoke_one(call: Dict) -> Dict:
            async with sem:
                return await self.invoke(call["skill"], call.get("params", {}))

        return await asyncio.gather(*[_invoke_one(c) for c in calls])

    # ------------------------------------------------------------------ #
    #  Platform health check                                              #
    # ------------------------------------------------------------------ #

    async def get_healthy_platforms(self) -> Dict[str, bool]:
        """
        Retorna un dict {platform_name: is_healthy} para todas las plataformas.
        Útil para el agente DevOps y el agente de Engineering.
        """
        platforms = await self.get_platforms()
        results = {}
        for platform in platforms:
            name = platform.get("name", "unknown")
            health_url = platform.get("health_url")
            if health_url:
                try:
                    r = await self._http.get(health_url, timeout=5.0)
                    results[name] = r.status_code < 400
                except Exception:
                    results[name] = False
            else:
                results[name] = platform.get("status") == "active"
        return results

    async def get_platform_skills_count(self) -> Dict[str, int]:
        """Cuenta skills disponibles por plataforma."""
        skills = await self.get_skills()
        counts: Dict[str, int] = {}
        for skill in skills:
            platform = skill.get("platform", "unknown")
            counts[platform] = counts.get(platform, 0) + 1
        return counts


# ======================================================================
# Skill constants — nombres de skills usadas por los agentes
# ======================================================================

class OpenClawSkills:
    """Constantes para los nombres de skills de OpenClaw/MCP."""

    # AI-Engine MCP
    ANALYZE_GAS = "analyze-gas"
    VERIFY_COMPLIANCE = "verify-compliance"
    ANALYZE_SENTIMENT = "analyze-sentiment"
    SYSTEM_HEALTH = "system-health"
    AUDIT_CONTRACT = "audit-contract"
    PREDICT_DEMAND = "predict-demand"
    SCORE_SUPPLIER = "score-supplier"
    CALCULATE_SMART_SWAP = "calculate-smart-swap"
    MONITOR_EDGE_NODE = "monitor-edge-node"
    ASSESS_FRAUD_RISK = "assess-fraud-risk"
    OPTIMIZE_ROUTE = "optimize-route"
    ANALYZE_MARKET = "analyze-market"

    # Agent Runtime plugins
    LOGISTICS_TRACK = "logistics:track-shipment"
    LOGISTICS_QUALITY = "logistics:verify-quality"
    DEFI_POOL_STATUS = "defi:pool-status"
    DEFI_FARMING_STATUS = "defi:farming-status"
    GOVERNANCE_PROPOSALS = "governance:active-proposals"
    GOVERNANCE_VOTE_STATUS = "governance:vote-status"

    # Sector queries (Sprint 4)
    SECTOR_QUERY = "sector-query"
    INCIDENT_REPORT = "incident-report"

    # Deploy
    DEPLOY_CHECK = "deploy-check"
