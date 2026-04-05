import React from 'react';
import { Package as PackageIcon, Code as CodeIcon, Check as CheckIcon, Download as DownloadIcon, ExternalLink as ExternalLinkIcon, Plug as PlugIcon, Terminal as TerminalIcon } from 'lucide-react';

/**
 * McpSdkDownloadTab - Download section for BEZHAS-MCP and BeZhas SDK
 * 
 * BEZHAS-MCP operates through BeZhas SDK.
 * Customers can download both installers from here.
 */
const McpSdkDownloadTab = () => {
    const SDK_VERSION = '1.0.0';
    const MCP_VERSION = '1.0.0';

    const mcpTools = [
        { name: 'Polygon Gas MCP', category: 'Blockchain', desc: 'Gas optimization & relayer logic' },
        { name: 'Balance Swap MCP', category: 'Blockchain', desc: 'BEZ↔FIAT smart swaps' },
        { name: 'Compliance MCP', category: 'Compliance', desc: 'AML/KYC risk scoring' },
        { name: 'GitHub MCP', category: 'DevOps', desc: 'Repo management & auto-docs' },
        { name: 'Firecrawl MCP', category: 'Intelligence', desc: 'Web scraping & discovery' },
        { name: 'Playwright MCP', category: 'Testing', desc: 'Browser automation & UI tests' },
        { name: 'Blockscout MCP', category: 'Blockchain', desc: 'On-chain BEZ explorer' },
        { name: 'Skill Creator AI', category: 'AI', desc: 'Custom workflow generator' },
        { name: 'Auditmos Security', category: 'Security', desc: 'Smart contract auditing' },
        { name: 'Tally DAO MCP', category: 'Governance', desc: 'DAO proposals & voting' },
        { name: 'Obliq AI SRE', category: 'SRE', desc: 'Site reliability & monitoring' },
        { name: 'Kinaxis IoT MCP', category: 'IoT', desc: 'Supply chain & telemetry' },
        { name: 'Alpaca Markets MCP', category: 'Trading', desc: 'Treasury & market analysis' },
    ];

    return (
        <div className="space-y-8">
            {/* Hero Section */}
            <div className="bg-gradient-to-br from-purple-900/40 via-gray-900 to-blue-900/40 border border-purple-500/30 rounded-2xl p-8">
                <div className="flex items-center gap-4 mb-4">
                    <div className="p-4 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl">
                        <PlugIcon className="w-10 h-10 text-white" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold text-white">BEZHAS-MCP & BeZhas SDK</h2>
                        <p className="text-gray-400 mt-1">Herramientas de inteligencia para desarrolladores del ecosistema BeZhas</p>
                    </div>
                </div>

                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 mt-4">
                    <div className="flex items-start gap-3">
                        <PackageIcon className="text-purple-400 mt-0.5 flex-shrink-0 w-5 h-5" />
                        <div>
                            <p className="text-purple-300 font-semibold text-sm">⚡ BEZHAS-MCP actúa a través del BeZhas SDK</p>
                            <p className="text-gray-400 text-sm mt-1">
                                El paquete MCP Intelligence requiere el BeZhas SDK como base. Instala primero el SDK y luego activa el módulo MCP para acceder a las 13 herramientas de inteligencia.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Download Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* BeZhas SDK Card */}
                <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-6 hover:border-purple-500/50 transition-all">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-purple-600/20 rounded-xl">
                            <CodeIcon className="text-purple-400 w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">BeZhas SDK</h3>
                            <span className="text-xs text-gray-400 bg-gray-700/50 px-2 py-0.5 rounded-full">v{SDK_VERSION}</span>
                        </div>
                    </div>

                    <p className="text-gray-300 text-sm mb-4">
                        SDK base para integración con la plataforma BeZhas. Incluye autenticación wallet, API client, gestión de API Keys y módulos de extensión.
                    </p>

                    <ul className="text-sm text-gray-400 space-y-2 mb-6">
                        <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-green-400" /> Autenticación Web3 (Wagmi/Viem)</li>
                        <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-green-400" /> API Client configurado</li>
                        <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-green-400" /> Gestión de API Keys</li>
                        <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-green-400" /> TypeScript / JavaScript</li>
                        <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-green-400" /> Compatible Node.js & Browser</li>
                    </ul>

                    <div className="space-y-3">
                        <div className="bg-gray-900/60 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">Instalación via npm:</p>
                            <code className="text-sm text-green-400 font-mono">npm install @bezhas/sdk</code>
                        </div>
                        <div className="bg-gray-900/60 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">Instalación via pnpm:</p>
                            <code className="text-sm text-green-400 font-mono">pnpm add @bezhas/sdk</code>
                        </div>
                        <a
                            href={`${import.meta.env.VITE_API_URL || ''}/api/downloads/bezhas-sdk.tgz`}
                            className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-purple-800 transition-all flex items-center justify-center gap-2"
                        >
                            <DownloadIcon className="w-5 h-5" />
                            Descargar BeZhas SDK v{SDK_VERSION}
                            <ExternalLinkIcon className="w-4 h-4" />
                        </a>
                    </div>
                </div>

                {/* BEZHAS-MCP Card */}
                <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-6 hover:border-blue-500/50 transition-all">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-blue-600/20 rounded-xl">
                            <PlugIcon className="text-blue-400 w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">BEZHAS-MCP</h3>
                            <span className="text-xs text-gray-400 bg-gray-700/50 px-2 py-0.5 rounded-full">v{MCP_VERSION}</span>
                        </div>
                    </div>

                    <p className="text-gray-300 text-sm mb-4">
                        Módulo MCP Intelligence con 13 herramientas de IA, blockchain, seguridad, trading y más. Requiere BeZhas SDK como dependencia.
                    </p>

                    <ul className="text-sm text-gray-400 space-y-2 mb-6">
                        <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-blue-400" /> 13 MCP Tools incluidos</li>
                        <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-blue-400" /> Blockchain (Gas, Swap, Blockscout)</li>
                        <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-blue-400" /> AI & Security (Auditmos, Skill Creator)</li>
                        <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-blue-400" /> IoT & Supply Chain (Kinaxis)</li>
                        <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-blue-400" /> Trading & Governance (Alpaca, Tally)</li>
                    </ul>

                    <div className="space-y-3">
                        <div className="bg-gray-900/60 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">Instalación via npm:</p>
                            <code className="text-sm text-blue-400 font-mono">npm install @bezhas/mcp</code>
                        </div>
                        <div className="bg-gray-900/60 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">Instalación via pnpm:</p>
                            <code className="text-sm text-blue-400 font-mono">pnpm add @bezhas/mcp</code>
                        </div>
                        <a
                            href={`${import.meta.env.VITE_API_URL || ''}/api/downloads/bezhas-mcp.tgz`}
                            className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all flex items-center justify-center gap-2"
                        >
                            <DownloadIcon className="w-5 h-5" />
                            Descargar BEZHAS-MCP v{MCP_VERSION}
                            <ExternalLinkIcon className="w-4 h-4" />
                        </a>
                    </div>
                </div>
            </div>

            {/* Quick Start */}
            <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <TerminalIcon className="w-5 h-5 text-purple-400" />
                    Quick Start
                </h3>
                <div className="bg-gray-900 rounded-xl p-4 font-mono text-sm overflow-x-auto">
                    <p className="text-gray-500"># 1. Instalar BeZhas SDK</p>
                    <p className="text-green-400">npm install @bezhas/sdk</p>
                    <br />
                    <p className="text-gray-500"># 2. Instalar módulo MCP Intelligence</p>
                    <p className="text-blue-400">npm install @bezhas/mcp</p>
                    <br />
                    <p className="text-gray-500"># 3. Configurar en tu proyecto</p>
                    <p className="text-yellow-300">{'import { BezhasSDK } from "@bezhas/sdk";'}</p>
                    <p className="text-yellow-300">{'import { McpIntelligence } from "@bezhas/mcp";'}</p>
                    <br />
                    <p className="text-yellow-300">{'const sdk = new BezhasSDK({ apiKey: "YOUR_API_KEY" });'}</p>
                    <p className="text-yellow-300">{'const mcp = new McpIntelligence(sdk);'}</p>
                    <br />
                    <p className="text-gray-500"># 4. Usar cualquier herramienta MCP</p>
                    <p className="text-yellow-300">{'const gas = await mcp.analyzeGas({ transactionType: "token_transfer", estimatedValueUSD: 100 });'}</p>
                    <p className="text-yellow-300">{'const audit = await mcp.auditContract({ contractAddress: "0x..." });'}</p>
                </div>
            </div>

            {/* All 13 MCP Tools List */}
            <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <PlugIcon className="w-5 h-5 text-blue-400" />
                    13 MCP Tools Incluidos
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {mcpTools.map((tool, idx) => (
                        <div key={idx} className="flex items-center gap-3 bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
                            <div className="w-8 h-8 rounded-lg bg-purple-600/20 flex items-center justify-center text-xs font-bold text-purple-400">
                                {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{tool.name}</p>
                                <p className="text-xs text-gray-400">{tool.desc}</p>
                            </div>
                            <span className="text-[10px] bg-gray-700/50 text-gray-400 px-2 py-0.5 rounded-full whitespace-nowrap">{tool.category}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default McpSdkDownloadTab;
