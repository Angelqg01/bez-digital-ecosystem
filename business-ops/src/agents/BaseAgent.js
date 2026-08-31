'use strict';

const { markSideEffect } = require('../core/executionContext');
const { hasSideEffect } = require('../cognition/toolCatalog');

/**
 * BaseAgent — clase base de todos los agentes del ejército.
 *
 * Cada agente especialista o manager extiende esta clase e implementa run().
 * Un agente NUNCA llama directamente a un modelo: pasa por this.model (ModelGateway),
 * y NUNCA ejecuta una acción irreversible sin pasar por this.guardrails.
 */
class BaseAgent {
  /**
   * @param {object} ctx
   * @param {string} ctx.id            - identificador único, ej. 'sales.lead-hunter'
   * @param {string} ctx.name          - nombre legible
   * @param {string} ctx.department    - 'sales' | 'marketing' | ...
   * @param {string} ctx.tier          - 'manager' | 'specialist'
   * @param {string} ctx.tenantId      - empresa cliente a la que pertenece
   * @param {object} ctx.model         - ModelGateway
   * @param {object} ctx.memory        - MemoryManager (scoped al tenant)
   * @param {object} ctx.guardrails    - PolicyEngine
   * @param {object} ctx.tools         - { connectorName: connector }
   * @param {object} ctx.bus           - EventBus
   */
  constructor(ctx = {}) {
    this.id = ctx.id;
    this.name = ctx.name || ctx.id;
    this.department = ctx.department;
    this.tier = ctx.tier || 'specialist';
    this.tenantId = ctx.tenantId;

    this.model = ctx.model;
    this.memory = ctx.memory;
    this.guardrails = ctx.guardrails;
    this.hitl = ctx.hitl;        // HITLGate: bloquea acciones que requieren aprobación humana
    this.knowledgeBase = ctx.knowledgeBase; // KnowledgeBase del tenant (RAG), opcional
    this.business = ctx.business; // BusinessProfile del tenant (identidad + reglas), opcional
    this.doNotContact = ctx.doNotContact; // DoNotContactList del tenant (a nivel de deal/empresa), opcional
    this.tools = ctx.tools || {};
    this.bus = ctx.bus;
    this.store = ctx.store;      // persistencia del tenant (facts), opcional

    // Cada agente declara qué modelo-clase necesita y qué herramientas usa.
    this.modelTier = ctx.modelTier || 'fast';   // 'frontier' | 'mid' | 'fast'
    this.capabilities = ctx.capabilities || [];
    this.systemPrompt = ctx.systemPrompt || 'Eres un agente especialista.';
  }

  /**
   * Punto de entrada estándar. Override en cada agente.
   * @param {object} task - { type, payload, ... }
   * @returns {Promise<object>} resultado
   */
  async run(task) {
    throw new Error(`${this.id}: run() no implementado`);
  }

  // ── Helpers compartidos ──────────────────────────────────────────

  /**
   * Compone el prompt de sistema: preámbulo del negocio (identidad + reglas
   * del tenant) + rol del agente. `mode` ajusta el preámbulo ('cold'/'warm'/'base').
   */
  _system(mode = 'base') {
    const preamble = this.business ? this.business.preamble(mode) : '';
    return preamble ? `${preamble}\n\n— ROL —\n${this.systemPrompt}` : this.systemPrompt;
  }

  /**
   * Playbook destilado por el LearningEngine de los casos pasados de este agente.
   * Se reinyecta en el prompt para cerrar el bucle de mejora continua.
   */
  async _playbookContext() {
    if (!this.memory?.getFact) return '';
    try {
      const pb = await this.memory.getFact(`playbook:${this.id}`);
      return pb?.text ? `\n\nPLAYBOOK APRENDIDO (de tus casos pasados):\n${pb.text}` : '';
    } catch { return ''; }
  }

