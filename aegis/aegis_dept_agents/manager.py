"""
BeZhas Aegis — Department Agent Manager (v2 — completo)
Orquestador: 10 agentes + Scheduler + Workflows + SSE + Config.
"""

import asyncio, logging
from typing import Dict, List, Optional
import redis.asyncio as aioredis
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .agents.agent_01_engineering import BlockchainEngineeringAgent
from .agents.agent_02_devops import DevOpsAgent
from .agents.agents_03_to_10 import (
    AIDataScienceAgent, DeFiTokenomicsAgent, SecurityCISOAgent,
    BusinessDevelopmentAgent, MarketingCommunityAgent,
    FinanceTreasuryAgent, CustomerSuccessAgent, LegalRegulatoryAgent,
)
from .core.base_dept_agent import BaseDeptAgent, AgentStatus
from .core.config import DeptAgentsConfig, config as default_config
from .core.scheduler import AgentScheduler
from .core.workflows import WorkflowEngine
from .core.sse_stream import sse_router, set_manager_ref

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dept-agents", tags=["Department Agents"])


class OnboardRequest(BaseModel):
    client_name: str; client_id: str; sector: str; initial_deposit_usd: float = 500.0

class IncidentRequest(BaseModel):
    incident_type: str; severity: str = "medium"; affected_component: str; details: Optional[dict] = None

class EmissionAlertRequest(BaseModel):
    emission_type: str; current_bez: float; cap_bez: float


