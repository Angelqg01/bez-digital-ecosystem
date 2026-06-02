"""
BeZhas Aegis — Scheduler de Agentes Departamentales
Tareas programadas: reportes diarios, alertas periódicas, snapshots.

Tareas programadas:
  08:00 UTC — Reporte diario ejecutivo (todos los KPIs consolidados)
  */30 min  — Snapshot de KPIs a Redis para histórico
  */5 min   — Health check cruzado entre agentes críticos
  Lunes     — Reporte semanal de tendencias
  00:00 UTC — Rotación de logs y limpieza de alertas antiguas

No usa librerías externas de scheduling (APScheduler, Celery).
Usa asyncio puro para mantener la compatibilidad con Aegis.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .manager import DeptAgentManager

logger = logging.getLogger(__name__)


class AgentScheduler:
    """
    Scheduler async para tareas periódicas del sistema de agentes.
    Se integra en el DeptAgentManager y comparte su event loop.
    """

    def __init__(self, manager: "DeptAgentManager"):
        self.manager   = manager
        self._tasks:   List[asyncio.Task] = []
        self._running  = False
        self._history: List[Dict] = []   # histórico de snapshots

    # ------------------------------------------------------------------ #
    #  Lifecycle                                                          #
    # ------------------------------------------------------------------ #

    async def start(self):
        """Arranca todos los loops de tareas programadas."""
        self._running = True
        self._tasks = [
            asyncio.create_task(self._kpi_snapshot_loop(),       name="sched_kpi_snapshot"),
            asyncio.create_task(self._daily_report_loop(),       name="sched_daily_report"),
            asyncio.create_task(self._cross_health_check_loop(), name="sched_cross_health"),
            asyncio.create_task(self._weekly_report_loop(),      name="sched_weekly_report"),
            asyncio.create_task(self._midnight_cleanup_loop(),   name="sched_midnight_cleanup"),
        ]
        logger.info("[AgentScheduler] Started — 5 scheduled tasks running")

    async def stop(self):
        """Para todas las tareas programadas limpiamente."""
        self._running = False
        for task in self._tasks:
            task.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        logger.info("[AgentScheduler] Stopped")

    # ------------------------------------------------------------------ #
    #  Scheduled loops                                                    #
    # ------------------------------------------------------------------ #

    async def _kpi_snapshot_loop(self):
        """
        Cada 30 minutos: guarda snapshot de KPIs de todos los agentes en Redis.
        Permite trazar tendencias históricas en Grafana.
        """
        while self._running:
            try:
                await asyncio.sleep(1800)  # 30 min
                await self._take_kpi_snapshot()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[Scheduler] KPI snapshot error: {e}", exc_info=True)

    async def _daily_report_loop(self):
        """
        Cada día a las 08:00 UTC: genera y envía reporte ejecutivo.
        """
        while self._running:
            try:
                now      = datetime.now(timezone.utc)
                target   = now.replace(hour=8, minute=0, second=0, microsecond=0)
                if now >= target:
                    target += timedelta(days=1)
                wait_secs = (target - now).total_seconds()
                logger.debug(f"[Scheduler] Daily report in {wait_secs/3600:.1f}h")
                await asyncio.sleep(wait_secs)
                await self._generate_daily_report()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[Scheduler] Daily report error: {e}", exc_info=True)

    async def _cross_health_check_loop(self):
        """
        Cada 5 minutos: cruza el estado de agentes críticos entre sí.
        Si Security está en ERROR, avisa a Engineering y DevOps.
        Si Engineering está en ERROR, pausa emisión de tokens en DeFi.
        """
        while self._running:
            try:
                await asyncio.sleep(300)  # 5 min
                await self._run_cross_health_checks()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[Scheduler] Cross health error: {e}", exc_info=True)

    async def _weekly_report_loop(self):
        """
        Cada lunes a las 09:00 UTC: reporte semanal de tendencias.
        """
        while self._running:
            try:
                now    = datetime.now(timezone.utc)
                # Próximo lunes a las 09:00
                days_until_monday = (7 - now.weekday()) % 7 or 7
                target = (now + timedelta(days=days_until_monday)).replace(
                    hour=9, minute=0, second=0, microsecond=0
                )
                wait_secs = (target - now).total_seconds()
                logger.debug(f"[Scheduler] Weekly report in {wait_secs/3600:.1f}h")
                await asyncio.sleep(wait_secs)
                await self._generate_weekly_report()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[Scheduler] Weekly report error: {e}", exc_info=True)

    async def _midnight_cleanup_loop(self):
        """
        Cada día a las 00:00 UTC: limpieza de alertas antiguas y rotación de logs.
        """
        while self._running:
            try:
                now    = datetime.now(timezone.utc)
                target = (now + timedelta(days=1)).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
                wait_secs = (target - now).total_seconds()
                await asyncio.sleep(wait_secs)
                await self._midnight_cleanup()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[Scheduler] Midnight cleanup error: {e}", exc_info=True)

    # ------------------------------------------------------------------ #
    #  Task implementations                                              #
    # ------------------------------------------------------------------ #

    async def _take_kpi_snapshot(self):
        """Guarda snapshot de KPIs de todos los agentes con timestamp."""
        snapshot = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "agents": {}
        }
        for agent_id, agent in self.manager.agents.items():
            snapshot["agents"][agent_id] = {
                "status":      agent.status.value,
                "run_count":   agent.run_count,
                "error_count": agent.error_count,
                "kpis":        agent.get_kpis(),
            }
        self._history.append(snapshot)
        # Mantener solo las últimas 48 horas (48 × 2 snapshots/hora = 96)
        if len(self._history) > 96:
            self._history = self._history[-96:]

        # Persistir en Redis para Grafana
        redis = self.manager._get_redis()
        if redis:
            await redis.lpush("bezhas:dept_kpi_history", json.dumps(snapshot))
            await redis.ltrim("bezhas:dept_kpi_history", 0, 95)

        logger.debug("[Scheduler] KPI snapshot saved")

    async def _generate_daily_report(self):
        """Genera el reporte diario ejecutivo y lo notifica."""
        now   = datetime.now(timezone.utc)
        mgr   = self.manager
        summary = mgr.summary()

        # KPIs clave por departamento
        report_lines = [
            f"=== BeZhas Daily Report — {now.strftime('%Y-%m-%d')} ===",
            f"Agents running:  {summary['running']}/{summary['total_agents']}",
            f"Critical alerts: {summary['critical_alerts']}",
            "",
        ]

        # Sección por departamento
        for agent in mgr.agents.values():
            kpis = agent.get_kpis()
            report_lines.append(f"[{agent.dept_name}]")
            for k, v in list(kpis.items())[:4]:  # top 4 KPIs
                report_lines.append(f"  {k}: {v}")
            recent_alerts = agent.alerts[-2:]
            if recent_alerts:
                report_lines.append(f"  Last alerts: {len(recent_alerts)}")
            report_lines.append("")

        report_text = "\n".join(report_lines)

        # Persistir reporte en Redis
        redis = mgr._get_redis()
        if redis:
            await redis.set(
                f"bezhas:daily_report:{now.strftime('%Y%m%d')}",
                report_text,
                ex=7 * 24 * 3600  # expira en 7 días
            )

        # Enviar via Slack si está configurado
        security_agent = mgr.agents.get("dept_security_005")
        if security_agent and security_agent.actions and summary["critical_alerts"] > 0:
            await security_agent.actions.notify_slack(
                f"Daily Report: {summary['critical_alerts']} critical alerts across {summary['running']} agents",
                level="warning",
                fields={
                    "Agents running": f"{summary['running']}/{summary['total_agents']}",
                    "Date": now.strftime("%Y-%m-%d"),
                }
            )

        logger.info(f"[Scheduler] Daily report generated — {summary['critical_alerts']} critical alerts")
        return report_text

    async def _generate_weekly_report(self):
        """Genera reporte semanal de tendencias con datos históricos."""
        now = datetime.now(timezone.utc)
        mgr = self.manager

        # Analizar histórico de la semana
        week_snapshots = self._history[-336:]  # ~7 días × 48 snapshots/día
        if not week_snapshots:
            logger.info("[Scheduler] No history for weekly report yet")
            return

        # Calcular tendencias
        trend_data = {}
        for agent_id in mgr.agents:
            kpi_series = [
                s["agents"].get(agent_id, {}).get("kpis", {})
                for s in week_snapshots
                if agent_id in s.get("agents", {})
            ]
            if kpi_series:
                trend_data[agent_id] = {
                    "snapshots_count": len(kpi_series),
                    "error_trend": [
                        s.get("error_count", 0) for s in
                        [snap["agents"].get(agent_id, {}) for snap in week_snapshots[-10:]]
                        if s
                    ]
                }

        report = {
            "week_ending": now.isoformat(),
            "total_cycles": sum(a.run_count for a in mgr.agents.values()),
            "total_errors": sum(a.error_count for a in mgr.agents.values()),
            "uptime_pct": round(
                (sum(1 for a in mgr.agents.values() if a.error_count == 0) / len(mgr.agents)) * 100,
                1
            ),
            "trend_data": trend_data,
        }

        redis = mgr._get_redis()
        if redis:
            await redis.set(
                f"bezhas:weekly_report:{now.strftime('%Y-W%W')}",
                json.dumps(report),
                ex=30 * 24 * 3600  # 30 días
            )

        logger.info(f"[Scheduler] Weekly report generated: {report['total_cycles']} cycles, "
                    f"{report['total_errors']} errors, {report['uptime_pct']}% uptime")
        return report

    async def _run_cross_health_checks(self):
        """
        Comprobaciones cruzadas entre departamentos.
        Detecta situaciones que ningún agente individual puede ver.
        """
        from .base_dept_agent import AgentStatus

        mgr    = self.manager
        agents = mgr.agents

        # 1. Si Security está en ERROR → alertar a Engineering y DevOps
        security = agents.get("dept_security_005")
        if security and security.status == AgentStatus.ERROR:
            eng    = agents.get("dept_eng_001")
            devops = agents.get("dept_devops_002")
            for a in [eng, devops]:
                if a and hasattr(a, "bus"):
                    await a.bus.alert_agent(
                        security.agent_id,
                        "Security agent in ERROR state — manual review required",
                        {"security_error_count": security.error_count}
                    )
            logger.warning("[Scheduler] Cross-check: Security agent in ERROR")

        # 2. Si Engineering muestra batcher wallet crítico → notificar Finance
        eng     = agents.get("dept_eng_001")
        finance = agents.get("dept_finance_008")
        if eng and finance:
            batcher_eth = eng.get_kpis().get("batcher_wallet_eth", 999)
            if batcher_eth < 0.1 and hasattr(finance, "bus"):
                await finance.bus.escalate(
                    eng.agent_id,
                    f"Batcher wallet CRITICAL: {batcher_eth:.4f} ETH — budget approval needed",
                    {"eth_balance": batcher_eth}
                )

        # 3. Si DeFi tiene daily cap al 90%+ → notificar Finance para preparar acción
        defi = agents.get("dept_defi_004")
        if defi and finance:
            staking_pct = defi.get_kpis().get("staking_cap_used_pct", 0)
            if staking_pct >= 90 and hasattr(finance, "bus"):
                await finance.bus.send(
                    defi.agent_id,
                    "info",
                    f"Staking emission at {staking_pct:.1f}% — governance vote may be needed",
                    {"staking_pct": staking_pct}
                )

        # 4. Si BD tiene edge nodes offline → notificar CS para soporte proactivo
        bd = agents.get("dept_bd_006")
        cs = agents.get("dept_cs_009")
        if bd and cs:
            offline = bd.get_kpis().get("edge_nodes_offline", 0)
            if offline > 0 and hasattr(cs, "bus"):
                await cs.bus.send(
                    bd.agent_id,
                    "action_request",
                    f"{offline} edge node(s) offline — initiate proactive client contact",
                    {"offline_count": offline}
                )

        logger.debug("[Scheduler] Cross-health checks completed")

    async def _midnight_cleanup(self):
        """Limpieza diaria: rota alertas antiguas, limpia dedup cache."""
        mgr = self.manager
        cleaned = 0
        for agent in mgr.agents.values():
            # Limpiar dedup cache — eliminar entradas de más de 1 día
            import time
            cutoff = time.monotonic() - 86400
            old_keys = [k for k, ts in agent._alert_dedup.items() if ts < cutoff]
            for k in old_keys:
                del agent._alert_dedup[k]
            cleaned += len(old_keys)

        # Limpiar alertas antigas de Redis (mantener últimas 500)
        redis = mgr._get_redis()
        if redis:
            await redis.ltrim("bezhas:dept_alerts", 0, 499)

        logger.info(f"[Scheduler] Midnight cleanup done — {cleaned} dedup cache entries cleared")

    # ------------------------------------------------------------------ #
    #  Manual triggers (API)                                             #
    # ------------------------------------------------------------------ #

    async def run_daily_report_now(self) -> str:
        """Fuerza la generación del reporte diario ahora mismo."""
        return await self._generate_daily_report()

    async def run_kpi_snapshot_now(self):
        """Fuerza un snapshot de KPIs ahora mismo."""
        await self._take_kpi_snapshot()

    def get_history(self, limit: int = 10) -> List[Dict]:
        """Retorna los últimos snapshots de KPIs."""
        return self._history[-limit:]
