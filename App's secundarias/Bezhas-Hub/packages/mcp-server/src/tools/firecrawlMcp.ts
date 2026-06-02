/**
 * SKILL: firecrawl_scraper
 * 
 * Web scraping and content extraction for BeZhas platform:
 * - Scrape product/service pages for marketplace intelligence
 * - Extract structured data from competitor sites
 * - Monitor Web3 project pages for partnership opportunities
 * - Content analysis for BEZ ecosystem expansion
 * 
 * @requires FIRECRAWL_API_KEY environment variable
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { config } from '../config.js';

export interface FirecrawlResult {
    action: string;
    url: string;
    status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
    data: Record<string, unknown>;
    reasoning: string;
}

export function registerFirecrawlMcp(server: McpServer): void {
    server.tool(
        'firecrawl_scraper',
        'Extrae contenido web estructurado para inteligencia de mercado: scraping de páginas, descubrimiento de productos/servicios, monitoreo de proyectos Web3 para el ecosistema BeZhas.',
        {
            action: z.enum([
                'scrape_page',
                'extract_products',
                'monitor_competitors',
                'discover_web3_projects',
            ]),
            url: z.string().url().describe('Target URL to scrape'),
            selectors: z.array(z.string()).optional().describe('CSS selectors to extract'),
            format: z.enum(['json', 'markdown', 'text']).optional().default('json'),
        },
        async ({ action, url, selectors, format }) => {
            try {
                const apiKey = config.integrations.firecrawlApiKey;
                if (!apiKey) {
                    return {
                        content: [{
                            type: 'text' as const,
                            text: JSON.stringify({
                                action, url, status: 'FAILED', data: {},
                                reasoning: 'FIRECRAWL_API_KEY not configured.',
                            }),
                        }],
                    };
                }

                const headers = {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                };
                const apiBase = 'https://api.firecrawl.dev/v1';

                let result: FirecrawlResult;

                switch (action) {
                    case 'scrape_page': {
                        const res = await fetch(`${apiBase}/scrape`, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({
                                url,
                                formats: [format === 'markdown' ? 'markdown' : 'html'],
                                onlyMainContent: true,
                            }),
                        });
                        const data = await res.json() as Record<string, unknown>;

                        result = {
                            action, url,
                            status: data.success ? 'SUCCESS' : 'FAILED',
                            data: {
                                title: (data.data as Record<string, unknown>)?.metadata
                                    ? ((data.data as Record<string, unknown>).metadata as Record<string, unknown>)?.title
                                    : 'Unknown',
                                content: (data.data as Record<string, unknown>)?.markdown || (data.data as Record<string, unknown>)?.html || '',
                                wordCount: String((data.data as Record<string, unknown>)?.markdown || '').split(/\s+/).length,
                            },
                            reasoning: data.success
                                ? `Successfully scraped page. Extracted main content.`
                                : `Scraping failed: ${data.error || 'Unknown error'}`,
                        };
                        break;
                    }

                    case 'extract_products': {
                        const res = await fetch(`${apiBase}/scrape`, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({
                                url,
                                formats: ['html'],
                                onlyMainContent: true,
                            }),
                        });
                        const data = await res.json() as Record<string, unknown>;
                        const html = String((data.data as Record<string, unknown>)?.html || '');

                        // Basic product extraction heuristic
                        const priceMatches = html.match(/\$[\d,.]+/g) || [];
                        const titleMatches = html.match(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi) || [];

                        result = {
                            action, url,
                            status: 'SUCCESS',
                            data: {
                                productsDetected: Math.max(priceMatches.length, titleMatches.length),
                                priceRange: priceMatches.length > 0
                                    ? { min: priceMatches[0], max: priceMatches[priceMatches.length - 1] }
                                    : null,
                                headings: titleMatches.slice(0, 10).map(t => t.replace(/<[^>]+>/g, '')),
                                bezIntegrationPotential: priceMatches.length > 0 ? 'HIGH' : 'LOW',
                            },
                            reasoning: `Extracted ${priceMatches.length} prices and ${titleMatches.length} product headings. BEZ integration potential: ${priceMatches.length > 0 ? 'HIGH' : 'LOW'}.`,
                        };
                        break;
                    }

                    case 'monitor_competitors': {
                        const res = await fetch(`${apiBase}/scrape`, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
                        });
                        const data = await res.json() as Record<string, unknown>;
                        const content = String((data.data as Record<string, unknown>)?.markdown || '');

                        const web3Keywords = ['blockchain', 'crypto', 'token', 'nft', 'dao', 'defi', 'web3', 'polygon', 'ethereum'];
                        const foundKeywords = web3Keywords.filter(kw => content.toLowerCase().includes(kw));

                        result = {
                            action, url,
                            status: 'SUCCESS',
                            data: {
                                contentLength: content.length,
                                web3Keywords: foundKeywords,
                                competitorScore: Math.min(100, foundKeywords.length * 15),
                                features: content.match(/(?:feature|benefit|advantage)[s]?:?\s*([^\n.]+)/gi)?.slice(0, 5) || [],
                            },
                            reasoning: `Competitor analysis complete. Found ${foundKeywords.length} Web3 keywords. Score: ${Math.min(100, foundKeywords.length * 15)}/100.`,
                        };
                        break;
                    }

                    case 'discover_web3_projects': {
                        const res = await fetch(`${apiBase}/scrape`, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
                        });
                        const data = await res.json() as Record<string, unknown>;
                        const content = String((data.data as Record<string, unknown>)?.markdown || '');

                        const addressMatches = content.match(/0x[a-fA-F0-9]{40}/g) || [];
                        const chainMentions = ['polygon', 'ethereum', 'bsc', 'arbitrum', 'optimism', 'avalanche']
                            .filter(c => content.toLowerCase().includes(c));

                        result = {
                            action, url,
                            status: 'SUCCESS',
                            data: {
                                contractsFound: [...new Set(addressMatches)].length,
                                contracts: [...new Set(addressMatches)].slice(0, 5),
                                chainsDetected: chainMentions,
                                partnershipPotential: chainMentions.includes('polygon') ? 'HIGH' : 'MEDIUM',
                                bezEcosystemFit: chainMentions.includes('polygon') ? 'EXCELLENT' : 'GOOD',
                            },
                            reasoning: `Discovered ${[...new Set(addressMatches)].length} unique contracts on ${chainMentions.length} chains. Polygon compatibility: ${chainMentions.includes('polygon') ? 'YES' : 'NO'}.`,
                        };
                        break;
                    }

                    default:
                        result = { action, url, status: 'FAILED', data: {}, reasoning: `Unknown action: ${action}` };
                }

                return {
                    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
                };
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : 'Unknown error';
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            action, url, status: 'FAILED', data: { error: msg },
                            reasoning: `Firecrawl error: ${msg}`,
                        }),
                    }],
                };
            }
        }
    );
}
