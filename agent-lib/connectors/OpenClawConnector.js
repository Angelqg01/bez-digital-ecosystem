/**
 * BeZhas Agent Runtime — OpenClawConnector
 * Bridge entre el Agent Runtime (Node.js) y el OpenClaw Engine (Python).
 *
 * Orden de fallback LLM (Opción 1 - desarrollo):
 *   1. Claude Sonnet 4      (API Anthropic)
 *   2. Gemini 2.0 Flash     (API Google)
 *   3. Claude Haiku 4.5     (API Anthropic)
 *   4. GPT-4o Mini          (API OpenAI)
 *   5. DeepSeek             (API DeepSeek)
 *   6. Ollama local         (localhost:11434) ← fallback final sin coste
 *
 * El engine Python gestiona el routing. Este connector sólo llama al engine.
 */

'use strict';

const EventEmitter = require('events');

class OpenClawConnector extends EventEmitter {
  constructor(engineUrl = 'http://localhost:8080') {
    super();
    this.engineUrl  = engineUrl;
    this.ollamaUrl  = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.ollamaModel = process.env.OLLAMA_MODEL || 'llama3.2';
    this._timeout   = 30_000; // 30s
    this._available = false;
  }

  // ─────────────────────────────────────────────
  // COMPLETIONS LLM
  // ─────────────────────────────────────────────

  /**
   * Llama al LLM vía OpenClaw Engine.
   * Si el engine no está disponible, fallback directo a Ollama.
   */
  async complete({ prompt, systemPrompt, model, maxTokens = 1024, agentId }) {
    // Intentar OpenClaw Engine primero
    if (await this._isEngineAvailable()) {
      try {
        return await this._callEngine('/api/complete', {
          prompt,
          system_prompt: systemPrompt,
          model,
          max_tokens: maxTokens,
          agent_id: agentId,
        });
      } catch (err) {
        console.warn('[OpenClawConnector] ⚠️  Engine falló, usando Ollama directo:', err.message);
      }
    }

    // Fallback directo a Ollama (siempre disponible localmente)
    return this._callOllama(prompt, systemPrompt, maxTokens);
  }

  // ─────────────────────────────────────────────
  // NOTIFICACIONES → TELEGRAM / DISCORD
  // ─────────────────────────────────────────────

  async sendNotification({ agentId, agentName, message, channel = 'telegram', level = 'info' }) {
    if (!await this._isEngineAvailable()) {
      console.warn(`[OpenClawConnector] ⚠️  Engine no disponible. Notificación perdida: ${message}`);
      return null;
    }

    return this._callEngine('/api/notify', {
      agent_id:   agentId,
      agent_name: agentName,
      message,
      channel,
      level,
    });
  }

  // ─────────────────────────────────────────────
  // HUMAN-IN-THE-LOOP REQUEST
  // ─────────────────────────────────────────────

  async sendHITLRequest({ taskId, context, approveUrl, rejectUrl }) {
    if (!await this._isEngineAvailable()) {
      console.error('[OpenClawConnector] ❌ Engine no disponible para HITL. Tarea bloqueada:', taskId);
      throw new Error('OpenClaw Engine no disponible para HITL');
    }

    return this._callEngine('/api/hitl/request', {
      task_id:     taskId,
      context,
      approve_url: approveUrl,
      reject_url:  rejectUrl,
    });
  }

  // ─────────────────────────────────────────────
  // SKILL EXECUTION
  // ─────────────────────────────────────────────

  async executeSkill(skillName, inputs = {}) {
    if (!await this._isEngineAvailable()) {
      throw new Error('OpenClaw Engine no disponible para ejecutar skills');
    }

    return this._callEngine('/api/skill/run', {
      skill: skillName,
      inputs,
    });
  }

  // ─────────────────────────────────────────────
  // OLLAMA DIRECTO (fallback sin engine)
  // ─────────────────────────────────────────────

  async _callOllama(prompt, systemPrompt, maxTokens) {
    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    console.log(`[OpenClawConnector] 🦙 Ollama directo (${this.ollamaModel}) → ${this.ollamaUrl}`);

    const res = await this._fetch(`${this.ollamaUrl}/api/chat`, {
      model:    this.ollamaModel,
      messages,
      stream:   false,
      options:  { num_predict: maxTokens },
    });

    return {
      text:   res.message?.content || '',
      model:  `ollama/${this.ollamaModel}`,
      source: 'ollama-local',
    };
  }

  // ─────────────────────────────────────────────
  // OLLAMA HEALTH CHECK
  // ─────────────────────────────────────────────

  async checkOllama() {
    try {
      const res = await fetch(`${this.ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const models = (data.models || []).map(m => m.name);
      return { available: true, models };
    } catch (err) {
      return { available: false, error: err.message };
    }
  }

  // ─────────────────────────────────────────────
  // INTERNALS
  // ─────────────────────────────────────────────

  async _callEngine(path, body) {
    const res = await this._fetch(`${this.engineUrl}${path}`, body);
    return res;
  }

  async _fetch(url, body) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), this._timeout);

    try {
      const response = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      return response.json();
    } finally {
      clearTimeout(tid);
    }
  }

  async _isEngineAvailable() {
    try {
      const res = await fetch(`${this.engineUrl}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      this._available = res.ok;
    } catch {
      this._available = false;
    }
    return this._available;
  }

  async healthCheck() {
    const engine = await this._isEngineAvailable();
    const ollama = await this.checkOllama();
    return {
      engine: { available: engine, url: this.engineUrl },
      ollama,
    };
  }
}

module.exports = OpenClawConnector;
