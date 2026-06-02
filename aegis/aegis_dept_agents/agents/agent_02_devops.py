"""
BeZhas Aegis — Agente Departamental: DevOps & Infraestructura
Monitoriza Docker, uptime, Grafana, red, nodos tricontinentales.
"""

import asyncio
from typing import Any, Dict, List
from .core.base_dept_agent import BaseDeptAgent, AlertLevel


class DevOpsAgent(BaseDeptAgent):

    CYCLE_INTERVAL_SECONDS = 30

    def __init__(self):
        super().__init__(
            agent_id="dept_devops_002",
            dept_name="DevOps & Infraestructura",
            dept_lead="Head of DevOps"
        )
        self._kpis = {
            "docker_services_up": 0,
            "docker_services_total": 10,
            "uptime_pct": 100.0,
            "avg_api_latency_ms": 0.0,
            "error_rate_pct": 0.0,
            "disk_used_pct": 0.0,
            "ram_used_pct": 0.0,
            "cpu_used_pct": 0.0,
            "nginx_requests_per_min": 0,
            "waf_blocked_last_hour": 0
        }

    def get_tools(self) -> List[str]:
        return ["mcp:system-health", "mcp:monitor-edge-node"]

    def get_kpis(self) -> Dict[str, Any]:
        return self._kpis.copy()

    async def execute(self):
        await asyncio.gather(
            self._check_docker_services(),
            self._check_system_resources(),
            self._check_api_health(),
        )

    async def _check_docker_services(self):
        result = await self.call_mcp_tool("system-health", {"service": "docker"})
        if result:
            up = result.get("services_up", 0)
            total = result.get("services_total", 10)
            self._kpis["docker_services_up"] = up
            self._kpis["docker_services_total"] = total
            if up < total:
                down = total - up
                await self.emit_alert(
                    AlertLevel.CRITICAL,
                    f"{down} Docker service(s) DOWN out of {total}",
                    {"down_services": result.get("down_services", [])}
                )

    async def _check_system_resources(self):
        result = await self.call_api("GET", "/analytics/system")
        if result:
            self._kpis["disk_used_pct"] = result.get("disk_pct", 0)
            self._kpis["ram_used_pct"] = result.get("ram_pct", 0)
            self._kpis["cpu_used_pct"] = result.get("cpu_pct", 0)
            if result.get("disk_pct", 0) > 85:
                await self.emit_alert(
                    AlertLevel.WARNING,
                    f"Disk usage critical: {result['disk_pct']:.1f}% — blockchain data may fill drive",
                    result
                )

    async def _check_api_health(self):
        result = await self.call_api("GET", "/analytics/api-health")
        if result:
            latency = result.get("avg_latency_ms", 0)
            error_rate = result.get("error_rate_pct", 0)
            self._kpis["avg_api_latency_ms"] = latency
            self._kpis["error_rate_pct"] = error_rate
            if error_rate > 5.0:
                await self.emit_alert(
                    AlertLevel.WARNING,
                    f"API error rate high: {error_rate:.1f}%",
                    {"latency_ms": latency, "error_rate": error_rate}
                )
