/**
 * BEZHAS INTEGRATION ASSISTANT SDK MODULE
 * 
 * Consent-based widget that helps client sites discover BeZhas optimization
 * opportunities. Only activates after explicit user opt-in.
 * 
 * Replaces the former "TrojanAgent" which injected UI without consent.
 * 
 * Security:
 *  - No DOM scanning without opt-in
 *  - No auto-injection of widgets
 *  - All dynamic text uses textContent (no innerHTML with user data)
 *  - CSP-friendly: no inline styles injected, uses class-based styling
 *  - Requires valid API key for any backend calls
 */

class BeZhasIntegrationAssistant {
    constructor(config = {}) {
        if (!config.apiKey) {
            console.warn('[BeZhas SDK] API Key required for Integration Assistant.');
            return;
        }
        this.apiKey = config.apiKey;
        this.apiUrl = config.apiUrl || 'https://api.bezhas.com/v1';
        this.containerId = config.containerId || null;
        this.consentGiven = false;
        this.features = [];
    }

    /**
     * User must explicitly call this to opt in to the assistant.
     * Optionally pass a container element ID where the widget should render.
     * @param {string} [containerId] - DOM element ID to render into
     * @returns {BeZhasIntegrationAssistant}
     */
    activate(containerId) {
        this.consentGiven = true;
        this.containerId = containerId || this.containerId;

        if (!this.containerId) {
            console.error('[BeZhas SDK] containerId required. Pass a DOM element ID where the widget should render.');
            return this;
        }

        this._renderWidget();
        return this;
    }

    /**
     * Fetch available optimizations for this enterprise from the API.
     * Requires consent and valid API key.
     * @returns {Promise<Object>}
     */
    async analyzeOpportunities() {
        if (!this.consentGiven) {
            return { success: false, error: 'User consent required. Call activate() first.' };
        }

        try {
            const response = await fetch(`${this.apiUrl}/integrations/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    referrer: typeof window !== 'undefined' ? window.location.hostname : 'server',
                    timestamp: new Date().toISOString()
                })
            });

            if (!response.ok) {
                throw new Error(`API returned ${response.status}`);
            }

            const data = await response.json();
            this.features = data.features || [];
            this._updateWidget(data);
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Request a demo/pilot setup via the API.
     * @param {Object} contactInfo - { name, email, company, sector }
     * @returns {Promise<Object>}
     */
    async requestDemo(contactInfo) {
        if (!this.consentGiven) {
            return { success: false, error: 'User consent required.' };
        }
        if (!contactInfo?.email || !contactInfo?.company) {
            return { success: false, error: 'Email and company name required.' };
        }

        try {
            const response = await fetch(`${this.apiUrl}/integrations/request-demo`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    ...contactInfo,
                    timestamp: new Date().toISOString()
                })
            });

            if (!response.ok) {
                throw new Error(`API returned ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Render the widget into the designated container.
     * Uses textContent for all dynamic data to prevent XSS.
     */
    _renderWidget() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error(`[BeZhas SDK] Container #${this.containerId} not found.`);
            return;
        }

        // Clear any previous content
        container.innerHTML = '';

        // Build widget structure with safe DOM APIs
        const wrapper = document.createElement('div');
        wrapper.className = 'bezhas-assistant-widget';

        const title = document.createElement('h4');
        title.className = 'bezhas-assistant-title';
        title.textContent = 'BeZhas Integration Assistant';

        const desc = document.createElement('p');
        desc.className = 'bezhas-assistant-desc';
        desc.textContent = 'Discover how blockchain tokenization and automation can optimize your operations.';

        const analyzeBtn = document.createElement('button');
        analyzeBtn.className = 'bezhas-assistant-btn';
        analyzeBtn.textContent = 'Analyze My Platform';
        analyzeBtn.addEventListener('click', () => this.analyzeOpportunities());

        const resultArea = document.createElement('div');
        resultArea.className = 'bezhas-assistant-results';
        resultArea.id = 'bezhas-assistant-results';

        wrapper.appendChild(title);
        wrapper.appendChild(desc);
        wrapper.appendChild(analyzeBtn);
        wrapper.appendChild(resultArea);
        container.appendChild(wrapper);
    }

    /**
     * Update the results area with analysis data.
     * All dynamic content set via textContent (XSS-safe).
     * @param {Object} data
     */
    _updateWidget(data) {
        const resultArea = document.getElementById('bezhas-assistant-results');
        if (!resultArea) return;

        resultArea.innerHTML = '';

        if (data.features && data.features.length > 0) {
            const heading = document.createElement('h5');
            heading.textContent = 'Optimization Opportunities Found:';
            resultArea.appendChild(heading);

            const list = document.createElement('ul');
            for (const feature of data.features) {
                const item = document.createElement('li');
                const nameSpan = document.createElement('strong');
                nameSpan.textContent = feature.name || 'Unknown';
                const descSpan = document.createElement('span');
                descSpan.textContent = ` — ${feature.description || ''}`;
                item.appendChild(nameSpan);
                item.appendChild(descSpan);
                list.appendChild(item);
            }
            resultArea.appendChild(list);

            const demoBtn = document.createElement('button');
            demoBtn.className = 'bezhas-assistant-btn bezhas-assistant-btn-secondary';
            demoBtn.textContent = 'Request a Demo';
            demoBtn.addEventListener('click', () => {
                this._showDemoForm();
            });
            resultArea.appendChild(demoBtn);
        } else {
            const msg = document.createElement('p');
            msg.textContent = data.message || 'Analysis complete. Contact us for a custom assessment.';
            resultArea.appendChild(msg);
        }
    }

    /**
     * Show a simple contact form for requesting demos.
     */
    _showDemoForm() {
        const resultArea = document.getElementById('bezhas-assistant-results');
        if (!resultArea) return;

        resultArea.innerHTML = '';

        const form = document.createElement('form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const result = await this.requestDemo({
                name: formData.get('name'),
                email: formData.get('email'),
                company: formData.get('company'),
                sector: formData.get('sector')
            });

            resultArea.innerHTML = '';
            const msg = document.createElement('p');
            msg.textContent = result.success
                ? 'Demo request submitted! Our team will contact you within 24h.'
                : `Error: ${result.error}`;
            resultArea.appendChild(msg);
        });

        const fields = [
            { name: 'name', placeholder: 'Your Name', type: 'text', required: true },
            { name: 'email', placeholder: 'Email', type: 'email', required: true },
            { name: 'company', placeholder: 'Company', type: 'text', required: true },
            { name: 'sector', placeholder: 'Sector (e.g. Logistics, Finance)', type: 'text', required: false }
        ];

        for (const field of fields) {
            const input = document.createElement('input');
            input.name = field.name;
            input.type = field.type;
            input.placeholder = field.placeholder;
            input.required = field.required;
            input.className = 'bezhas-assistant-input';
            form.appendChild(input);
        }

        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.className = 'bezhas-assistant-btn';
        submitBtn.textContent = 'Submit Demo Request';
        form.appendChild(submitBtn);

        resultArea.appendChild(form);
    }

    /**
     * Deactivate and clean up the widget.
     */
    deactivate() {
        this.consentGiven = false;
        const container = document.getElementById(this.containerId);
        if (container) container.innerHTML = '';
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BeZhasIntegrationAssistant;
} else if (typeof window !== 'undefined') {
    window.BeZhasIntegrationAssistant = BeZhasIntegrationAssistant;
}
