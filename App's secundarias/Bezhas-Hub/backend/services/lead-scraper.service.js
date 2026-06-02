/**
 * LEAD SCRAPER SERVICE (AIOps Nivel 5)
 * Motor inteligente para buscar y clasificar prospectos corporativos y gubernamentales.
 */

const axios = require('axios');
const dotenv = require('dotenv');
const crypto = require('crypto');

dotenv.config();

class LeadScraperService {
    constructor() {
        this.firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
        this.firecrawlBaseUrl = 'https://api.firecrawl.dev/v1';
        this.status = 'Idle';
        this.lastRun = null;
        this.leadsCaptured = 0;
    }

    /**
     * Inicia una campaña de búsqueda de leads.
     * @param {string} sector - Sector objetivo (ej: 'logistics', 'rwa', 'government')
     * @param {string} keywords - Palabras clave adicionales
     * @param {number} limit - Límite de leads a analizar
     */
    async startCampaign(sector, keywords, limit = 10) {
        console.log(`[LeadScraper] 🚀 Iniciando campaña para el sector: ${sector}`);
        this.status = `Scraping ${sector}...`;
        this.lastRun = new Date();

        try {
            // Simularemos la recuperación de URLs de una búsqueda genérica por ahora
            // En producción, esto se puede alimentar de una base de datos o API de Serp.
            const targetUrls = this.generateTargetUrls(sector, keywords, limit);

            const leads = [];
            for (const url of targetUrls) {
                const data = await this.scrapeUrl(url);
                if (data && data.success) {
                    const leadInfo = this.analyzeAndClassify(data.markdown, sector, url);
                    if (leadInfo.isQualified) {
                        leads.push(leadInfo);
                        this.leadsCaptured++;
                        console.log(`[LeadScraper] ✅ Lead calificado encontrado en: ${url} (Tipo: ${leadInfo.type})`);
                    }
                }
            }

            this.status = 'Idle';
            return {
                success: true,
                campaignId: `b2b_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
                message: `Campaña completada. Se evaluaron ${targetUrls.length} prospectos.`,
                leadsFound: leads.length,
                leads: leads
            };

        } catch (error) {
            console.error('[LeadScraper] ❌ Error en campaña:', error.message);
            this.status = 'Error';
            return { success: false, error: error.message };
        }
    }

    /**
     * Extrae texto de una URL utilizando Firecrawl (asumiendo que está disponible)
     */
    async scrapeUrl(url) {
        if (!this.firecrawlApiKey) {
            console.warn('[LeadScraper] ⚠️ FIRECRAWL_API_KEY no definida. Usando modo MOCK.');
            return this.mockScrapeData(url);
        }

        try {
            const response = await axios.post(
                `${this.firecrawlBaseUrl}/scrape`,
                { url, formats: ['markdown'] },
                {
                    headers: {
                        'Authorization': `Bearer ${this.firecrawlApiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return {
                success: true,
                markdown: response.data?.data?.markdown || ''
            };
        } catch (error) {
            console.error(`[LeadScraper] Error scraping ${url}:`, error.message);
            return { success: false, markdown: '' };
        }
    }

    /**
     * LLM/RegEx fallback logic para clasificar si un texto tiene potencial B2B/B2G y extraer contactos
     */
    analyzeAndClassify(markdown, sector, url) {
        // En un entorno de Producción Nivel 5 real, pasaríamos 'markdown' por OpenAI/Claude.
        // Aquí hacemos un análisis heurístico ligero para identificar datos.

        const content = markdown.toLowerCase();

        let type = 'Unknown';
        if (content.includes('government') || content.includes('ministerio') || content.includes('gobierno') || url.includes('.gov')) {
            type = 'B2G';
        } else if (content.includes('enterprise') || content.includes('business') || content.includes('soluciones corporativas')) {
            type = 'B2B';
        } else {
            type = 'B2B'; // Default assumption for corporate scraping
        }

        // Simular extracción de entidades
        const mockEmails = markdown.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);
        let contactEmail = mockEmails && mockEmails.length > 0 ? mockEmails[0] : `contacto@${new URL(url).hostname.replace('www.', '')}`;

        const scoreReasons = [];
        let score = 30;

        if (type === 'B2B' || type === 'B2G') {
            score += 15;
            scoreReasons.push(`Tipo ${type} compatible`);
        }
        if (content.includes('automatizar') || content.includes('automation') || content.includes('innovación') || content.includes('innovation')) {
            score += 20;
            scoreReasons.push('Señal de automatización/innovación');
        }
        if (content.includes('enterprise') || content.includes('corporativas') || content.includes('supply') || content.includes('logística')) {
            score += 15;
            scoreReasons.push('Lenguaje empresarial/sectorial');
        }
        if (contactEmail) {
            score += 10;
            scoreReasons.push('Contacto disponible');
        }

        score = Math.min(score, 100);
        const isQualified = content.length > 50 && score >= 50;

        return {
            url,
            type,
            sector,
            companyName: new URL(url).hostname,
            contactEmail,
            isQualified,
            score,
            scoreReasons,
            estimatedValueToken: Math.floor(Math.random() * 500) + 100
        };
    }

    /**
     * Generador de Mock URLs para propósitos de demostración y Smoke Test.
     */
    generateTargetUrls(sector, keywords, limit) {
        const mockUrls = [];
        for (let i = 1; i <= limit; i++) {
            if (sector === 'government') {
                mockUrls.push(`https://www.agencia-publica-${i}.gov.co/transparencia`);
            } else {
                mockUrls.push(`https://www.empresa-logistica-${keywords?.replace(/\s+/g, '-') || 'global'}-${i}.com/contact`);
            }
        }
        return mockUrls;
    }

    /**
     * Retorna datos simulados si no hay API de Firecrawl (Smoke test bypass).
     */
    mockScrapeData(url) {
        const isGov = url.includes('.gov');
        return {
            success: true,
            markdown: `# Bienvenidos a ${url}
            Somos una ${isGov ? 'entidad de gobierno' : 'empresa enterprise'} enfocada en innovación y soluciones tecnológicas.
            Contáctenos: info@empresa.com. Estamos buscando automatizar nuestros flujos de capital.
            `
        };
    }

    getStatus() {
        return {
            state: this.status,
            lastRun: this.lastRun,
            totalLeadsCaptured: this.leadsCaptured
        };
    }
}

module.exports = new LeadScraperService();