  /**
   * Llamada al modelo con el contexto del agente y recuperación de memoria (RAG).
   */
  async think(prompt, { useMemory = true, maxTokens = 1500, mode = 'base' } = {}) {
    let context = '';
    if (useMemory && this.memory) {
      const recalled = await this.memory.recall(prompt, { agentId: this.id, k: 5 });
      if (recalled.length) {
        context = '\n\nCASOS PASADOS RELEVANTES:\n' +
          recalled.map((r, i) => `${i + 1}. ${r.summary}`).join('\n');
      }
    }
    context += await this._playbookContext();

    const result = await this.model.complete({
      tier: this.modelTier,
      system: this._system(mode) + context,
      messages: [{ role: 'user', content: prompt }],
      maxTokens,
      meta: { tenantId: this.tenantId, agentId: this.id },
    });

    return result.text;
  }

  /**
   * Bucle agéntico con tool-use: el modelo decide QUÉ herramientas invocar y
   * el agente las ejecuta — pero cada invocación pasa por act(), es decir,
   * por PolicyEngine/RedLines y, si toca, por la aprobación humana (HITL).
   * Un rechazo no rompe el bucle: se devuelve al modelo como resultado de la
   * herramienta para que adapte su plan.
   *
   * @param {string} prompt - la tarea en lenguaje natural
   * @param {object} opts
   * @param {string[]} [opts.only]     - limitar a estos conectores (def. todos los del agente)
   * @param {number}  [opts.maxTurns]  - tope de idas y vueltas modelo↔herramientas (def. 5)
   * @param {boolean} [opts.useMemory] - inyectar casos pasados como en think() (def. true)
   * @param {number}  [opts.maxTokens]
   * @returns {Promise<{text, turns, actions: [{tool, method, status}], exhausted?: boolean}>}
   */
  async thinkAndAct(prompt, { only = null, maxTurns = 5, useMemory = true, maxTokens = 1500 } = {}) {
    const { buildToolDefinitions, categoryForConnectorCall } = require('../cognition/toolCatalog');
    const toolDefs = await buildToolDefinitions(this.tools, only);
    if (!toolDefs.length) {
      // Sin conectores no hay bucle: equivale a think().
      return { text: await this.think(prompt, { useMemory, maxTokens }), turns: 1, actions: [] };
    }

    let context = '';
    if (useMemory && this.memory) {
      const recalled = await this.memory.recall(prompt, { agentId: this.id, k: 5 });
      if (recalled.length) {
        context = '\n\nCASOS PASADOS RELEVANTES:\n' +
          recalled.map((r, i) => `${i + 1}. ${r.summary}`).join('\n');
      }
    }
    context += await this._playbookContext();

    const messages = [{ role: 'user', content: prompt }];
    const actions = [];
    let lastText = '';

    for (let turn = 1; turn <= maxTurns; turn++) {
      const res = await this.model.completeWithTools({
        tier: this.modelTier,
        system: this._system() + context,
        messages,
        tools: toolDefs,
        maxTokens,
        meta: { tenantId: this.tenantId, agentId: this.id },
      });
      lastText = res.text || lastText;

      if (!res.toolCalls?.length) {
        return { text: res.text, turns: turn, actions };
      }

      // El modelo pidió herramientas: cada una pasa por guardrails + HITL.
      messages.push({ role: 'assistant', content: res.content });
      const results = [];
      for (const call of res.toolCalls) {
        const method = call.input?.method;
        const args = call.input?.args || {};
        const action = {
          tool: call.name,
          method,
          args,
          ...categoryForConnectorCall(this.tools[call.name], call.name, method, args),
        };
        let outcome;
        try {
          outcome = await this.act(action); // permite / bloquea / espera al humano
        } catch (err) {
          outcome = { status: 'error', error: err.message };
        }
        actions.push({ tool: call.name, method, status: outcome?.status || 'executed' });
        this.bus?.emit('agent:tool-call', {
          tenantId: this.tenantId, agentId: this.id,
          tool: call.name, method, status: outcome?.status || 'executed',
        });
        results.push({
          type: 'tool_result',
          tool_use_id: call.id,
          content: JSON.stringify(outcome ?? null),
        });
      }
      messages.push({ role: 'user', content: results });
    }

    // Tope de turnos alcanzado: devolvemos lo que haya, marcado.
    return { text: lastText, turns: maxTurns, actions, exhausted: true };
  }