class DeptAgentManager:
    def __init__(self, cfg: Optional[DeptAgentsConfig] = None):
        self.cfg       = cfg or default_config
        self.agents:   Dict[str, BaseDeptAgent] = {}
        self._tasks:   Dict[str, asyncio.Task]  = {}
        self._redis:   Optional[aioredis.Redis] = None
        self.scheduler: Optional[AgentScheduler] = None
        self.workflows: Optional[WorkflowEngine] = None
        self._register_all_agents()
        self.cfg.apply_to_agents(self.agents)

    def _register_all_agents(self):
        for cls in [
            SecurityCISOAgent, BlockchainEngineeringAgent, DevOpsAgent,
            DeFiTokenomicsAgent, FinanceTreasuryAgent, LegalRegulatoryAgent,
            AIDataScienceAgent, BusinessDevelopmentAgent,
            CustomerSuccessAgent, MarketingCommunityAgent,
        ]:
            agent = cls()
            self.agents[agent.agent_id] = agent
            logger.info(f"[Manager] Registered: {agent.agent_id}")

    async def start_all(self):
        if not self.cfg.enabled:
            logger.warning("[Manager] Dept agents DISABLED")
            return
        self._redis = await aioredis.from_url(self.cfg.redis_url, decode_responses=True)
        for agent in self.agents.values():
            await agent.start()
            self._tasks[agent.agent_id] = asyncio.create_task(
                self._run_agent_loop(agent), name=f"agent_{agent.agent_id}"
            )
        self.scheduler = AgentScheduler(self)
        await self.scheduler.start()
        self.workflows = WorkflowEngine(self)
        set_manager_ref(self)
        logger.info("[Manager] All systems online — 10 agents + scheduler + workflows + SSE")

    async def stop_all(self):
        if self.scheduler: await self.scheduler.stop()
        for task in self._tasks.values(): task.cancel()
        await asyncio.gather(*self._tasks.values(), return_exceptions=True)
        for agent in self.agents.values(): await agent.stop()
        if self._redis: await self._redis.aclose()

    async def _run_agent_loop(self, agent: BaseDeptAgent):
        interval = getattr(agent, "CYCLE_INTERVAL_SECONDS", 300)
        while True:
            try:
                if agent.status == AgentStatus.RUNNING:
                    await agent.run_cycle()
                await asyncio.sleep(interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[{agent.agent_id}] Loop: {e}", exc_info=True)
                await asyncio.sleep(30)

    def _get_redis(self): return self._redis

    def get_all_alerts(self) -> List[Dict]:
        alerts = []
        for agent in self.agents.values(): alerts.extend(agent.alerts)
        return sorted(alerts, key=lambda a: a.get("timestamp",""), reverse=True)[:200]

    def get_critical_alerts(self) -> List[Dict]:
        return [a for a in self.get_all_alerts() if a.get("level") == "critical"]

    def summary(self) -> Dict:
        return {
            "total_agents":    len(self.agents),
            "running":         sum(1 for a in self.agents.values() if a.status == AgentStatus.RUNNING),
            "paused":          sum(1 for a in self.agents.values() if a.status == AgentStatus.PAUSED),
            "errors":          sum(1 for a in self.agents.values() if a.status == AgentStatus.ERROR),
            "critical_alerts": len(self.get_critical_alerts()),
            "scheduler_running": self.scheduler is not None,
            "workflows_engine":  self.workflows is not None,
            "agents":          [a.info() for a in self.agents.values()],
        }


_manager: Optional[DeptAgentManager] = None
def get_manager() -> DeptAgentManager:
    global _manager
    if _manager is None: _manager = DeptAgentManager()
    return _manager

@router.get("/")
async def list_agents(): return get_manager().summary()

@router.get("/alerts")
async def get_alerts(critical_only: bool = False):
    mgr = get_manager()
    alerts = mgr.get_critical_alerts() if critical_only else mgr.get_all_alerts()
    return {"count": len(alerts), "alerts": alerts}

@router.get("/config")
async def get_config(): return get_manager().cfg.as_dict()

@router.get("/history")
async def get_kpi_history(limit: int = 10):
    mgr = get_manager()
    return {"snapshots": mgr.scheduler.get_history(limit) if mgr.scheduler else []}

@router.get("/workflows")
async def list_workflows(status: Optional[str] = None, limit: int = 20):
    mgr = get_manager()
    if not mgr.workflows: return {"workflows": []}
    runs = mgr.workflows.list_runs_by_status(status) if status else mgr.workflows.list_runs(limit)
    return {"count": len(runs), "workflows": runs}

@router.get("/{agent_id}")
async def get_agent(agent_id: str):
    mgr = get_manager()
    if agent_id not in mgr.agents: raise HTTPException(404, f"Agent '{agent_id}' not found")
    return mgr.agents[agent_id].info()

@router.post("/{agent_id}/pause")
async def pause_agent(agent_id: str):
    mgr = get_manager()
    if agent_id not in mgr.agents: raise HTTPException(404, f"Agent '{agent_id}' not found")
    mgr.agents[agent_id].status = AgentStatus.PAUSED
    return {"agent_id": agent_id, "status": "paused"}

@router.post("/{agent_id}/resume")
async def resume_agent(agent_id: str):
    mgr = get_manager()
    if agent_id not in mgr.agents: raise HTTPException(404, f"Agent '{agent_id}' not found")
    mgr.agents[agent_id].status = AgentStatus.RUNNING
    return {"agent_id": agent_id, "status": "running"}

@router.post("/{agent_id}/run")
async def force_run(agent_id: str):
    mgr = get_manager()
    if agent_id not in mgr.agents: raise HTTPException(404, f"Agent '{agent_id}' not found")
    agent = mgr.agents[agent_id]
    await agent.run_cycle()
    return {"agent_id": agent_id, "status": "cycle_completed", "kpis": agent.get_kpis()}

@router.post("/workflows/onboard")
async def workflow_onboard(req: OnboardRequest):
    mgr = get_manager()
    if not mgr.workflows: raise HTTPException(503, "Workflow engine not running")
    run = await mgr.workflows.onboard_enterprise_client(
        req.client_name, req.client_id, req.sector, req.initial_deposit_usd)
    return run.to_dict()

@router.post("/workflows/incident")
async def workflow_incident(req: IncidentRequest):
    mgr = get_manager()
    if not mgr.workflows: raise HTTPException(503, "Workflow engine not running")
    run = await mgr.workflows.security_incident_response(
        req.incident_type, req.severity, req.affected_component, req.details)
    return run.to_dict()

@router.post("/workflows/emission")
async def workflow_emission(req: EmissionAlertRequest):
    mgr = get_manager()
    if not mgr.workflows: raise HTTPException(503, "Workflow engine not running")
    run = await mgr.workflows.token_emission_alert(req.emission_type, req.current_bez, req.cap_bez)
    return run.to_dict()

@router.get("/workflows/{run_id}")
async def get_workflow_run(run_id: str):
    mgr = get_manager()
    if not mgr.workflows: raise HTTPException(503, "Workflow engine not running")
    result = mgr.workflows.get_run(run_id)
    if not result: raise HTTPException(404, f"Workflow run '{run_id}' not found")
    return result

@router.post("/report/daily")
async def trigger_daily_report():
    mgr = get_manager()
    if not mgr.scheduler: raise HTTPException(503, "Scheduler not running")
    report = await mgr.scheduler.run_daily_report_now()
    return {"status": "generated", "preview": report[:500]}

@router.post("/report/snapshot")
async def trigger_snapshot():
    mgr = get_manager()
    if not mgr.scheduler: raise HTTPException(503, "Scheduler not running")
    await mgr.scheduler.run_kpi_snapshot_now()
    return {"status": "snapshot_taken", "agents": len(mgr.agents)}
