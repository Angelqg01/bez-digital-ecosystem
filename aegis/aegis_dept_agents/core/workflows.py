"""
BeZhas Aegis — Motor de Workflows Inter-Departamentales
Flujos de automatización que involucran múltiples agentes.

Workflows definidos:
  1. onboard_enterprise_client  — BD → CS → Engineering → Finance
  2. security_incident_response — Security → Engineering → DevOps → Legal
  3. governance_vote_process    — DeFi → Legal → Marketing → Finance
  4. token_emission_alert       — DeFi → Finance → Engineering → Security
  5. client_gas_tank_critical   — Finance → CS → BD
  6. new_sector_activation      — Engineering → AI → BD → Marketing
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .manager import DeptAgentManager

logger = logging.getLogger(__name__)


class WorkflowStatus(str, Enum):
    PENDING   = "pending"
    RUNNING   = "running"
    COMPLETED = "completed"
    FAILED    = "failed"
    CANCELLED = "cancelled"


@dataclass
class WorkflowStep:
    name:        str
    agent_id:    str
    description: str
    completed:   bool = False
    result:      Optional[Dict] = None
    error:       Optional[str]  = None
    started_at:  Optional[str]  = None
    ended_at:    Optional[str]  = None


@dataclass
class WorkflowRun:
    workflow_id:  str
    workflow_name: str
    trigger_data: Dict
    steps:        List[WorkflowStep] = field(default_factory=list)
    status:       WorkflowStatus = WorkflowStatus.PENDING
    started_at:   str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    ended_at:     Optional[str] = None
    current_step: int = 0

    def to_dict(self) -> Dict:
        return {
            "workflow_id":   self.workflow_id,
            "workflow_name": self.workflow_name,
            "status":        self.status.value,
            "started_at":    self.started_at,
            "ended_at":      self.ended_at,
            "current_step":  self.current_step,
            "total_steps":   len(self.steps),
            "steps": [
                {
                    "name":        s.name,
                    "agent_id":    s.agent_id,
                    "description": s.description,
                    "completed":   s.completed,
                    "error":       s.error,
                }
                for s in self.steps
            ],
        }


class WorkflowEngine:
    """
    Motor de workflows que orquesta acciones entre los 10 agentes departamentales.
    """

    def __init__(self, manager: "DeptAgentManager"):
        self.manager   = manager
        self._runs:    Dict[str, WorkflowRun] = {}
        self._counter  = 0

    def _new_run_id(self, name: str) -> str:
        self._counter += 1
        ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        return f"wf_{name[:8]}_{ts}_{self._counter}"

    def _agent(self, agent_id: str):
        return self.manager.agents.get(agent_id)

    async def _step(self, run: WorkflowRun, step: WorkflowStep, coro):
        """Ejecuta un paso del workflow con tracking."""
        step.started_at = datetime.now(timezone.utc).isoformat()
        run.current_step = run.steps.index(step)
        logger.info(f"[Workflow:{run.workflow_id}] Step: {step.name} ({step.agent_id})")
        try:
            result = await coro
            step.completed = True
            step.result    = result or {}
            step.ended_at  = datetime.now(timezone.utc).isoformat()
        except Exception as e:
            step.error   = str(e)
            step.ended_at = datetime.now(timezone.utc).isoformat()
            logger.error(f"[Workflow:{run.workflow_id}] Step '{step.name}' failed: {e}")
            raise

    # ================================================================== #
    #  WORKFLOW 1 — Onboard Enterprise Client                            #
    # ================================================================== #

    async def onboard_enterprise_client(
        self,
        client_name: str,
        client_id:   str,
        sector:      str,
        initial_deposit_usd: float = 500.0,
    ) -> WorkflowRun:
        """
        Flujo completo de onboarding de un nuevo cliente enterprise.

        Pasos:
          1. BD verifica que el cliente está en pipeline
          2. Finance carga el gas tank inicial (Stripe)
          3. Engineering genera API key y wallet delegada
          4. CS crea perfil de soporte y configura SLA
          5. AI registra el cliente en el sector correspondiente
          6. Marketing notifica para lead nurturing
        """
        run_id = self._new_run_id("onboard")
        run    = WorkflowRun(
            workflow_id   = run_id,
            workflow_name = "onboard_enterprise_client",
            trigger_data  = {"client_name": client_name, "client_id": client_id, "sector": sector},
            steps = [
                WorkflowStep("verify_pipeline",    "dept_bd_006",      "BD verifies client in pipeline"),
                WorkflowStep("charge_gas_tank",    "dept_finance_008", "Finance loads initial gas tank"),
                WorkflowStep("generate_api_key",   "dept_eng_001",     "Engineering creates API key + wallet"),
                WorkflowStep("create_cs_profile",  "dept_cs_009",      "CS creates support profile"),
                WorkflowStep("register_sector",    "dept_ai_003",      "AI registers client in sector"),
                WorkflowStep("notify_marketing",   "dept_mktg_007",    "Marketing starts nurture flow"),
            ]
        )
        self._runs[run_id] = run
        run.status = WorkflowStatus.RUNNING

        try:
            # Step 1 — BD
            bd = self._agent("dept_bd_006")
            if bd:
                await self._step(run, run.steps[0], bd.call_api(
                    "POST", "/analytics/clients/verify",
                    {"client_id": client_id, "verified_by": "dept_bd_006"}
                ))

            # Step 2 — Finance: cargar gas tank
            finance = self._agent("dept_finance_008")
            if finance and finance.actions:
                await self._step(run, run.steps[1], finance.actions.trigger_gas_recharge(
                    client_id, initial_deposit_usd
                ))

            # Step 3 — Engineering: API key + wallet
            eng = self._agent("dept_eng_001")
            if eng:
                await self._step(run, run.steps[2], eng.call_api(
                    "POST", "/wallet/create-enterprise",
                    {"client_id": client_id, "client_name": client_name}
                ))

            # Step 4 — CS: perfil de soporte
            cs = self._agent("dept_cs_009")
            if cs and cs.actions:
                await self._step(run, run.steps[3], cs.actions.create_support_ticket(
                    client_id,
                    f"New client onboarding: {client_name}",
                    f"Welcome package setup for sector: {sector}. Initial gas: ${initial_deposit_usd}",
                    priority="high"
                ))

            # Step 5 — AI: registrar en sector
            ai = self._agent("dept_ai_003")
            if ai:
                await self._step(run, run.steps[4], ai.call_api(
                    "POST", f"/sectors/{sector}/register-client",
                    {"client_id": client_id}
                ))

            # Step 6 — Marketing: notificar
            mktg = self._agent("dept_mktg_007")
            if mktg and hasattr(mktg, "bus"):
                await self._step(run, run.steps[5], mktg.bus.send(
                    "dept_mktg_007", "info",
                    f"New client onboarded: {client_name} ({sector})",
                    {"client_id": client_id, "sector": sector}
                ))

            run.status   = WorkflowStatus.COMPLETED
            run.ended_at = datetime.now(timezone.utc).isoformat()
            logger.info(f"[Workflow:{run_id}] onboard_enterprise_client COMPLETED for {client_name}")

        except Exception as e:
            run.status   = WorkflowStatus.FAILED
            run.ended_at = datetime.now(timezone.utc).isoformat()
            logger.error(f"[Workflow:{run_id}] FAILED: {e}")

        return run

    # ================================================================== #
    #  WORKFLOW 2 — Security Incident Response                           #
    # ================================================================== #

    async def security_incident_response(
        self,
        incident_type: str,
        severity:      str,
        affected_component: str,
        details:       Dict = None,
    ) -> WorkflowRun:
        """
        Respuesta automática ante incidentes de seguridad.

        Pasos:
          1. Security abre incident report en Aegis AutoHealer
          2. Engineering evalúa si hay que pausar contratos
          3. DevOps verifica estado de infraestructura
          4. Legal registra evento de compliance
          5. Marketing prepara comunicación si es necesario
        """
        run_id = self._new_run_id("secincident")
        run    = WorkflowRun(
            workflow_id   = run_id,
            workflow_name = "security_incident_response",
            trigger_data  = {"type": incident_type, "severity": severity, "component": affected_component},
            steps = [
                WorkflowStep("open_incident",     "dept_security_005", "Security opens incident report"),
                WorkflowStep("eval_contract_pause","dept_eng_001",     "Engineering evaluates contract pause"),
                WorkflowStep("check_infra",       "dept_devops_002",   "DevOps checks infrastructure"),
                WorkflowStep("log_compliance",    "dept_legal_010",    "Legal logs compliance event"),
                WorkflowStep("prepare_comms",     "dept_mktg_007",     "Marketing prepares communications"),
            ]
        )
        self._runs[run_id] = run
        run.status = WorkflowStatus.RUNNING

        try:
            # Step 1 — Security: incident report
            security = self._agent("dept_security_005")
            if security and security.actions:
                await self._step(run, run.steps[0], security.actions.trigger_incident_report(
                    f"Security Incident: {incident_type}",
                    f"Component: {affected_component}\nDetails: {details or {}}",
                    severity=severity
                ))
                # Broadcast a todos los agentes
                await security.bus.broadcast(
                    "security_alert",
                    f"SECURITY INCIDENT: {incident_type} ({severity}) on {affected_component}",
                    details or {},
                    priority=1
                )

            # Step 2 — Engineering: ¿pausar contratos?
            eng = self._agent("dept_eng_001")
            if eng and severity == "critical":
                await self._step(run, run.steps[1], eng.actions.pause_contract(
                    affected_component,
                    f"Security incident: {incident_type}"
                ))
            else:
                run.steps[1].completed = True
                run.steps[1].result    = {"action": "no_pause_needed"}

            # Step 3 — DevOps: estado infraestructura
            devops = self._agent("dept_devops_002")
            if devops:
                await self._step(run, run.steps[2], devops.call_mcp_tool(
                    "system-health", {"service": "all", "trigger": "incident"}
                ))

            # Step 4 — Legal: log compliance
            legal = self._agent("dept_legal_010")
            if legal and legal.actions:
                await self._step(run, run.steps[3], legal.actions.log_compliance_event(
                    "security_incident",
                    {"type": incident_type, "severity": severity, "component": affected_component},
                    regulation="GDPR" if "data" in incident_type.lower() else "MiCA"
                ))

            # Step 5 — Marketing: preparar comunicación externa
            mktg = self._agent("dept_mktg_007")
            if mktg and severity == "critical":
                await self._step(run, run.steps[4], mktg.call_api(
                    "POST", "/notifications/prepare-comms",
                    {"incident_id": run_id, "severity": severity, "public_message": True}
                ))
            else:
                run.steps[4].completed = True
                run.steps[4].result    = {"action": "no_public_comms_needed"}

            run.status   = WorkflowStatus.COMPLETED
            run.ended_at = datetime.now(timezone.utc).isoformat()
            logger.warning(f"[Workflow:{run_id}] Security incident response COMPLETED ({severity})")

        except Exception as e:
            run.status   = WorkflowStatus.FAILED
            run.ended_at = datetime.now(timezone.utc).isoformat()
            logger.error(f"[Workflow:{run_id}] Incident response FAILED: {e}")

        return run

    # ================================================================== #
    #  WORKFLOW 3 — Token Emission Alert                                 #
    # ================================================================== #

    async def token_emission_alert(
        self,
        emission_type: str,    # "staking" | "farming"
        current_bez:   float,
        cap_bez:       float,
    ) -> WorkflowRun:
        """
        Flujo cuando el daily emission cap está cerca o se ha superado.

        Pasos:
          1. DeFi registra el estado de emisión
          2. Finance calcula impacto P&L
          3. Engineering verifica parámetros en contratos
          4. Security confirma que no hay manipulación
          5. DeFi propone ajuste via governance si cap superado
        """
        run_id = self._new_run_id("emission")
        cap_pct = round((current_bez / cap_bez) * 100, 1)
        severity = "critical" if cap_pct >= 100 else "warning"

        run = WorkflowRun(
            workflow_id   = run_id,
            workflow_name = "token_emission_alert",
            trigger_data  = {"emission_type": emission_type, "current_bez": current_bez,
                             "cap_bez": cap_bez, "cap_pct": cap_pct},
            steps = [
                WorkflowStep("log_emission_state",  "dept_defi_004",     "DeFi logs emission state"),
                WorkflowStep("calc_pl_impact",      "dept_finance_008",  "Finance calculates P&L impact"),
                WorkflowStep("verify_contract_params","dept_eng_001",    "Engineering checks contract params"),
                WorkflowStep("fraud_check",         "dept_security_005", "Security checks for manipulation"),
                WorkflowStep("propose_governance",  "dept_defi_004",     "DeFi creates governance proposal if needed"),
            ]
        )
        self._runs[run_id] = run
        run.status = WorkflowStatus.RUNNING

        try:
            defi     = self._agent("dept_defi_004")
            finance  = self._agent("dept_finance_008")
            eng      = self._agent("dept_eng_001")
            security = self._agent("dept_security_005")

            # Step 1 — DeFi log
            if defi:
                await self._step(run, run.steps[0], defi.call_api(
                    "POST", "/gateway/v1/emission/log",
                    {"type": emission_type, "current": current_bez, "cap": cap_bez, "pct": cap_pct}
                ))

            # Step 2 — Finance P&L
            if finance:
                usd_value = current_bez * 0.10  # 1 BEZ = $0.10
                await self._step(run, run.steps[1], finance.call_api(
                    "POST", "/analytics/emission-impact",
                    {"bez_emitted": current_bez, "usd_value": usd_value, "type": emission_type}
                ))

            # Step 3 — Engineering verify params
            if eng:
                await self._step(run, run.steps[2], eng.call_api(
                    "GET", f"/contracts/{'StakingPool' if emission_type=='staking' else 'LiquidityFarming'}/params"
                ))

            # Step 4 — Security fraud check
            if security:
                await self._step(run, run.steps[3], security.call_mcp_tool(
                    "assess-fraud-risk",
                    {"scope": f"{emission_type}_emission", "amount_bez": current_bez}
                ))

            # Step 5 — Governance proposal si cap superado
            if defi and cap_pct >= 100:
                await self._step(run, run.steps[4], defi.call_api(
                    "POST", "/gateway/v1/governance/propose",
                    {
                        "title": f"Adjust {emission_type} rewardRate — daily cap exceeded",
                        "description": f"Cap exceeded: {current_bez:.0f}/{cap_bez:.0f} BEZ ({cap_pct}%). Propose reducing rewardRate by 20%.",
                        "proposed_by": "dept_defi_004"
                    }
                ))
            else:
                run.steps[4].completed = True
                run.steps[4].result    = {"action": "no_governance_needed", "cap_pct": cap_pct}

            run.status   = WorkflowStatus.COMPLETED
            run.ended_at = datetime.now(timezone.utc).isoformat()
            logger.info(f"[Workflow:{run_id}] Emission alert workflow COMPLETED — {cap_pct}% cap used")

        except Exception as e:
            run.status   = WorkflowStatus.FAILED
            run.ended_at = datetime.now(timezone.utc).isoformat()
            logger.error(f"[Workflow:{run_id}] Emission alert workflow FAILED: {e}")

        return run

    # ================================================================== #
    #  WORKFLOW 4 — Client Gas Tank Critical                             #
    # ================================================================== #

    async def client_gas_tank_critical(self, client_id: str, client_name: str, balance_usd: float) -> WorkflowRun:
        """
        Flujo cuando el gas tank de un cliente cae a nivel crítico.

        Pasos:
          1. Finance intenta auto-recharge via Stripe
          2. CS crea ticket urgente si falla el pago
          3. BD notifica al account manager
          4. Engineering monitoriza el nodo del cliente
        """
        run_id = self._new_run_id("gastank")
        run    = WorkflowRun(
            workflow_id   = run_id,
            workflow_name = "client_gas_tank_critical",
            trigger_data  = {"client_id": client_id, "client_name": client_name, "balance_usd": balance_usd},
            steps = [
                WorkflowStep("auto_recharge",    "dept_finance_008", "Finance triggers auto-recharge"),
                WorkflowStep("create_ticket",    "dept_cs_009",      "CS creates urgent support ticket"),
                WorkflowStep("notify_bd",        "dept_bd_006",      "BD notifies account manager"),
                WorkflowStep("monitor_node",     "dept_eng_001",     "Engineering monitors client edge node"),
            ]
        )
        self._runs[run_id] = run
        run.status = WorkflowStatus.RUNNING

        try:
            # Step 1 — Finance auto-recharge
            finance = self._agent("dept_finance_008")
            recharge_ok = False
            if finance and finance.actions:
                result = await finance.actions.trigger_gas_recharge(client_id, 50.0)
                run.steps[0].completed = True
                run.steps[0].result    = {"status": result.status.value}
                recharge_ok = result.status.value == "completed"

            # Step 2 — CS ticket (siempre, urgente si recarga falló)
            cs = self._agent("dept_cs_009")
            if cs and cs.actions:
                await self._step(run, run.steps[1], cs.actions.create_support_ticket(
                    client_id,
                    f"URGENT: Gas tank critical — {client_name}",
                    f"Balance: ${balance_usd:.2f}. Auto-recharge {'succeeded' if recharge_ok else 'FAILED'}.",
                    priority="critical" if not recharge_ok else "high"
                ))

            # Step 3 — BD notifica
            bd = self._agent("dept_bd_006")
            if bd and hasattr(bd, "bus"):
                await self._step(run, run.steps[2], bd.bus.send(
                    "dept_cs_009", "info",
                    f"Gas tank critical for {client_name}",
                    {"client_id": client_id, "balance_usd": balance_usd, "recharge_ok": recharge_ok}
                ))

            # Step 4 — Engineering monitoriza el edge node del cliente
            eng = self._agent("dept_eng_001")
            if eng:
                await self._step(run, run.steps[3], eng.call_mcp_tool(
                    "monitor-edge-node", {"client_id": client_id, "priority": "high"}
                ))

            run.status   = WorkflowStatus.COMPLETED
            run.ended_at = datetime.now(timezone.utc).isoformat()

        except Exception as e:
            run.status   = WorkflowStatus.FAILED
            run.ended_at = datetime.now(timezone.utc).isoformat()
            logger.error(f"[Workflow:{run_id}] Gas tank critical workflow FAILED: {e}")

        return run

    # ================================================================== #
    #  API — list and get                                                 #
    # ================================================================== #

    def get_run(self, run_id: str) -> Optional[Dict]:
        run = self._runs.get(run_id)
        return run.to_dict() if run else None

    def list_runs(self, limit: int = 20) -> List[Dict]:
        runs = sorted(self._runs.values(), key=lambda r: r.started_at, reverse=True)
        return [r.to_dict() for r in runs[:limit]]

    def list_runs_by_status(self, status: str) -> List[Dict]:
        return [r.to_dict() for r in self._runs.values() if r.status.value == status]