  /**
   * Intenta ejecutar una acción que puede ser irreversible.
   * Si la política la marca como "línea roja", se pausa y se pide aprobación humana.
   */
  async act(rawAction) {
    // El remitente del departamento se resuelve ANTES de evaluar la política,
    // no al ejecutar: lo que el humano aprueba tiene que ser exactamente lo que
    // sale. Si se inyectara después, la bandeja mostraría el correo sin decir
    // desde qué buzón se manda, y una aprobación huérfana rehidratada tras un
    // reinicio (que ejecuta la acción guardada, sin pasar por el agente)
    // saldría con el remitente global en vez del del departamento.
    const action = this._withSender(rawAction);

    const verdict = this.guardrails.evaluate({
      tenantId: this.tenantId,
      agentId: this.id,
      action,
    });

    if (verdict.allowed) {
      return this._execute(action);
    }

    if (verdict.requiresApproval) {
      // Sin gate HITL disponible no se ejecuta: queda pendiente (fallback seguro).
      if (!this.hitl) {
        return { status: 'pending_approval', reason: verdict.reason, action };
      }
      // Bloquea aquí hasta que un humano apruebe o rechace desde el panel/Telegram.
      const decision = await this.hitl.request({
        tenantId: this.tenantId,
        agentId: this.id,
        action,
        reason: verdict.reason,
      });
      if (decision.approved) {
        return this._execute(action);   // reanuda la acción tras el "sí" humano
      }
      return { status: 'rejected', reason: decision.note || verdict.reason, action, timedOut: !!decision.timedOut };
    }

    return { status: 'blocked', reason: verdict.reason, action };
  }

  /**
   * Ejecuta la acción a través del connector adecuado. Override si hace falta.
   *
   * Antes de ejecutar algo que deja huella fuera del sistema (enviar, escribir,
   * cobrar) se marca la tarea: a partir de ahí ya NO puede reintentarse en
   * automático, porque repetirla duplicaría ese efecto. Se marca ANTES y no
   * después a propósito: si el conector falla a medias no sabemos si el efecto
   * llegó a producirse, y ante la duda no se reintenta.
   */
  async _execute(action) {
    const tool = this.tools[action.tool];
    if (!tool) throw new Error(`${this.id}: herramienta no disponible: ${action.tool}`);

    if (hasSideEffect(action.tool, action.method)) {
      markSideEffect({ agentId: this.id, tool: action.tool, method: action.method });
    }
    return tool.execute(action.method, action.args);
  }

  /**
   * Añade a la acción el buzón del departamento (ventas@, soporte@,
   * facturacion@…) según el perfil de negocio del tenant.
   *
   * Se resuelve en el único punto por el que pasan todas las acciones de los 60
   * especialistas, en lugar de que cada agente se acuerde de poner su
   * remitente: lo que hay que recordar en 60 sitios se olvida en alguno, y el
   * olvido sería un correo saliendo con la identidad equivocada.
   *
   * Un `from` explícito en la acción manda sobre esto. Sin perfil de negocio no
   * se toca nada: el conector usa su remitente global (MAIL_FROM).
   */
  _withSender(action) {
    if (!action || action.tool !== 'email' || action.method !== 'send') return action;
    if (action.args?.from || !this.business?.senderFor) return action;
    const from = this.business.senderFor(this.department);
    return from ? { ...action, args: { ...action.args, from } } : action;
  }

  /**
   * Guarda el resultado de una interacción para el bucle de aprendizaje.
   */
  async remember(interaction) {
    if (this.memory) {
      await this.memory.store({ agentId: this.id, ...interaction });
    }
  }
}

module.exports = BaseAgent;
