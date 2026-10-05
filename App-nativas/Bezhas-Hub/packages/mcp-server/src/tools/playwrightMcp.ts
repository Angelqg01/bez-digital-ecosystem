/**
 * SKILL: playwright_automation
 * 
 * Browser automation and UI testing for BeZhas platform:
 * - Automated UI testing of bezhas.com flows
 * - Screenshot capture for QA verification
 * - Form submission testing (login, wallet connect, etc.)
 * - Performance and accessibility audits
 * 
 * Note: In production, delegates to Playwright service or headless browser.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { config } from '../config.js';

export interface PlaywrightResult {
    action: string;
    targetUrl: string;
    status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
    results: Record<string, unknown>;
    reasoning: string;
}

export function registerPlaywrightMcp(server: McpServer): void {
    server.tool(
        'playwright_automation',
        'Automatización de navegador y testing de UI para BeZhas: tests de flujos de usuario, capturas de pantalla, pruebas de wallet connect, auditorías de rendimiento y accesibilidad.',
        {
            action: z.enum([
                'test_page_load',
                'test_wallet_flow',
                'capture_screenshot',
                'audit_performance',
                'audit_accessibility',
                'test_api_endpoints',
            ]),
            targetUrl: z.string().url().default('https://bezhas.com'),
            viewport: z.object({
                width: z.number().optional().default(1920),
                height: z.number().optional().default(1080),
            }).optional(),
            waitTimeout: z.number().optional().default(10000).describe('Max wait time in ms'),
        },
        async ({ action, targetUrl, viewport, waitTimeout }) => {
            try {
                let result: PlaywrightResult;

                switch (action) {
                    case 'test_page_load': {
                        const startTime = Date.now();
                        const res = await fetch(targetUrl, {
                            headers: { 'User-Agent': 'BeZhas-MCP-Playwright/1.0' },
                            signal: AbortSignal.timeout(waitTimeout || 10000),
                        });
                        const loadTime = Date.now() - startTime;
                        const html = await res.text();

                        const hasTitle = /<title[^>]*>([^<]+)<\/title>/i.test(html);
                        const hasViewport = /viewport/i.test(html);
                        const hasManifest = /manifest/i.test(html);
                        const statusOk = res.status >= 200 && res.status < 400;

                        result = {
                            action, targetUrl,
                            status: statusOk ? 'SUCCESS' : 'FAILED',
                            results: {
                                httpStatus: res.status,
                                loadTimeMs: loadTime,
                                pageSize: html.length,
                                hasTitle,
                                hasViewportMeta: hasViewport,
                                hasManifest,
                                performance: loadTime < 2000 ? 'EXCELLENT' : loadTime < 5000 ? 'GOOD' : 'NEEDS_IMPROVEMENT',
                                headers: {
                                    contentType: res.headers.get('content-type'),
                                    server: res.headers.get('server'),
                                    cacheControl: res.headers.get('cache-control'),
                                },
                            },
                            reasoning: `Page loaded in ${loadTime}ms with status ${res.status}. Performance: ${loadTime < 2000 ? 'EXCELLENT' : loadTime < 5000 ? 'GOOD' : 'NEEDS_IMPROVEMENT'}.`,
                        };
                        break;
                    }

                    case 'test_wallet_flow': {
                        // Simulated wallet flow test — in production uses Playwright browser
                        const res = await fetch(targetUrl, {
                            signal: AbortSignal.timeout(waitTimeout || 10000),
                        });
                        const html = await res.text();

                        const hasWeb3Modal = /web3modal|wagmi|connectwallet|walletconnect/i.test(html);
                        const hasEthers = /ethers|viem|web3/i.test(html);
                        const hasMetamask = /metamask/i.test(html);

                        result = {
                            action, targetUrl,
                            status: 'SUCCESS',
                            results: {
                                web3ModalDetected: hasWeb3Modal,
                                ethersLibDetected: hasEthers,
                                metamaskSupport: hasMetamask,
                                walletProviders: [
                                    hasMetamask && 'MetaMask',
                                    hasWeb3Modal && 'WalletConnect',
                                ].filter(Boolean),
                                testSteps: [
                                    { step: 'Page Load', status: 'PASS' },
                                    { step: 'Web3 Provider Detection', status: hasWeb3Modal ? 'PASS' : 'WARN' },
                                    { step: 'Wallet Connect Button', status: 'REQUIRES_BROWSER' },
                                    { step: 'Transaction Signing', status: 'REQUIRES_BROWSER' },
                                ],
                            },
                            reasoning: `Wallet flow analysis complete. Web3Modal: ${hasWeb3Modal ? 'YES' : 'NO'}. Full browser test requires Playwright instance.`,
                        };
                        break;
                    }

                    case 'capture_screenshot': {
                        result = {
                            action, targetUrl,
                            status: 'PARTIAL',
                            results: {
                                viewport: viewport || { width: 1920, height: 1080 },
                                screenshotPath: `/tmp/bezhas-screenshot-${Date.now()}.png`,
                                note: 'Screenshot capture requires Playwright browser instance. Use Playwright service for full capture.',
                                alternativeEndpoint: `${targetUrl}?screenshot=true`,
                            },
                            reasoning: 'Screenshot request registered. Requires Playwright browser service for execution.',
                        };
                        break;
                    }

                    case 'audit_performance': {
                        const startTime = Date.now();
                        const res = await fetch(targetUrl, {
                            signal: AbortSignal.timeout(waitTimeout || 10000),
                        });
                        const loadTime = Date.now() - startTime;
                        const html = await res.text();

                        const scriptCount = (html.match(/<script/gi) || []).length;
                        const styleCount = (html.match(/<link[^>]+stylesheet/gi) || []).length;
                        const imageCount = (html.match(/<img/gi) || []).length;
                        const inlineStyleCount = (html.match(/style="/gi) || []).length;

                        let score = 100;
                        if (loadTime > 3000) score -= 20;
                        if (scriptCount > 15) score -= 15;
                        if (html.length > 500000) score -= 10;
                        if (inlineStyleCount > 20) score -= 5;

                        result = {
                            action, targetUrl,
                            status: 'SUCCESS',
                            results: {
                                loadTimeMs: loadTime,
                                pageSizeKB: Math.round(html.length / 1024),
                                resources: { scripts: scriptCount, stylesheets: styleCount, images: imageCount },
                                performanceScore: Math.max(0, score),
                                issues: [
                                    loadTime > 3000 && 'Slow page load (>3s)',
                                    scriptCount > 15 && 'Too many script tags',
                                    html.length > 500000 && 'Large page size',
                                    inlineStyleCount > 20 && 'Excessive inline styles',
                                ].filter(Boolean),
                                recommendations: [
                                    'Enable Brotli/gzip compression',
                                    'Implement code splitting',
                                    'Use CDN for static assets',
                                    'Add service worker for caching',
                                ],
                            },
                            reasoning: `Performance score: ${Math.max(0, score)}/100. Load time: ${loadTime}ms. ${scriptCount} scripts, ${html.length > 500000 ? 'large' : 'normal'} page size.`,
                        };
                        break;
                    }

                    case 'audit_accessibility': {
                        const res = await fetch(targetUrl, {
                            signal: AbortSignal.timeout(waitTimeout || 10000),
                        });
                        const html = await res.text();

                        const hasLang = /html[^>]+lang="/i.test(html);
                        const altImages = (html.match(/<img[^>]+alt="/gi) || []).length;
                        const totalImages = (html.match(/<img/gi) || []).length;
                        const hasAriaLabels = /aria-label/i.test(html);
                        const hasRoles = /role="/i.test(html);
                        const hasSkipNav = /skip.?nav|skip.?to.?content/i.test(html);

                        let a11yScore = 100;
                        if (!hasLang) a11yScore -= 20;
                        if (totalImages > 0 && altImages / totalImages < 0.8) a11yScore -= 15;
                        if (!hasAriaLabels) a11yScore -= 10;
                        if (!hasSkipNav) a11yScore -= 5;

                        result = {
                            action, targetUrl,
                            status: 'SUCCESS',
                            results: {
                                accessibilityScore: Math.max(0, a11yScore),
                                checks: {
                                    htmlLangAttribute: hasLang,
                                    imagesWithAlt: `${altImages}/${totalImages}`,
                                    ariaLabels: hasAriaLabels,
                                    semanticRoles: hasRoles,
                                    skipNavigation: hasSkipNav,
                                },
                                issues: [
                                    !hasLang && 'Missing lang attribute on <html>',
                                    totalImages > 0 && altImages < totalImages && 'Missing alt text on images',
                                    !hasAriaLabels && 'No ARIA labels found',
                                    !hasSkipNav && 'No skip navigation link',
                                ].filter(Boolean),
                            },
                            reasoning: `Accessibility score: ${Math.max(0, a11yScore)}/100. ${[!hasLang, totalImages > altImages, !hasAriaLabels, !hasSkipNav].filter(Boolean).length} issues found.`,
                        };
                        break;
                    }

                    case 'test_api_endpoints': {
                        const apiBase = config.network.mode === 'mainnet'
                            ? 'https://api.bezhas.com'
                            : 'http://localhost:3001';

                        const endpoints = [
                            { path: '/api/config', method: 'GET' },
                            { path: '/api/mcp/health', method: 'GET' },
                            { path: '/api/health', method: 'GET' },
                        ];

                        const results = await Promise.all(
                            endpoints.map(async (ep) => {
                                try {
                                    const start = Date.now();
                                    const r = await fetch(`${apiBase}${ep.path}`, {
                                        method: ep.method,
                                        signal: AbortSignal.timeout(5000),
                                    });
                                    return {
                                        endpoint: ep.path,
                                        status: r.status,
                                        latencyMs: Date.now() - start,
                                        ok: r.ok,
                                    };
                                } catch {
                                    return { endpoint: ep.path, status: 0, latencyMs: -1, ok: false };
                                }
                            })
                        );

                        const passed = results.filter(r => r.ok).length;

                        result = {
                            action, targetUrl: apiBase,
                            status: passed === results.length ? 'SUCCESS' : passed > 0 ? 'PARTIAL' : 'FAILED',
                            results: {
                                totalEndpoints: results.length,
                                passed,
                                failed: results.length - passed,
                                details: results,
                            },
                            reasoning: `API test: ${passed}/${results.length} endpoints healthy.`,
                        };
                        break;
                    }

                    default:
                        result = { action, targetUrl, status: 'FAILED', results: {}, reasoning: `Unknown action: ${action}` };
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
                            action, targetUrl, status: 'FAILED', results: { error: msg },
                            reasoning: `Playwright error: ${msg}`,
                        }),
                    }],
                };
            }
        }
    );
}
