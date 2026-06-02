/**
 * SkillWriter.js — Persists BeZhas agent interactions as SKILL files.
 *
 * Each interaction (user message + agent response) is saved as a SKILL JSON file
 * in the SKILL/interactions/ directory. This builds the agent's knowledge base
 * progressively and allows future fine-tuning / RAG retrieval.
 *
 * SKILL format:
 * {
 *   "id": "skill_<timestamp>_<userId_hash>",
 *   "created_at": "<ISO>",
 *   "channel": "telegram|discord|api",
 *   "intent": "<detected intent or 'general'>",
 *   "tags": ["gas", "blockchain", "defi", ...],
 *   "provider": "gemini|bezhas-local",
 *   "turn": { "user": "...", "agent": "..." },
 *   "context": { "userId": "...", "role": "..." }
 * }
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

// Skills are stored next to the main SKILL directory at the project root
const SKILL_DIR = path.resolve(__dirname, '../../SKILL/interactions');

// Ensure the directory exists
function ensureDir() {
    if (!fs.existsSync(SKILL_DIR)) {
        fs.mkdirSync(SKILL_DIR, { recursive: true });
    }
}

/**
 * Detect topic tags from the conversation turn.
 * @param {string} userMsg
 * @param {string} agentMsg
 * @returns {string[]}
 */
function detectTags(userMsg, agentMsg) {
    const combined = (userMsg + ' ' + agentMsg).toLowerCase();
    const tagMap = {
        gas:        /\bgas\b|comisi[oó]n|fee|gwei/,
        defi:       /swap|liquidity|pool|staking|yield|apy/,
        nft:        /\bnft\b|token|erc-?721|erc-?1155/,
        fraud:      /fraude|fraud|anomal|riesgo|risk/,
        validator:  /validador|validator/,
        bridge:     /bridge|puente|l2|polygon/,
        governance: /dao|gobernanza|propos|vot/,
        rwa:        /rwa|activo real|inmobiliario|real.?asset/,
        blockchain: /blockchain|contrato|contract|deploy|smart.?contract/,
        sector:     /logística|health|energía|sector|industria/,
        help:       /ayuda|help|comando|instrucción/,
    };

    return Object.entries(tagMap)
        .filter(([, rx]) => rx.test(combined))
        .map(([tag]) => tag);
}

/**
 * Detect the primary intent label.
 * @param {string} userMsg
 * @returns {string}
 */
function detectIntent(userMsg) {
    const lower = userMsg.toLowerCase();
    if (/\//.test(lower) && lower.startsWith('/')) return 'command';
    if (/gas|fee|comisi/.test(lower)) return 'gas_analysis';
    if (/fraude|anomal|riesgo/.test(lower)) return 'fraud_detection';
    if (/sentimiento|sentiment/.test(lower)) return 'sentiment_analysis';
    if (/status|estado|salud/.test(lower)) return 'platform_status';
    if (/swap|intercambio/.test(lower)) return 'defi_swap';
    if (/sector|industria/.test(lower)) return 'sector_query';
    if (/validador|validator/.test(lower)) return 'validator_status';
    if (/bridge|puente/.test(lower)) return 'bridge_health';
    if (/dao|propos|gobernanza/.test(lower)) return 'governance';
    if (/rwa|activo/.test(lower)) return 'rwa_management';
    if (/ayuda|help/.test(lower)) return 'help';
    return 'general_conversation';
}

/**
 * Save an interaction as a SKILL file.
 *
 * @param {{ userMsg: string, agentMsg: string, context: object, provider: string }} params
 * @returns {string} - SKILL file path
 */
function saveInteraction({ userMsg, agentMsg, context, provider }) {
    try {
        ensureDir();

        const ts      = Date.now();
        const userHash = crypto.createHash('md5').update(context.userId || 'anon').digest('hex').slice(0, 6);
        const id       = `skill_${ts}_${userHash}`;

        const skill = {
            id,
            created_at: new Date().toISOString(),
            channel:    context.channel || 'unknown',
            provider:   provider || 'unknown',
            intent:     detectIntent(userMsg),
            tags:       detectTags(userMsg, agentMsg),
            turn: {
                user:  userMsg.slice(0, 1000),
                agent: agentMsg.slice(0, 2000),
            },
            context: {
                userId: context.userId,
                role:   context.role || 'unknown',
            },
        };

        const filePath = path.join(SKILL_DIR, `${id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(skill, null, 2), 'utf8');

        // Also append a one-liner to the interaction index for fast lookup
        const indexPath = path.join(SKILL_DIR, 'index.jsonl');
        const indexLine = JSON.stringify({
            id,
            created_at: skill.created_at,
            intent:     skill.intent,
            tags:       skill.tags,
            channel:    skill.channel,
            provider:   skill.provider,
        }) + '\n';
        fs.appendFileSync(indexPath, indexLine, 'utf8');

        return filePath;
    } catch (err) {
        // SKILL saving is non-critical — never crash the agent
        console.warn('[SkillWriter] Could not save skill:', err.message);
        return null;
    }
}

/**
 * List recent SKILLs (last N entries from the index).
 * @param {number} [limit=20]
 * @returns {{ id: string, intent: string, tags: string[], created_at: string }[]}
 */
function listRecent(limit = 20) {
    try {
        const indexPath = path.join(SKILL_DIR, 'index.jsonl');
        if (!fs.existsSync(indexPath)) return [];
        const lines = fs.readFileSync(indexPath, 'utf8').trim().split('\n').filter(Boolean);
        return lines.slice(-limit).map(l => JSON.parse(l)).reverse();
    } catch {
        return [];
    }
}

module.exports = { saveInteraction, listRecent, SKILL_DIR };
