/**
 * BEZHAS TROJAN SDK MODULE (AIOps Nivel 5)
 * Agente en frontend que se infiltra (vía CDN/Snippet) en ecosistemas cliente para
 * auditar necesidades, sugerir optimizaciones in-app e incentivar pagos B2B nativos.
 */

class BezhasTrojan {
    constructor(config = {}) {
        this.apiKey = config.apiKey || null;
        this.apiUrl = config.apiUrl || 'https://api.bezhas.com/v1';
        this.domain = window.location.hostname;

        console.log(`[BeZhas SDK] 🛡️ Trojan Agent Initialized on ${this.domain}`);
        this.init();
    }

    /**
     * 1. Inicialización y Escaneo
     */
    async init() {
        if (!this.apiKey) {
            console.warn('[BeZhas SDK] ⚠️ API Key missing. Running in limited audit mode.');
        }

        // Retrasar el escaneo para no afectar la carga inicial del cliente
        setTimeout(() => {
            this.auditClientEnvironment();
        }, 3000);
    }

    /**
     * 2. Escaneo del entorno del cliente (Detectando oportunidades)
     */
    auditClientEnvironment() {
        console.log('[BeZhas SDK] 🕵️‍♂️ Auditing environment looking for optimization targets...');

        let foundTargets = [];

        // Detectar pasarelas de pago anticuadas
        if (document.querySelector('form[action*="paypal"], form[action*="stripe"]')) {
            foundTargets.push('legacy_payments');
        }

        // Detectar carritos de compras
        if (document.querySelector('.cart, #shopping-cart, [data-cart]')) {
            foundTargets.push('ecommerce');
        }

        // Detectar formularios logísticos
        if (document.querySelector('input[name*="shipping"], input[name*="tracking"]')) {
            foundTargets.push('logistics');
        }

        if (foundTargets.length > 0) {
            console.log(`[BeZhas SDK] 🎯 Targets identified: ${foundTargets.join(', ')}`);
            this.suggestOptimizations(foundTargets);
        } else {
            console.log('[BeZhas SDK] ℹ️ Non-transactional site detected.');
            // Default popup suggestion anyway if it's B2B
            this.suggestOptimizations(['enterprise_automation']);
        }
    }

    /**
     * 3. Experiencia In-App (El Widget / Iframe)
     */
    suggestOptimizations(targets) {
        // En un entorno de Producción Nivel 5, llamamos al backend para ver 
        // si este dominio tiene "Aprobación de Crédito" para el "Pitch Automático".

        let message = `Optimice su plataforma con Blockchain.`;
        if (targets.includes('legacy_payments')) {
            message = `¡Actualice sus pagos! Reciba transferencias cripto y reduzca fees un 80% usando BeZhas.`;
        } else if (targets.includes('logistics')) {
            message = `Tokenice el rastreo de sus paquetes mediante BeZhas Logistics Cloud.`;
        }

        this.injectWidget(message);
    }

    injectWidget(message) {
        if (document.getElementById('bezhas-trojan-widget')) return;

        // Container
        const container = document.createElement('div');
        container.id = 'bezhas-trojan-widget';
        Object.assign(container.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '320px',
            backgroundColor: '#ffffff',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            borderRadius: '12px',
            padding: '20px',
            zIndex: '999999',
            fontFamily: 'Inter, system-ui, sans-serif',
            transition: 'all 0.3s ease-in-out',
            border: '1px solid #e5e7eb',
            transform: 'translateY(150%)'
        });

        // Header
        const header = document.createElement('div');
        header.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h4 style="margin:0; font-size: 14px; font-weight: 600; color: #111827;">BeZhas AI Web3</h4>
                <button id="bezhas-trojan-close" style="background:none; border:none; cursor:pointer; font-size: 16px; color:#6b7280;">&times;</button>
            </div>
        `;

        // Body
        const body = document.createElement('div');
        body.innerHTML = `
            <p style="font-size: 13px; color: #4b5563; margin: 0 0 15px 0;">${message}</p>
            <div style="background: #f3f4f6; padding: 10px; border-radius: 8px; margin-bottom: 15px;">
                <span style="font-size: 11px; font-weight: 600; color: #374151;">CRÉDITO DISPONIBLE</span>
                <div style="font-size: 18px; font-weight: 700; color: #8b5cf6;">100 BEZ</div>
            </div>
            <button id="bezhas-trojan-action" style="
                width: 100%; 
                padding: 10px; 
                background-color: #8b5cf6; 
                color: white; 
                border: none; 
                border-radius: 6px; 
                font-size: 13px; 
                font-weight: 600; 
                cursor: pointer;
                transition: background 0.2s;
            ">Activar Automatización in-App</button>
        `;

        container.appendChild(header);
        container.appendChild(body);
        document.body.appendChild(container);

        // Animate In
        setTimeout(() => {
            container.style.transform = 'translateY(0)';
        }, 100);

        // Events
        document.getElementById('bezhas-trojan-close').onclick = () => {
            container.style.transform = 'translateY(150%)';
            setTimeout(() => container.remove(), 300);
        };

        document.getElementById('bezhas-trojan-action').onclick = () => {
            this.executeInAppBilling();
        };
    }

    /**
     * 4. Facturación Tokenizada In-App
     */
    executeInAppBilling() {
        // Redirige o inyecta el Iframe para la autenticación y facturación
        const btn = document.getElementById('bezhas-trojan-action');
        btn.innerHTML = 'Procesando...';
        btn.style.backgroundColor = '#6d28d9';

        setTimeout(() => {
            alert('¡Integración Completada! Se ha deducido -10 BEZ-Coin de su crédito por la activación del servicio logístico autónomo.');
            btn.innerHTML = '✓ Servicio Activo';
            btn.style.backgroundColor = '#10b981';
        }, 1500);
    }
}

// Export for SDK bundler
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BezhasTrojan;
} else {
    window.BeZhasTrojan = BezhasTrojan;
}
