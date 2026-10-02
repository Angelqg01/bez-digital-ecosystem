const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const MCP_BASE = process.env.MCP_SERVER_URL || 'http://localhost:8080';

/**
 * MCP Tool endpoints map
 */
const TOOL_ENDPOINTS = {
    analyze_gas_strategy: '/api/mcp/analyze-gas',
    calculate_smart_swap: '/api/mcp/calculate-swap',
    verify_regulatory_compliance: '/api/mcp/verify-compliance',
    github_repo_manager: '/api/mcp/github',
    firecrawl_scraper: '/api/mcp/firecrawl',
    playwright_automation: '/api/mcp/playwright',
    blockscout_explorer: '/api/mcp/blockscout',
    skill_creator_ai: '/api/mcp/skill-creator',
    auditmos_security: '/api/mcp/auditmos',
    tally_dao_governance: '/api/mcp/tally-dao',
    obliq_ai_sre: '/api/mcp/obliq-sre',
    kinaxis_supply_chain: '/api/mcp/kinaxis',
    alpaca_markets: '/api/mcp/alpaca-markets',
    // built-in pseudo-tools
    send_email: '__builtin_email',
    http_request: '__builtin_http',
    delay: '__builtin_delay',
    filter: '__builtin_filter',
    transform: '__builtin_transform',
};

/**
 * Execute a single MCP tool call
 */
async function executeMcpTool(toolId, params) {
    const endpoint = TOOL_ENDPOINTS[toolId];
    if (!endpoint) throw new Error(`Unknown tool: ${toolId}`);

    // Built-in tools
    if (endpoint === '__builtin_email') return executeEmail(params);
    if (endpoint === '__builtin_http') return executeHttp(params);
    if (endpoint === '__builtin_delay') return executeDelay(params);
    if (endpoint === '__builtin_filter') return executeFilter(params);
    if (endpoint === '__builtin_transform') return executeTransform(params);

    // MCP server call
    const url = `${MCP_BASE}${endpoint}`;
    const res = await axios.post(url, params, { timeout: 30000 });
    return res.data;
}

/**
 * Execute a full workflow
 * @param {Object} workflow - MongoDB workflow document
 * @param {Function} onStepComplete - Callback for real-time updates
 * @returns {Object} Run log
 */
async function executeWorkflow(workflow, onStepComplete) {
    const runId = uuidv4();
    const runLog = {
        runId,
        startedAt: new Date(),
        finishedAt: null,
        status: 'running',
        stepResults: [],
        triggeredBy: 'manual',
    };

    let previousOutput = {};

    for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        const stepStart = new Date();
        const stepResult = {
            stepIndex: i,
            toolId: step.toolId,
            startedAt: stepStart,
            finishedAt: null,
            input: null,
            output: null,
            error: null,
            status: 'success',
        };

        try {
            // Merge step params with previous output
            const mergedParams = {
                ...step.params,
                _previousOutput: previousOutput,
                _context: {
                    workflowId: workflow._id?.toString(),
                    runId,
                    stepIndex: i,
                },
            };

            // Check condition (optional JS expression)
            if (step.condition) {
                try {
                    const condFn = new Function('input', 'previous', `return ${step.condition}`);
                    const shouldRun = condFn(mergedParams, previousOutput);
                    if (!shouldRun) {
                        stepResult.status = 'skipped';
                        stepResult.finishedAt = new Date();
                        runLog.stepResults.push(stepResult);
                        if (onStepComplete) onStepComplete(stepResult);
                        continue;
                    }
                } catch (condErr) {
                    // If condition fails, run anyway
                    console.warn(`⚠️ Condition eval failed for step ${i}: ${condErr.message}`);
                }
            }

            stepResult.input = mergedParams;
            const output = await executeMcpTool(step.toolId, mergedParams);

            stepResult.output = output;
            stepResult.finishedAt = new Date();
            previousOutput = output;
        } catch (err) {
            stepResult.status = 'failed';
            stepResult.error = err.message;
            stepResult.finishedAt = new Date();
            runLog.status = 'failed';
            runLog.stepResults.push(stepResult);
            if (onStepComplete) onStepComplete(stepResult);
            break;
        }

        runLog.stepResults.push(stepResult);
        if (onStepComplete) onStepComplete(stepResult);
    }

    runLog.finishedAt = new Date();
    if (runLog.status === 'running') runLog.status = 'success';

    return runLog;
}

// ─── Built-in pseudo-tools ───

async function executeEmail(params) {
    // Using nodemailer or any email service
    const { to, subject, body, from } = params;
    if (!to || !subject) throw new Error('Email requires "to" and "subject"');

    // Try to use backend email service if available
    try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        const info = await transporter.sendMail({
            from: from || process.env.SMTP_USER || 'noreply@bezhas.com',
            to,
            subject,
            html: body || '',
        });

        return { success: true, messageId: info.messageId, to, subject };
    } catch (err) {
        return { success: false, error: err.message, simulated: true, to, subject };
    }
}

async function executeHttp(params) {
    const { url, method = 'GET', headers = {}, data } = params;
    if (!url) throw new Error('HTTP request requires "url"');
    const res = await axios({ url, method, headers, data, timeout: 15000 });
    return { status: res.status, data: res.data };
}

async function executeDelay(params) {
    const ms = params.milliseconds || params.ms || 1000;
    await new Promise(r => setTimeout(r, Math.min(ms, 30000)));
    return { delayed: ms };
}

async function executeFilter(params) {
    const { data, field, operator = 'eq', value } = params;
    if (!Array.isArray(data)) return { filtered: data };
    const ops = {
        eq: (a, b) => a === b,
        ne: (a, b) => a !== b,
        gt: (a, b) => a > b,
        lt: (a, b) => a < b,
        contains: (a, b) => String(a).includes(b),
    };
    const fn = ops[operator] || ops.eq;
    return { filtered: data.filter(item => fn(item[field], value)) };
}

async function executeTransform(params) {
    const { data, template } = params;
    if (!template) return data;
    // Simple Mustache-like replacement
    let result = template;
    if (data && typeof data === 'object') {
        for (const [k, v] of Object.entries(data)) {
            result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
        }
    }
    return { transformed: result };
}

module.exports = { executeWorkflow, executeMcpTool, TOOL_ENDPOINTS };
