/**
 * OllamaGateway — Local LLM integration for BeZhas Agent Runtime.
 * ─────────────────────────────────────────────────────────────────
 * Connects to a local Ollama instance to provide AI inference using
 * open-source models, with automatic fallback when paid LLM quotas
 * are exhausted.
 *
 * Models: kimi-k2, deepseek-v4-pro, qwen3, gemma4
 *
 * Features:
 *   - Health check & model listing
 *   - Chat completions (streaming & non-streaming)
 *   - Automatic quota tracking & fallback
 *   - SKILL learning from interactions
 *   - Model warm-up on startup
 */

const EventEmitter = require('events');
const SkillWriter = require('./core/SkillWriter');

const OLLAMA_BASE = process.env.OLLAMA_URL || 'http://localhost:11434';

// Models ordered by preference (first available wins)
const PREFERRED_MODELS = [
    'kimi-k2',
    'deepseek-v4-pro',
    'qwen3',
    'gemma4',
];

class OllamaGateway extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.baseUrl = opts.baseUrl || OLLAMA_BASE;
        this.models = [];
        this.defaultModel = opts.defaultModel || null;
        this.healthy = false;
        this.quotaTracker = {
            anthropic: { used: 0, limit: opts.anthropicLimit || 100000, exhausted: false },
            gemini:    { used: 0, limit: opts.geminiLimit || 500000, exhausted: false },
        };
        this.stats = {
            totalRequests: 0,
            localRequests: 0,
            cloudRequests: 0,
            fallbacksTriggered: 0,
            tokensProcessed: 0,
            avgLatencyMs: 0,
            errors: 0,
        };
        this._latencies = [];
    }

    // ── Health & Discovery ──────────────────────────────────

    async checkHealth() {
        try {
            const res = await fetch(`${this.baseUrl}/api/tags`);
            if (!res.ok) throw new Error(`Ollama responded ${res.status}`);
            const data = await res.json();
            this.models = (data.models || []).map(m => ({
                name: m.name,
                size: m.size,
                modified: m.modified_at,
                digest: m.digest,
            }));
            this.healthy = true;
            this._selectDefaultModel();
            this.emit('health:ok', { models: this.models.length });
            return { healthy: true, models: this.models };
        } catch (err) {
            this.healthy = false;
            this.emit('health:fail', { error: err.message });
            return { healthy: false, error: err.message, models: [] };
        }
    }

    _selectDefaultModel() {
        if (this.defaultModel && this.models.some(m => m.name.includes(this.defaultModel))) return;
        for (const pref of PREFERRED_MODELS) {
            const found = this.models.find(m => m.name.toLowerCase().includes(pref.toLowerCase()));
            if (found) { this.defaultModel = found.name; return; }
        }
        if (this.models.length > 0) this.defaultModel = this.models[0].name;
    }

    async listModels() {
        if (!this.healthy) await this.checkHealth();
        return this.models;
    }

    // ── Chat Completion ─────────────────────────────────────

    async chat(messages, opts = {}) {
        const model = opts.model || this.defaultModel;
        if (!model) {
            throw new Error('No Ollama model available. Run: ollama pull gemma4');
        }

        const startTime = Date.now();
        this.stats.totalRequests++;
        this.stats.localRequests++;

        try {
            const res = await fetch(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    messages,
                    stream: opts.stream || false,
                    options: {
                        temperature: opts.temperature ?? 0.7,
                        top_p: opts.topP ?? 0.9,
                        num_predict: opts.maxTokens ?? 2048,
                        ...(opts.options || {}),
                    },
                }),
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Ollama error ${res.status}: ${errText}`);
            }

            // Streaming response
            if (opts.stream) {
                return this._handleStream(res, model, startTime, messages);
            }

            // Non-streaming
            const data = await res.json();
            const latency = Date.now() - startTime;
            this._recordLatency(latency);

            const result = {
                content: data.message?.content || '',
                model: data.model,
                totalDuration: data.total_duration,
                evalCount: data.eval_count || 0,
                provider: 'ollama-local',
                latencyMs: latency,
            };

            this.stats.tokensProcessed += result.evalCount;

            // Save SKILL
            this._saveSkill(messages, result.content, model);

            this.emit('chat:complete', { model, tokens: result.evalCount, latencyMs: latency });
            return result;
        } catch (err) {
            this.stats.errors++;
            this.emit('chat:error', { model, error: err.message });
            throw err;
        }
    }

    async *_handleStream(res, model, startTime, messages) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let totalTokens = 0;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(Boolean);

                for (const line of lines) {
                    try {
                        const data = JSON.parse(line);
                        if (data.message?.content) {
                            fullContent += data.message.content;
                            yield {
                                type: 'chunk',
                                content: data.message.content,
                                model: data.model,
                            };
                        }
                        if (data.done) {
                            totalTokens = data.eval_count || 0;
                        }
                    } catch { /* skip malformed */ }
                }
            }
        } finally {
            reader.releaseLock();
        }

        const latency = Date.now() - startTime;
        this._recordLatency(latency);
        this.stats.tokensProcessed += totalTokens;
        this._saveSkill(messages, fullContent, model);
        this.emit('chat:stream:complete', { model, tokens: totalTokens, latencyMs: latency });
    }

    // ── Quota-Aware Router ──────────────────────────────────

    /**
     * Intelligent routing: use cloud LLMs when quota available,
     * fall back to Ollama when exhausted.
     */
    shouldUseLocal(provider = 'anthropic') {
        const q = this.quotaTracker[provider];
        if (!q) return true;
        if (q.exhausted) return true;
        return !this.healthy ? false : false; // prefer cloud when available
    }

    recordCloudUsage(provider, tokens) {
        const q = this.quotaTracker[provider];
        if (!q) return;
        q.used += tokens;
        if (q.used >= q.limit) {
            q.exhausted = true;
            this.stats.fallbacksTriggered++;
            this.emit('quota:exhausted', { provider, used: q.used, limit: q.limit });
        }
        this.stats.cloudRequests++;
    }

    resetQuota(provider) {
        const q = this.quotaTracker[provider];
        if (q) { q.used = 0; q.exhausted = false; }
    }

    // ── SKILL Learning ──────────────────────────────────────

    _saveSkill(messages, response, model) {
        const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
        if (!lastUserMsg) return;

        try {
            SkillWriter.saveInteraction({
                userMsg: lastUserMsg.content,
                agentMsg: response,
                context: {
                    userId: 'ollama-local',
                    role: 'agent',
                    channel: 'ollama',
                    model,
                },
                provider: `ollama/${model}`,
            });
        } catch { /* non-critical */ }
    }

    // ── Model Management ────────────────────────────────────

    async pullModel(modelName) {
        this.emit('model:pulling', { model: modelName });
        try {
            const res = await fetch(`${this.baseUrl}/api/pull`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: modelName }),
            });
            if (!res.ok) throw new Error(`Pull failed: ${res.status}`);
            await this.checkHealth(); // refresh model list
            this.emit('model:pulled', { model: modelName });
            return { success: true, model: modelName };
        } catch (err) {
            this.emit('model:pull:error', { model: modelName, error: err.message });
            return { success: false, error: err.message };
        }
    }

    async warmUp() {
        if (!this.healthy) await this.checkHealth();
        if (!this.defaultModel) return;

        try {
            await this.chat([{ role: 'user', content: 'ping' }], {
                model: this.defaultModel,
                maxTokens: 10,
            });
            this.emit('warmup:complete', { model: this.defaultModel });
        } catch { /* non-critical */ }
    }

    // ── Stats ───────────────────────────────────────────────

    _recordLatency(ms) {
        this._latencies.push(ms);
        if (this._latencies.length > 100) this._latencies.shift();
        this.stats.avgLatencyMs = Math.round(
            this._latencies.reduce((a, b) => a + b, 0) / this._latencies.length
        );
    }

    getStats() {
        return {
            ...this.stats,
            healthy: this.healthy,
            modelsAvailable: this.models.length,
            defaultModel: this.defaultModel,
            quotas: { ...this.quotaTracker },
        };
    }
}

module.exports = OllamaGateway;
