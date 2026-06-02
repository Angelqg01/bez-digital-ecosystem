/**
 * BEZHAS COMMERCIAL API CLIENT
 * 
 * Server-side module for managing commercial operations:
 * - Lead tracking and pipeline management
 * - Proposal generation with real contract data
 * - Pilot onboarding automation
 * - Enterprise account provisioning
 * 
 * Designed to be called by OpenClaw skills or the control-center backend.
 * 
 * Security:
 *  - All operations require a valid admin JWT
 *  - Rate-limited per enterprise
 *  - Audit-logged via PostgreSQL
 */

const { ethers } = require('ethers');

class CommercialAPIClient {
    constructor(config = {}) {
        this.apiUrl = config.apiUrl || process.env.BEZHAS_API_URL || 'http://localhost:3001';
        this.adminToken = config.adminToken || null;
        this.headers = {
            'Content-Type': 'application/json'
        };
        if (this.adminToken) {
            this.headers['Authorization'] = `Bearer ${this.adminToken}`;
        }
    }

    /**
     * Set admin JWT after authentication
     * @param {string} token 
     */
    setToken(token) {
        this.adminToken = token;
        this.headers['Authorization'] = `Bearer ${token}`;
    }

    // ============================================
    // LEAD & PIPELINE MANAGEMENT
    // ============================================

    /**
     * Register a new lead in the system
     * @param {Object} lead - { company, contactName, contactEmail, contactRole, sector, source, notes }
     * @returns {Promise<Object>}
     */
    async createLead(lead) {
        if (!lead.company || !lead.contactEmail || !lead.sector) {
            return { success: false, error: 'company, contactEmail, and sector are required' };
        }
        return this._post('/api/commercial/leads', lead);
    }

    /**
     * Update lead status in pipeline
     * @param {string} leadId 
     * @param {string} status - prospecting | qualified | discovery | proposal | pilot | contract | lost
     * @param {string} notes 
     */
    async updateLeadStatus(leadId, status, notes) {
        const validStatuses = ['prospecting', 'qualified', 'discovery', 'proposal', 'pilot', 'contract', 'lost'];
        if (!validStatuses.includes(status)) {
            return { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` };
        }
        return this._patch(`/api/commercial/leads/${encodeURIComponent(leadId)}`, { status, notes });
    }

    /**
     * Get pipeline summary grouped by status
     * @returns {Promise<Object>}
     */
    async getPipelineSummary() {
        return this._get('/api/commercial/pipeline/summary');
    }

    /**
     * Get all leads filtered by sector
     * @param {string} sector 
     */
    async getLeadsBySector(sector) {
        return this._get(`/api/commercial/leads?sector=${encodeURIComponent(sector)}`);
    }

    // ============================================
    // SECTOR ANALYSIS
    // ============================================

    /**
     * Get all deployed contracts and capabilities for a specific sector.
     * Used by Solutions Engineer to scope integrations.
     * @param {string} sector 
     */
    async getSectorCapabilities(sector) {
        return this._get(`/api/contracts/${encodeURIComponent(sector)}`);
    }

    /**
     * Get all sectors with deployment status and contract counts
     */
    async listAllSectors() {
        return this._get('/api/sectors');
    }

    /**
     * Analyze a prospect's fit with BeZhas by sector
     * @param {Object} prospect - { sector, currentStack, transactionsPerDay, complianceRequirements, integrationPreference }
     * @returns {Promise<Object>} Fit analysis with recommended contracts and effort estimate
     */
    async analyzeProspectFit(prospect) {
        return this._post('/api/commercial/analyze-fit', prospect);
    }

    // ============================================
    // PROPOSAL GENERATION
    // ============================================

    /**
     * Generate a proposal document for a qualified lead
     * @param {string} leadId 
     * @param {Object} proposalConfig - { integrationPattern, contractsIncluded, pilotDurationWeeks, pricing }
     */
    async generateProposal(leadId, proposalConfig) {
        return this._post(`/api/commercial/leads/${encodeURIComponent(leadId)}/proposal`, proposalConfig);
    }

    // ============================================
    // PILOT MANAGEMENT
    // ============================================

    /**
     * Provision a pilot environment for a new enterprise client.
     * Creates: enterprise record, admin user, API key, gas tank deposit.
     * @param {Object} pilot - { leadId, enterpriseName, adminEmail, adminWallet, sector, gasBudgetBEZ }
     */
    async provisionPilot(pilot) {
        if (!pilot.enterpriseName || !pilot.adminEmail || !pilot.sector) {
            return { success: false, error: 'enterpriseName, adminEmail, and sector are required' };
        }
        return this._post('/api/commercial/pilots/provision', pilot);
    }

    /**
     * Get pilot status and usage metrics
     * @param {string} pilotId 
     */
    async getPilotStatus(pilotId) {
        return this._get(`/api/commercial/pilots/${encodeURIComponent(pilotId)}/status`);
    }

    /**
     * Convert pilot to annual contract
     * @param {string} pilotId 
     * @param {Object} contractTerms - { plan, annualPrice, gasAllocation, supportTier }
     */
    async convertPilotToContract(pilotId, contractTerms) {
        return this._post(`/api/commercial/pilots/${encodeURIComponent(pilotId)}/convert`, contractTerms);
    }

    // ============================================
    // GAS TANK (Enterprise pre-paid gas)
    // ============================================

    /**
     * Check gas tank balance for an enterprise
     * @param {string} enterpriseId 
     */
    async getGasTankBalance(enterpriseId) {
        return this._get(`/api/gas/status?enterprise=${encodeURIComponent(enterpriseId)}`);
    }

    // ============================================
    // ANALYTICS FOR COMMERCIAL
    // ============================================

    /**
     * Get platform-wide metrics for sales pitches
     */
    async getPlatformMetrics() {
        return this._get('/api/analytics/platform');
    }

    /**
     * Get enterprise-specific usage analytics (for pilot reviews)
     * @param {string} enterpriseId 
     */
    async getEnterpriseAnalytics(enterpriseId) {
        return this._get(`/api/analytics/enterprise/${encodeURIComponent(enterpriseId)}`);
    }

    // ============================================
    // INTERNAL HTTP HELPERS
    // ============================================

    async _get(path) {
        try {
            const response = await fetch(`${this.apiUrl}${path}`, {
                method: 'GET',
                headers: this.headers
            });
            if (!response.ok) throw new Error(`API ${response.status}: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async _post(path, body) {
        try {
            const response = await fetch(`${this.apiUrl}${path}`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(body)
            });
            if (!response.ok) throw new Error(`API ${response.status}: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async _patch(path, body) {
        try {
            const response = await fetch(`${this.apiUrl}${path}`, {
                method: 'PATCH',
                headers: this.headers,
                body: JSON.stringify(body)
            });
            if (!response.ok) throw new Error(`API ${response.status}: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = CommercialAPIClient;
