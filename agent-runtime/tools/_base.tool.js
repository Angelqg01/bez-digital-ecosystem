/**
 * _base.tool.js — Base class for all runtime tools.
 * Every tool must extend BaseTool and implement execute().
 */
const Ajv = require('ajv');
const ajv = new Ajv({ allErrors: true, coerceTypes: true });

class BaseTool {
    /** @type {string} Unique tool name, e.g. "bridge-health" */
    name = '';
    /** @type {string} Human-readable description */
    description = '';
    /** @type {string[]} Required permissions, e.g. ["runtime:read", "bridge:status"] */
    permissions = [];
    /** @type {object} JSON Schema for input parameters */
    inputSchema = { type: 'object', properties: {} };
    /** @type {object} JSON Schema for output */
    outputSchema = { type: 'object', properties: {} };
    /** @type {string|null} Owning sector (null = global) */
    sector = null;
    /** @type {number} Timeout in milliseconds */
    timeoutMs = 15000;

    constructor(opts = {}) {
        Object.assign(this, opts);
        if (!this.name) throw new Error('Tool must have a name');
        this._validateInput = ajv.compile(this.inputSchema);
    }

    /**
     * Validate input params against the tool's inputSchema.
     * @param {object} params
     * @returns {{ valid: boolean, errors: string[]|null }}
     */
    validateInput(params) {
        const valid = this._validateInput(params || {});
        return {
            valid,
            errors: valid ? null : this._validateInput.errors.map(e => `${e.instancePath || '/'} ${e.message}`),
        };
    }

    /**
     * Execute the tool. Must be overridden by subclasses.
     * @param {object} params  — Validated parameters
     * @param {object} context — { user, session, permissions, abortSignal }
     * @returns {Promise<{ success: boolean, data: any, meta?: object }>}
     */
    async execute(params, context) {
        throw new Error(`Tool "${this.name}": execute() not implemented`);
    }

    /**
     * Return a JSON-serializable descriptor for the tool registry.
     */
    toDescriptor() {
        return {
            name: this.name,
            description: this.description,
            permissions: this.permissions,
            sector: this.sector,
            timeoutMs: this.timeoutMs,
            inputSchema: this.inputSchema,
            outputSchema: this.outputSchema,
        };
    }
}

module.exports = BaseTool;
