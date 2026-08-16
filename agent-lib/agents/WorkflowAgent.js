/**
 * BeZhas Agent Runtime — WorkflowAgent
 * Ejecuta workflows registrados en BeZhasWorkflowRegistry.sol.
 * Orquesta tareas multi-step cross-módulo en el ecosistema BeZhas.
 */

'use strict';

const BaseAgent = require('../BaseAgent');

class WorkflowAgent extends BaseAgent {
  constructor(opts = {}) {
    super({
      id:           'workflow-agent',
      name:         'BeZhas Workflow Agent',
      capabilities: [
        'workflow:execute',
        'blockchain:task',
        'workflow:register',
        'growth:coordinate',
        'solutions:coordinate',
        'sdk:coordinate',
        'api:coordinate',
        'devops:coordinate',
        'finance:coordinate',
        'skill:coordinate',
        'ecosystem:coordinate',
      ],
      version:      '1.0.0',
      ...opts,
    });

    this._activeWorkflows = new Map();
  }

  async execute(task) {
    switch (task.type) {
      case 'workflow:execute':  return this._executeWorkflow(task);
      case 'blockchain:task':   return this._handleBlockchainTask(task);
      case 'workflow:register': return this._registerWorkflow(task);
      case 'growth:research':
      case 'growth:score-lead':
      case 'growth:draft-outreach':
      case 'growth:qualify':
      case 'growth:pipeline-report':
      case 'solutions:scope':
      case 'solutions:pilot-plan':
      case 'solutions:integration-risk':
      case 'sdk:integration-plan':
      case 'sdk:expand':
      case 'api:expand':
      case 'bridge:expand':
      case 'blockchain:audit':
      case 'contracts:test':
      case 'devops:health-check':
      case 'devops:incident':
      case 'devops:deploy-check':
      case 'devops:dependency-audit':
      case 'finance:treasury-report':
      case 'finance:pricing-review':
      case 'finance:pilot-economics':
      case 'payment:review':
      case 'skill:interaction-recorded':
      case 'skill:evaluate':
      case 'skill:propose-improvement':
      case 'skill:publish-approved':
      case 'ecosystem:expand':
        return this._coordinateManifestTask(task);
      default:
        throw new Error(`WorkflowAgent no soporta tipo: ${task.type}`);
    }
  }

  async _executeWorkflow(task) {
    const { workflowId, params } = task.payload;
    console.log(`[WorkflowAgent] 🔄 Ejecutando workflow: ${workflowId}`);

    this._activeWorkflows.set(workflowId, { status: 'running', startedAt: new Date().toISOString() });

    // Obtener definición del workflow desde memoria o blockchain
    const workflowDef = await this.recall(`workflow:def:${workflowId}`);

    // Análisis LLM del workflow si es la primera ejecución
    if (!workflowDef) {
      const analysis = await this.think(
        `Describe brevemente qué pasos implica el workflow ID: ${workflowId} con params: ${JSON.stringify(params)}. Sé conciso.`,
        { maxTokens: 256 }
      );
      await this.remember(`workflow:def:${workflowId}`, { id: workflowId, analysis });
    }

    // Notificar inicio
    await this.notify(`🔄 Workflow iniciado: \`${workflowId}\`\nParams: ${JSON.stringify(params)}`, { level: 'info' });

    // Ejecutar pasos del workflow
    const result = await this._runWorkflowSteps(workflowId, params);

    this._activeWorkflows.set(workflowId, { status: 'completed', completedAt: new Date().toISOString() });

    // Reportar resultado on-chain
    if (this.blockchain?.signer) {
      try {
        await this.blockchain.submitTaskResult(task.id, { workflowId, success: true, result });
      } catch (err) {
        console.warn('[WorkflowAgent] ⚠️  No se pudo confirmar on-chain:', err.message);
      }
    }

    return { workflowId, status: 'completed', result };
  }

  async _runWorkflowSteps(workflowId, params) {
    // Placeholder para ejecución real de steps
    // En producción: leer steps desde WorkflowRegistry.sol y ejecutarlos secuencialmente
    console.log(`[WorkflowAgent] ⚙️  Steps del workflow ${workflowId}...`);
    return { stepsCompleted: 0, note: 'Conectar con WorkflowRegistry.sol para steps reales' };
  }

  async _handleBlockchainTask(task) {
    const { taskType, payload } = task.payload;
    console.log(`[WorkflowAgent] ⛓️  Blockchain task: ${taskType}`);

    const analysis = await this.think(
      `Analiza esta tarea blockchain y describe su propósito: tipo=${taskType}, payload=${JSON.stringify(payload).slice(0, 200)}. Brevísimo.`,
      { maxTokens: 128 }
    );

    await this.notify(`⛓️ Task blockchain: \`${taskType}\`\n${analysis}`, { level: 'info' });
    return { taskType, analysis, processed: true };
  }

  async _registerWorkflow(task) {
    const { name, steps, description } = task.payload;
    const workflowId = `wf_${Date.now()}`;

    await this.remember(`workflow:def:${workflowId}`, { id: workflowId, name, steps, description });

    console.log(`[WorkflowAgent] 📋 Workflow registrado: ${name} (${workflowId})`);
    await this.notify(`📋 Nuevo workflow registrado: *${name}*\nID: \`${workflowId}\``, { level: 'info' });

    return { workflowId, name, registered: true };
  }

  async _coordinateManifestTask(task) {
    const orchestration = task.orchestration || {};
    const departmentId = orchestration.departmentId || this._departmentFromType(task.type);
    const payload = task.payload || {};
    const actionPlan = this._buildActionPlan(task.type, departmentId, payload);

    const episode = {
      taskId: task.id,
      taskType: task.type,
      departmentId,
      priority: task.priority || 'normal',
      source: task.source || 'runtime',
      actionPlan,
      payload,
      kpis: orchestration.kpis || [],
      coordinatedAt: new Date().toISOString(),
    };

    await this.remember(`coordination:${task.id}`, episode);

    if (task.priority === 'critical' || payload.notify === true) {
      await this.notify(
        `📌 Coordinación ${departmentId || 'general'}\n` +
        `Tarea: \`${task.type}\`\n` +
        `Siguiente paso: ${actionPlan.nextStep}`,
        { level: task.priority === 'critical' ? 'critical' : 'info' }
      );
    }

    return {
      coordinated: true,
      departmentId,
      taskType: task.type,
      actionPlan,
      kpis: orchestration.kpis || [],
    };
  }

  _buildActionPlan(taskType, departmentId, payload) {
    const subject = payload.account || payload.company || payload.skill || payload.module || payload.workflowId || 'BeZhas';
    const plans = {
      'growth:research': {
        objective: `Research and qualify ${subject} as a BeZhas enterprise prospect.`,
        nextStep: 'Build account brief, identify decision makers, map pain signals to a launch vertical.',
        requiresApproval: false,
      },
      'growth:score-lead': {
        objective: `Score ${subject} against BANT+technical fit.`,
        nextStep: 'Calculate qualification score and recommend Hot, Warm, Nurture, or Disqualify.',
        requiresApproval: false,
      },
      'growth:draft-outreach': {
        objective: `Draft outreach for ${subject}.`,
        nextStep: 'Prepare message only; require human approval before any external send.',
        requiresApproval: true,
      },
      'growth:qualify': {
        objective: `Qualify ${subject} for a BeZhas pilot.`,
        nextStep: 'Map budget, authority, need, timeline, and technical integration path.',
        requiresApproval: false,
      },
      'solutions:scope': {
        objective: `Scope a technical BeZhas solution for ${subject}.`,
        nextStep: 'Map contracts, SDK methods, API endpoints, pilot KPIs, risks, and integration estimate.',
        requiresApproval: false,
      },
      'sdk:expand': {
        objective: `Expand SDK/API surface for ${subject}.`,
        nextStep: 'Create implementation brief with target module, tests, docs, and compatibility constraints.',
        requiresApproval: false,
      },
      'api:expand': {
        objective: `Expand API capabilities for ${subject}.`,
        nextStep: 'Define endpoint contract, RBAC, rate limits, audit logging, and SDK wrapper.',
        requiresApproval: false,
      },
      'skill:evaluate': {
        objective: `Evaluate SKILL ${subject}.`,
        nextStep: 'Review outcomes, failure cases, regression risk, and improvement candidates.',
        requiresApproval: false,
      },
      'skill:propose-improvement': {
        objective: `Propose SKILL improvement for ${subject}.`,
        nextStep: 'Draft a versioned change proposal and request approval if it affects external commitments.',
        requiresApproval: true,
      },
      'devops:health-check': {
        objective: 'Check platform health.',
        nextStep: 'Probe services, collect failures, prioritize recovery actions.',
        requiresApproval: false,
      },
      'finance:pilot-economics': {
        objective: `Analyze pilot economics for ${subject}.`,
        nextStep: 'Estimate margin, gas subsidy, support cost, ARR potential, and treasury risk.',
        requiresApproval: false,
      },
      'ecosystem:expand': {
        objective: `Design ecosystem expansion around ${subject}.`,
        nextStep: 'Identify multi-party value chain, token utility, partner risks, and first pilot path.',
        requiresApproval: true,
      },
    };

    return plans[taskType] || {
      objective: `Coordinate ${taskType} for ${departmentId || 'general operations'}.`,
      nextStep: 'Create a concrete brief, route specialist work, track KPIs, and request approval for external or mutating actions.',
      requiresApproval: false,
    };
  }

  _departmentFromType(taskType) {
    if (!taskType) return null;
    const [prefix] = taskType.split(':');
    const map = {
      growth: 'growth',
      solutions: 'solutions',
      sdk: 'blockchain',
      api: 'blockchain',
      bridge: 'blockchain',
      blockchain: 'blockchain',
      contracts: 'blockchain',
      devops: 'devops',
      finance: 'finance',
      payment: 'finance',
      skill: 'skills',
      ecosystem: 'director',
    };
    return map[prefix] || null;
  }

  getStats() {
    return {
      ...super.getStats(),
      activeWorkflows: this._activeWorkflows.size,
    };
  }

  _systemPrompt() {
    return `Eres el Workflow Agent de BeZhas — orquestador de procesos blockchain multi-step.
Gestionas workflows registrados en BeZhasWorkflowRegistry.sol y coordinas acciones entre módulos del ecosistema.
También coordinas tareas estratégicas del manifiesto: growth, solutions, SDK/API, devops, finance,
skills y expansión del ecosistema. No ejecutas acciones externas o mutantes sin aprobación humana.
Eres metódico, transaccional y garantizas la integridad de cada paso del workflow.
Responde siempre en español.`;
  }
}

module.exports = WorkflowAgent;
