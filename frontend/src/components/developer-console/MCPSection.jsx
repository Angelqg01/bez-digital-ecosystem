import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Plug as PlugIcon,
    Sparkles as SparklesIcon,
    Terminal as TerminalIcon,
    ShieldCheck as ShieldCheckIcon,
    Zap as ZapIcon,
    Check as CheckIcon,
    Copy as CopyIcon,
    ExternalLink as ExternalLinkIcon,
    Download as DownloadIcon,
    Key as KeyIcon,
    Cpu as CpuIcon,
    Server as ServerIcon,
    Wallet as WalletIcon,
    Boxes as BoxesIcon,
    Lock as LockIcon,
    ArrowRight as ArrowRightIcon,
    BookOpen as BookOpenIcon,
    LifeBuoy as LifeBuoyIcon,
    Network as NetworkIcon,
    Bot as BotIcon,
    Building2 as Building2Icon,
    ChevronDown as ChevronDownIcon,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

/**
 * MCPSection — Sección principal (landing) del Model Context Protocol de BeZhas.
 *
 * Se renderiza como PRIMERA sección de /developers y funciona como página
 * dedicada al MCP: qué es, qué resuelve, instalación paso a paso, requisitos,
 * suscripciones necesarias, seguridad y todos los enlaces directos.
 *
 * El servidor real vive en packages/mcp-server (@bezhas/mcp-server) y expone
 * 20 herramientas MCP sobre STDIO (clientes de IA) y HTTP (backend/integraciones).
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const MCP_PACKAGE = '@bezhas/mcp-server';
const MCP_VERSION = '1.1.0';

// ─── Utilidades ────────────────────────────────────────────────────────────────

const CopyButton = ({ value, label = 'Copiar' }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast.success('Copiado al portapapeles');
        } catch {
            toast.error('Tu navegador bloqueó el portapapeles. Copia manualmente.');
        }
    };

    return (
        <button
            type="button"
            onClick={handleCopy}
            className="text-xs flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors px-2 py-1 rounded-md hover:bg-white/5"
        >
            {copied ? <CheckIcon size={13} className="text-green-400" /> : <CopyIcon size={13} />}
            {copied ? 'Copiado' : label}
        </button>
    );
};

const Snippet = ({ title, code, accent = 'text-green-300' }) => (
    <div className="rounded-xl overflow-hidden border border-gray-700 bg-gray-950">
        <div className="bg-gray-900 px-4 py-2 flex justify-between items-center border-b border-gray-700">
            <span className="text-xs font-mono text-blue-300">{title}</span>
            <CopyButton value={code} />
        </div>
        <pre className="p-4 overflow-x-auto text-[13px] leading-relaxed font-mono">
            <code className={accent}>{code}</code>
        </pre>
    </div>
);

const SectionTitle = ({ eyebrow, title, subtitle, icon: Icon, onDark = false }) => (
    <div className="mb-8">
        {eyebrow && (
            <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] mb-3 ${onDark ? 'text-purple-300' : 'text-purple-600 dark:text-purple-400'}`}>
                {Icon && <Icon size={14} />}
                {eyebrow}
            </div>
        )}
        <h2 className={`text-2xl md:text-3xl font-bold ${onDark ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{title}</h2>
        {subtitle && (
            <p className={`mt-3 max-w-3xl leading-relaxed ${onDark ? 'text-gray-300' : 'text-gray-600 dark:text-gray-400'}`}>
                {subtitle}
            </p>
        )}
    </div>
);

// ─── Datos ─────────────────────────────────────────────────────────────────────

const CAPABILITIES = [
    {
        icon: SparklesIcon,
        title: 'Habla, no programes',
        desc: 'Pide en lenguaje natural "audita este contrato" o "calcula el swap de 500 BEZ a EUR" y el MCP ejecuta la herramienta correcta con los parámetros correctos.',
    },
    {
        icon: BoxesIcon,
        title: 'Una sola integración',
        desc: 'Blockchain, pagos, compliance, DAO, supply chain, DevOps y trading bajo un único servidor MCP y una única API Key. Sin mantener 20 SDKs distintos.',
    },
    {
        icon: ShieldCheckIcon,
        title: 'Seguridad por diseño',
        desc: 'Permisos granulares por módulo, rotación de claves, rate limiting por plan, verificación AML/KYC y registro de auditoría de cada llamada.',
    },
    {
        icon: NetworkIcon,
        title: 'Compatible con todo',
        desc: 'Claude Desktop, Claude Code, Cursor, VS Code, agentes propios vía STDIO — y cualquier backend vía el wrapper HTTP REST.',
    },
];

const TOOLS = [
    { name: 'analyze_gas_strategy', cat: 'Blockchain', desc: 'Decide relayer vs. usuario y optimiza gas en Polygon.', prompt: '"¿Me conviene usar relayer para una tx de 30 USD?"' },
    { name: 'calculate_smart_swap', cat: 'Blockchain', desc: 'Swap inteligente BEZ ↔ FIAT con fees y slippage.', prompt: '"Convierte 1.200 BEZ a EUR con el mejor coste"' },
    { name: 'blockscout_explorer', cat: 'Blockchain', desc: 'Explorador on-chain del token BEZ y de cualquier wallet.', prompt: '"Muéstrame las últimas tx de esta wallet"' },
    { name: 'get_payment_quote', cat: 'Pagos', desc: 'Cotización de pago con desglose de comisiones.', prompt: '"Cotiza un cobro de 250 EUR con tarjeta"' },
    { name: 'process_stripe_payment', cat: 'Pagos', desc: 'Cobro fiat vía Stripe conectado a la tesorería BEZ.', prompt: '"Cobra la factura 4471 al cliente"' },
    { name: 'check_payment_status', cat: 'Pagos', desc: 'Estado y conciliación de cualquier pago.', prompt: '"¿Se liquidó el pago pi_3Q...?"' },
    { name: 'get_wallet_balance', cat: 'Pagos', desc: 'Saldo BEZ, MATIC y equivalente fiat en tiempo real.', prompt: '"¿Cuánto BEZ tiene la tesorería?"' },
    { name: 'initiate_crypto_payment', cat: 'Pagos', desc: 'Genera órdenes de pago cripto con escrow.', prompt: '"Crea un escrow de 800 BEZ para este proveedor"' },
    { name: 'verify_regulatory_compliance', cat: 'Compliance', desc: 'Scoring AML/KYC, sanciones y umbrales de riesgo.', prompt: '"Verifica el riesgo de esta contraparte"' },
    { name: 'auditmos_security', cat: 'Seguridad', desc: 'Auditoría de smart contracts y detección de vulnerabilidades.', prompt: '"Audita el contrato 0xEcBa... y prioriza hallazgos"' },
    { name: 'github_repo_manager', cat: 'DevOps', desc: 'Gestión de repos, issues, PRs y documentación automática.', prompt: '"Abre un PR con el fix y su changelog"' },
    { name: 'playwright_automation', cat: 'QA', desc: 'Automatización de navegador y pruebas E2E de la UI.', prompt: '"Prueba el checkout completo y repórtame errores"' },
    { name: 'obliq_ai_sre', cat: 'SRE', desc: 'Monitorización, incidencias y fiabilidad del servicio.', prompt: '"¿Por qué subió la latencia del backend hoy?"' },
    { name: 'firecrawl_scraper', cat: 'Inteligencia', desc: 'Extracción y descubrimiento web estructurado.', prompt: '"Extrae precios de la competencia y compáralos"' },
    { name: 'skill_creator_ai', cat: 'IA', desc: 'Genera flujos y skills personalizadas para tu operación.', prompt: '"Crea un flujo de alta de proveedor con KYC"' },
    { name: 'tally_dao_governance', cat: 'Gobernanza', desc: 'Propuestas, delegaciones y votaciones de la DAO.', prompt: '"Resume las propuestas abiertas y su quórum"' },
    { name: 'kinaxis_supply_chain', cat: 'Supply Chain', desc: 'Telemetría IoT, logística y planificación de cadena.', prompt: '"¿Qué envíos están en riesgo de retraso?"' },
    { name: 'alpaca_markets', cat: 'Trading', desc: 'Análisis de mercado y operativa de tesorería.', prompt: '"Analiza la exposición de la tesorería esta semana"' },
    { name: 'send_telegram_message', cat: 'Alertas', desc: 'Alertas críticas y escalado humano vía Telegram.', prompt: '"Avísame por Telegram si el gas supera 300 gwei"' },
    { name: 'sync_contacts', cat: 'CRM', desc: 'Sincronización de contactos con hashing local y privacidad.', prompt: '"Sincroniza los contactos del ERP con BeZhas"' },
];

const CAT_COLORS = {
    Blockchain: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    Pagos: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    Compliance: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    Seguridad: 'bg-red-500/15 text-red-300 border-red-500/30',
    DevOps: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    QA: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    SRE: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    Inteligencia: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
    IA: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
    Gobernanza: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    'Supply Chain': 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    Trading: 'bg-lime-500/15 text-lime-300 border-lime-500/30',
    Alertas: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    CRM: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
};

const CLIENT_CONFIGS = [
    {
        id: 'claude-desktop',
        label: 'Claude Desktop',
        file: 'claude_desktop_config.json',
        hint: 'macOS: ~/Library/Application Support/Claude/claude_desktop_config.json · Windows: %APPDATA%\\Claude\\claude_desktop_config.json',
        code: `{
  "mcpServers": {
    "bezhas": {
      "command": "npx",
      "args": ["-y", "@bezhas/mcp-server"],
      "env": {
        "BEZHAS_API_KEY": "bzh_live_TU_API_KEY",
        "NETWORK_MODE": "mainnet",
        "POLYGON_RPC_URL": "https://polygon-rpc.com"
      }
    }
  }
}`,
    },
    {
        id: 'claude-code',
        label: 'Claude Code (CLI)',
        file: 'terminal',
        hint: 'Registra el servidor en tu proyecto o en tu ámbito de usuario con un solo comando.',
        code: `claude mcp add bezhas \\
  -e BEZHAS_API_KEY=bzh_live_TU_API_KEY \\
  -e NETWORK_MODE=mainnet \\
  -- npx -y @bezhas/mcp-server

# Verificar que quedó conectado
claude mcp list`,
    },
    {
        id: 'cursor',
        label: 'Cursor',
        file: '~/.cursor/mcp.json',
        hint: 'También puedes crearlo por proyecto en .cursor/mcp.json y reiniciar Cursor.',
        code: `{
  "mcpServers": {
    "bezhas": {
      "command": "npx",
      "args": ["-y", "@bezhas/mcp-server"],
      "env": {
        "BEZHAS_API_KEY": "bzh_live_TU_API_KEY",
        "NETWORK_MODE": "mainnet"
      }
    }
  }
}`,
    },
    {
        id: 'vscode',
        label: 'VS Code',
        file: '.vscode/mcp.json',
        hint: 'Usa "inputs" para que VS Code te pida la clave y no quede escrita en el repositorio.',
        code: `{
  "inputs": [
    {
      "id": "bezhas-api-key",
      "type": "promptString",
      "description": "BeZhas API Key",
      "password": true
    }
  ],
  "servers": {
    "bezhas": {
      "command": "npx",
      "args": ["-y", "@bezhas/mcp-server"],
      "env": {
        "BEZHAS_API_KEY": "\${input:bezhas-api-key}",
        "NETWORK_MODE": "mainnet"
      }
    }
  }
}`,
    },
    {
        id: 'http',
        label: 'HTTP / Backend',
        file: 'REST wrapper',
        hint: 'Para plataformas de IA propias, ERP/SAP o cualquier backend que no hable STDIO.',
        code: `# Levantar el wrapper HTTP (puerto 8080 por defecto)
pnpm --filter @bezhas/mcp-server start:http

# Listar herramientas disponibles
curl ${API_BASE}/api/mcp/tools -H "X-API-Key: $BEZHAS_API_KEY"

# Ejecutar una herramienta
curl -X POST ${API_BASE}/api/mcp/execute \\
  -H "X-API-Key: $BEZHAS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"tool":"analyze_gas_strategy","params":{"transactionType":"token_transfer","estimatedValueUSD":100}}'`,
    },
    {
        id: 'sdk',
        label: 'SDK (JS/TS)',
        file: '@bezhas/sdk + @bezhas/mcp',
        hint: 'El módulo MCP Intelligence se apoya en el BeZhas SDK: instala primero el SDK.',
        code: `import { BezhasSDK } from '@bezhas/sdk';
import { McpIntelligence } from '@bezhas/mcp';

const sdk = new BezhasSDK({ apiKey: process.env.BEZHAS_API_KEY });
const mcp = new McpIntelligence(sdk);

const gas = await mcp.analyzeGas({ transactionType: 'token_transfer', estimatedValueUSD: 100 });
const audit = await mcp.auditContract({ contractAddress: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8' });`,
    },
];

const REQUIREMENTS = [
    { icon: WalletIcon, title: 'Cuenta BeZhas + wallet', desc: 'Regístrate y conecta tu wallet Polygon. Es la identidad que firma tus operaciones on-chain.', link: '/auth', linkLabel: 'Crear cuenta' },
    { icon: KeyIcon, title: 'API Key con scopes', desc: 'Genera la clave en la consola y activa solo los módulos que tu agente necesita (marketplace, pagos, identidad, legal, IA…).', tab: 'keys', linkLabel: 'Generar API Key' },
    { icon: Building2Icon, title: 'Suscripción activa', desc: 'El acceso a la API y al MCP empieza en el plan Starter (99 €/mes). BeZhas Pro añade el Universal Bridge API (ERP/SAP) y Enterprise VIP el nodo MCP dedicado.', link: '/be-vip', linkLabel: 'Ver planes' },
    { icon: TerminalIcon, title: 'Node.js 20+ y pnpm 11+', desc: 'El servidor MCP corre sobre Node 20 o superior. Con npx no necesitas instalarlo globalmente.' },
    { icon: BotIcon, title: 'Cliente compatible', desc: 'Claude Desktop, Claude Code, Cursor, VS Code o tu propio agente. Vía HTTP también sirve cualquier backend.' },
    { icon: ShieldCheckIcon, title: 'KYC verificado (pagos)', desc: 'Las herramientas de pagos, escrow y tokenización exigen KYC aprobado y pasan por verify_regulatory_compliance.', link: '/compliance', linkLabel: 'Ir a Compliance' },
];

const PLANS = [
    {
        name: 'Freemium',
        price: 'Gratis',
        billed: '0 € / mes · coste según uso',
        highlight: false,
        mcp: 'Playground y sandbox',
        features: [
            '150 acciones IA/mes',
            'Documentación completa y simulador SDK',
            'Wallet corporativa + voto en la DAO',
            'Sin API Key productiva ni webhooks',
        ],
    },
    {
        name: 'Starter',
        price: '99 €',
        billed: '119,79 € / mes con IVA · 200 $BEZ',
        highlight: true,
        mcp: 'MCP completo (20 herramientas)',
        features: [
            '1.500 acciones IA/mes · 50 consultas IA/día',
            'API Key productiva y rate limit ampliado',
            '1 smart contract activo · 25% de subsidio de gas',
            'Alternativa: bloquea 5.000 BEZ / 90 días y accede gratis',
        ],
    },
    {
        name: 'BeZhas Pro',
        price: '499 €',
        billed: '603,79 € / mes con IVA · 1.000 $BEZ',
        highlight: false,
        mcp: 'MCP + Universal Bridge API',
        features: [
            '15.000 acciones IA/mes · 200 consultas IA/día',
            'Universal Bridge API: SAP, Odoo, Salesforce, HubSpot',
            'Webhook Engine en tiempo real',
            '5 smart contracts · 50% de subsidio de gas',
        ],
    },
    {
        name: 'Enterprise VIP',
        price: '2.499 €',
        billed: '3.023,79 € / mes con IVA · 5.000 $BEZ',
        highlight: false,
        mcp: 'Nodo MCP dedicado y aislado',
        features: [
            '50.000 acciones IA/mes (política de uso justo)',
            'Nodo MCP privado + modelos entrenados a medida',
            'API REST ilimitada y webhooks personalizados',
            'White-label, Sub-DAOs y gas 100% subsidiado',
        ],
    },
];

const FAQ = [
    {
        q: '¿Qué es exactamente el MCP de BeZhas?',
        a: 'Es un servidor Model Context Protocol que publica 20 herramientas del ecosistema BeZhas (blockchain, pagos, compliance, DAO, supply chain, DevOps, trading y alertas) para que un modelo de IA las invoque directamente. Tu asistente deja de "explicar" cómo hacer algo y pasa a ejecutarlo contra la plataforma real.',
    },
    {
        q: '¿Necesito saber programar para usarlo?',
        a: 'No para operarlo. Una vez pegada la configuración en tu cliente (dos minutos), todo se pide en lenguaje natural. Programar solo hace falta si quieres integrarlo en tu propio backend, y para eso están el wrapper HTTP y el SDK.',
    },
    {
        q: '¿Desde qué plan tengo acceso?',
        a: 'Freemium incluye playground, simulador y documentación. El MCP productivo con API Key empieza en el plan Starter (99 € + IVA). BeZhas Pro añade el Universal Bridge API para conectar tu ERP (SAP, Odoo, Salesforce) y Enterprise VIP entrega un nodo MCP dedicado con aislamiento de datos.',
    },
    {
        q: '¿Puedo usarlo desde la plataforma de IA de BeZhas?',
        a: 'Sí. Además de los clientes externos, el ecosistema expone las mismas herramientas desde el chat de IA de BeZhas y desde el agente OpenClaw, usando tu propia API Key y tus mismos permisos. No hace falta instalar nada en local.',
    },
    {
        q: '¿Qué red y qué token usa?',
        a: 'Polygon. NETWORK_MODE=mainnet apunta a producción y NETWORK_MODE=amoy a la testnet Amoy para tus pruebas. El token BEZ es inmutable en 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8.',
    },
    {
        q: '¿Cómo protejo mi API Key?',
        a: 'Guárdala siempre en variables de entorno (o en el prompt seguro de VS Code), nunca en el repositorio. Asigna solo los scopes necesarios, rota la clave desde la consola ante cualquier sospecha y revisa el registro de auditoría de llamadas. La clave del relayer jamás debe salir del servidor.',
    },
];

// ─── Componente principal ──────────────────────────────────────────────────────

const MCPSection = ({ onOpenTab }) => {
    const [activeClient, setActiveClient] = useState('claude-desktop');
    const client = CLIENT_CONFIGS.find((c) => c.id === activeClient) || CLIENT_CONFIGS[0];

    const goToTab = (tab) => {
        if (typeof onOpenTab === 'function') onOpenTab(tab);
        document.getElementById('developer-console')?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <section id="bezhas-mcp" className="mb-16 space-y-14">
            {/* ── HERO ────────────────────────────────────────────────────── */}
            <div className="relative overflow-hidden rounded-3xl border border-purple-500/30 bg-gradient-to-br from-[#0b0618] via-[#0d1030] to-[#04121f] px-6 py-12 md:px-12 md:py-16">
                <div className="absolute -top-24 -right-24 w-80 h-80 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

                <div className="relative max-w-4xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-purple-400/40 bg-purple-500/10 text-purple-200 text-xs font-semibold tracking-wide mb-6">
                        <PlugIcon size={14} />
                        BeZhas MCP · Model Context Protocol · v{MCP_VERSION}
                    </div>

                    <h1 className="text-4xl md:text-6xl font-black text-white leading-[1.05]">
                        Conecta tu IA a{' '}
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-fuchsia-400 to-cyan-300">
                            todo BeZhas
                        </span>{' '}
                        en 2 minutos
                    </h1>

                    <p className="text-lg text-gray-300 mt-6 leading-relaxed max-w-3xl">
                        El MCP de BeZhas convierte cualquier asistente de IA —Claude, Cursor, VS Code o tu propio
                        agente— en un operador con acceso real a la plataforma. Pagos, blockchain, compliance,
                        gobernanza, logística y auditoría de contratos: <strong className="text-white">20 herramientas,
                        una sola API Key y cero código de integración</strong>. Pides en lenguaje natural y el MCP
                        ejecuta la función correcta sobre Polygon.
                    </p>

                    <div className="flex flex-wrap gap-3 mt-8">
                        <a
                            href="#mcp-instalacion"
                            className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-semibold shadow-lg shadow-purple-900/40 hover:from-purple-500 hover:to-fuchsia-500 transition-all flex items-center gap-2"
                        >
                            <TerminalIcon size={18} />
                            Empezar la instalación
                        </a>
                        <button
                            type="button"
                            onClick={() => goToTab('keys')}
                            className="px-6 py-3.5 rounded-xl bg-white/10 border border-white/20 text-white font-semibold hover:bg-white/20 transition-all flex items-center gap-2"
                        >
                            <KeyIcon size={18} />
                            Obtener mi API Key
                        </button>
                        <Link
                            to="/be-vip"
                            className="px-6 py-3.5 rounded-xl bg-transparent border border-white/20 text-gray-200 font-semibold hover:bg-white/10 transition-all flex items-center gap-2"
                        >
                            <SparklesIcon size={18} />
                            Ver suscripciones
                        </Link>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
                        {[
                            { value: '20', label: 'Herramientas MCP' },
                            { value: '1', label: 'API Key para todo' },
                            { value: 'Polygon', label: 'Mainnet + Amoy' },
                            { value: '< 2 min', label: 'Puesta en marcha' },
                        ].map((stat) => (
                            <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                                <p className="text-2xl font-black text-white">{stat.value}</p>
                                <p className="text-xs text-gray-400 mt-1">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── POR QUÉ EL MCP ──────────────────────────────────────────── */}
            <div>
                <SectionTitle
                    eyebrow="Por qué usarlo"
                    icon={ZapIcon}
                    title="Toda la potencia de BeZhas, sin fricción"
                    subtitle="Integrar el ecosistema solía significar leer documentación, escribir clientes HTTP, gestionar firmas y mantener versiones. Con el MCP, tu asistente descubre las herramientas solo y las ejecuta con tus permisos."
                />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                    {CAPABILITIES.map((cap) => (
                        <div
                            key={cap.title}
                            className="rounded-2xl border border-gray-700 bg-gray-900 p-6 hover:border-purple-500/50 transition-all"
                        >
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-600/30 to-blue-600/30 border border-purple-500/30 flex items-center justify-center mb-4">
                                <cap.icon className="w-5 h-5 text-purple-300" />
                            </div>
                            <h3 className="text-white font-bold mb-2">{cap.title}</h3>
                            <p className="text-sm text-gray-400 leading-relaxed">{cap.desc}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── HERRAMIENTAS ────────────────────────────────────────────── */}
            <div>
                <SectionTitle
                    eyebrow="Qué puedes pedirle"
                    icon={BoxesIcon}
                    title="Las 20 herramientas que se activan al instalar"
                    subtitle="Cada herramienta es una función real del ecosistema. A la derecha de cada tarjeta tienes un ejemplo de cómo pedirla en lenguaje natural."
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {TOOLS.map((tool, idx) => (
                        <div
                            key={tool.name}
                            className="rounded-2xl border border-gray-700/70 bg-gray-900 p-5 hover:border-purple-500/40 transition-all"
                        >
                            <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className="w-7 h-7 flex-shrink-0 rounded-lg bg-purple-600/20 text-purple-300 text-[11px] font-bold flex items-center justify-center">
                                        {idx + 1}
                                    </span>
                                    <code className="text-sm font-mono text-white truncate">{tool.name}</code>
                                </div>
                                <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap ${CAT_COLORS[tool.cat] || 'bg-gray-700/40 text-gray-300 border-gray-600'}`}
                                >
                                    {tool.cat}
                                </span>
                            </div>
                            <p className="text-sm text-gray-400 mb-3">{tool.desc}</p>
                            <p className="text-xs text-gray-400 italic border-l-2 border-purple-500/40 pl-3">{tool.prompt}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── INSTALACIÓN ─────────────────────────────────────────────── */}
            <div id="mcp-instalacion" className="scroll-mt-24">
                <SectionTitle
                    eyebrow="Instalación"
                    icon={TerminalIcon}
                    title="Paso a paso: de cero a operativo"
                    subtitle="Seis pasos. Los cuatro primeros se hacen una sola vez; el quinto es copiar y pegar la configuración de tu cliente."
                />

                <div className="space-y-5">
                    {/* Paso 1 */}
                    <div className="rounded-2xl border border-gray-700 bg-gray-900 p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <span className="w-8 h-8 rounded-full bg-purple-600 text-white font-bold text-sm flex items-center justify-center">1</span>
                            <h3 className="text-lg font-bold text-white">Crea tu cuenta y conecta la wallet</h3>
                        </div>
                        <p className="text-sm text-gray-400 mb-4">
                            La cuenta BeZhas es tu identidad Web3: firma las operaciones, sostiene tus permisos y vincula
                            tu suscripción. Si ya tienes cuenta, inicia sesión y conecta la wallet Polygon.
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <Link to="/auth" className="px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-all flex items-center gap-2">
                                <WalletIcon size={16} /> Crear cuenta / Entrar
                            </Link>
                            <Link to="/compliance" className="px-4 py-2.5 rounded-lg border border-gray-600 text-gray-300 hover:bg-white/5 text-sm font-semibold transition-all flex items-center gap-2">
                                <ShieldCheckIcon size={16} /> Verificar KYC
                            </Link>
                        </div>
                    </div>

                    {/* Paso 2 */}
                    <div className="rounded-2xl border border-gray-700 bg-gray-900 p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <span className="w-8 h-8 rounded-full bg-purple-600 text-white font-bold text-sm flex items-center justify-center">2</span>
                            <h3 className="text-lg font-bold text-white">Genera tu API Key con permisos mínimos</h3>
                        </div>
                        <p className="text-sm text-gray-400 mb-4">
                            En la pestaña <strong className="text-gray-200">API Keys</strong> de esta consola, crea una clave
                            y activa únicamente los módulos que tu agente necesita. Cópiala en ese momento: solo se muestra
                            una vez. Puedes rotarla o revocarla cuando quieras.
                        </p>
                        <button
                            type="button"
                            onClick={() => goToTab('keys')}
                            className="px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-all flex items-center gap-2"
                        >
                            <KeyIcon size={16} /> Ir a API Keys
                        </button>
                    </div>

                    {/* Paso 3 */}
                    <div className="rounded-2xl border border-gray-700 bg-gray-900 p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <span className="w-8 h-8 rounded-full bg-purple-600 text-white font-bold text-sm flex items-center justify-center">3</span>
                            <h3 className="text-lg font-bold text-white">Activa la suscripción que necesitas</h3>
                        </div>
                        <p className="text-sm text-gray-400 mb-4">
                            El MCP productivo empieza en el plan <strong className="text-gray-200">Starter</strong> (99 € + IVA).
                            Si vas a conectar un ERP (SAP, Odoo, Salesforce) necesitas <strong className="text-gray-200">BeZhas Pro</strong>,
                            y si requieres un nodo MCP aislado con tus propios datos, <strong className="text-gray-200">Enterprise VIP</strong>.
                            En los tres casos puedes pagar en euros, en $BEZ o bloquear tokens y acceder sin cuota.
                        </p>
                        <Link to="/be-vip" className="px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-all inline-flex items-center gap-2">
                            <SparklesIcon size={16} /> Comparar planes
                        </Link>
                    </div>

                    {/* Paso 4 */}
                    <div className="rounded-2xl border border-gray-700 bg-gray-900 p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="w-8 h-8 rounded-full bg-purple-600 text-white font-bold text-sm flex items-center justify-center">4</span>
                            <h3 className="text-lg font-bold text-white">Instala el servidor MCP</h3>
                        </div>
                        <p className="text-sm text-gray-400 mb-4">
                            Requiere <strong className="text-gray-200">Node.js 20 o superior</strong>. Con <code className="text-purple-300">npx</code> no
                            necesitas instalar nada de forma permanente; si prefieres fijar la versión, instálalo global o como dependencia.
                        </p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <Snippet
                                title="Ejecución directa (recomendado)"
                                code={`npx -y ${MCP_PACKAGE}`}
                            />
                            <Snippet
                                title="Instalación fija"
                                code={`npm install -g ${MCP_PACKAGE}
# o dentro de tu proyecto
pnpm add ${MCP_PACKAGE} @bezhas/sdk`}
                            />
                        </div>
                        <div className="mt-4 flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={() => goToTab('downloads')}
                                className="px-4 py-2.5 rounded-lg border border-gray-600 text-gray-300 hover:bg-white/5 text-sm font-semibold transition-all flex items-center gap-2"
                            >
                                <DownloadIcon size={16} /> Descargas (SDK + MCP)
                            </button>
                            <a
                                href={`${API_BASE}/api/downloads/bezhas-mcp.tgz`}
                                className="px-4 py-2.5 rounded-lg border border-gray-600 text-gray-300 hover:bg-white/5 text-sm font-semibold transition-all flex items-center gap-2"
                            >
                                <DownloadIcon size={16} /> Paquete .tgz <ExternalLinkIcon size={13} />
                            </a>
                        </div>
                    </div>

                    {/* Paso 5 */}
                    <div className="rounded-2xl border border-gray-700 bg-gray-900 p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="w-8 h-8 rounded-full bg-purple-600 text-white font-bold text-sm flex items-center justify-center">5</span>
                            <h3 className="text-lg font-bold text-white">Configura tu cliente de IA</h3>
                        </div>
                        <p className="text-sm text-gray-400 mb-5">
                            Elige tu entorno, copia el bloque y reinicia el cliente. Sustituye
                            <code className="text-purple-300 mx-1">bzh_live_TU_API_KEY</code> por la clave del paso 2.
                        </p>

                        <div className="flex flex-wrap gap-2 mb-4">
                            {CLIENT_CONFIGS.map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setActiveClient(c.id)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                        activeClient === c.id
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                                    }`}
                                >
                                    {c.label}
                                </button>
                            ))}
                        </div>

                        <Snippet title={client.file} code={client.code} accent="text-cyan-200" />
                        <p className="text-xs text-gray-400 mt-3 leading-relaxed">{client.hint}</p>
                    </div>

                    {/* Paso 6 */}
                    <div className="rounded-2xl border border-gray-700 bg-gray-900 p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="w-8 h-8 rounded-full bg-green-600 text-white font-bold text-sm flex items-center justify-center">6</span>
                            <h3 className="text-lg font-bold text-white">Verifica que está activo</h3>
                        </div>
                        <p className="text-sm text-gray-400 mb-4">
                            Comprueba el estado del servidor y lanza tu primera instrucción en lenguaje natural. Si la
                            herramienta responde, ya tienes el ecosistema conectado a tu IA.
                        </p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <Snippet
                                title="Health check"
                                code={`curl ${API_BASE}/api/mcp/health`}
                            />
                            <Snippet
                                title="Primer prompt en tu asistente"
                                code={`"Con las herramientas de BeZhas, dime el saldo
de la wallet de tesorería y analiza si conviene
usar relayer para una transferencia de 100 USD."`}
                                accent="text-yellow-200"
                            />
                        </div>
                        <div className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 flex gap-3">
                            <LockIcon className="w-5 h-5 text-amber-300 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-100/90 leading-relaxed">
                                <strong>Variables de entorno del servidor:</strong>{' '}
                                <code className="text-amber-200">BEZHAS_API_KEY</code>,{' '}
                                <code className="text-amber-200">NETWORK_MODE</code> (mainnet | amoy | localhost),{' '}
                                <code className="text-amber-200">POLYGON_RPC_URL</code> /{' '}
                                <code className="text-amber-200">POLYGON_AMOY_RPC_URL</code>, y opcionalmente{' '}
                                <code className="text-amber-200">GITHUB_TOKEN</code>,{' '}
                                <code className="text-amber-200">FIRECRAWL_API_KEY</code>,{' '}
                                <code className="text-amber-200">TALLY_API_KEY</code>,{' '}
                                <code className="text-amber-200">ALPACA_API_KEY</code> /{' '}
                                <code className="text-amber-200">ALPACA_SECRET_KEY</code> para las herramientas que
                                dependen de terceros. Nunca expongas{' '}
                                <code className="text-amber-200">RELAYER_PRIVATE_KEY</code> fuera del servidor.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── REQUISITOS ──────────────────────────────────────────────── */}
            <div>
                <SectionTitle
                    eyebrow="Qué necesitas"
                    icon={CheckIcon}
                    title="Requisitos para tenerlo activo"
                    subtitle="Checklist completo antes de lanzar tu primera operación en producción."
                />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {REQUIREMENTS.map((req) => (
                        <div key={req.title} className="rounded-2xl border border-gray-700 bg-gray-900 p-6 flex flex-col">
                            <div className="flex items-center gap-3 mb-3">
                                <req.icon className="w-5 h-5 text-cyan-300" />
                                <h3 className="text-white font-bold text-base">{req.title}</h3>
                            </div>
                            <p className="text-sm text-gray-400 leading-relaxed flex-1">{req.desc}</p>
                            {req.link && (
                                <Link to={req.link} className="text-sm text-purple-300 hover:text-purple-200 font-semibold mt-4 inline-flex items-center gap-1.5">
                                    {req.linkLabel} <ArrowRightIcon size={14} />
                                </Link>
                            )}
                            {req.tab && (
                                <button
                                    type="button"
                                    onClick={() => goToTab(req.tab)}
                                    className="text-sm text-purple-300 hover:text-purple-200 font-semibold mt-4 inline-flex items-center gap-1.5 self-start"
                                >
                                    {req.linkLabel} <ArrowRightIcon size={14} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* ── SUSCRIPCIONES ───────────────────────────────────────────── */}
            <div id="mcp-suscripciones" className="scroll-mt-24">
                <SectionTitle
                    eyebrow="Suscripciones"
                    icon={SparklesIcon}
                    title="Qué plan necesitas según tu uso del MCP"
                    subtitle="Todos los precios en euros, IVA español (21%) incluido en el importe facturado. Puedes pagar en fiat o en $BEZ; el bloqueo de tokens da acceso equivalente sin cuota mensual."
                />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                    {PLANS.map((plan) => (
                        <div
                            key={plan.name}
                            className={`rounded-2xl border p-6 flex flex-col ${
                                plan.highlight
                                    ? 'border-purple-500 bg-gradient-to-b from-[#2a1145] to-gray-900 shadow-lg shadow-purple-900/30'
                                    : 'border-gray-700 bg-gray-900'
                            }`}
                        >
                            {plan.highlight && (
                                <span className="self-start text-[10px] font-bold uppercase tracking-wider bg-purple-500 text-white px-2.5 py-1 rounded-full mb-3">
                                    Recomendado para devs
                                </span>
                            )}
                            <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                            <p className="text-3xl font-black text-white mt-2">{plan.price}</p>
                            <p className="text-xs text-gray-400 mt-1">{plan.billed}</p>

                            <div className="mt-4 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                                <p className="text-[10px] uppercase tracking-wider text-gray-400">Acceso MCP</p>
                                <p className="text-sm text-cyan-300 font-semibold">{plan.mcp}</p>
                            </div>

                            <ul className="mt-4 space-y-2 flex-1">
                                {plan.features.map((f) => (
                                    <li key={f} className="flex items-start gap-2 text-sm text-gray-400">
                                        <CheckIcon size={15} className="text-green-400 mt-0.5 flex-shrink-0" />
                                        <span>{f}</span>
                                    </li>
                                ))}
                            </ul>

                            <Link
                                to="/be-vip"
                                className={`mt-6 w-full px-4 py-2.5 rounded-lg text-sm font-semibold text-center transition-all ${
                                    plan.highlight
                                        ? 'bg-purple-600 hover:bg-purple-500 text-white'
                                        : 'border border-gray-600 text-gray-300 hover:bg-white/5'
                                }`}
                            >
                                Contratar {plan.name}
                            </Link>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-500 mt-4">
                    ¿Necesitas un acuerdo a medida, marca blanca o un nodo MCP en tu propia infraestructura? Escríbenos a{' '}
                    <a href="mailto:dev@bez.digital" className="text-purple-300 hover:text-purple-200">dev@bez.digital</a>.
                </p>
            </div>

            {/* ── PLATAFORMA DE IA ────────────────────────────────────────── */}
            <div className="rounded-3xl border border-cyan-500/25 bg-gradient-to-br from-[#04121f] via-gray-900 to-[#0b0618] p-8 md:p-10">
                <SectionTitle
                    onDark
                    eyebrow="Sin instalar nada"
                    icon={CpuIcon}
                    title="También desde la plataforma de IA de BeZhas"
                    subtitle="Las mismas 20 herramientas están disponibles dentro del ecosistema: el chat de IA y el agente OpenClaw las invocan con tu API Key y tus mismos permisos. Ideal para equipos de negocio que no quieren tocar ficheros de configuración."
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <Link
                        to="/ai-chat"
                        className="rounded-2xl border border-gray-700 bg-gray-900 p-6 hover:border-cyan-500/50 transition-all group"
                    >
                        <BotIcon className="w-6 h-6 text-cyan-300 mb-3" />
                        <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                            BeZhas AI Chat <ArrowRightIcon size={15} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </h3>
                        <p className="text-sm text-gray-400">Conversa con el ecosistema y ejecuta herramientas MCP desde el navegador, sin instalación local.</p>
                    </Link>
                    <button
                        type="button"
                        onClick={() => goToTab('openclaw')}
                        className="text-left rounded-2xl border border-gray-700 bg-gray-900 p-6 hover:border-cyan-500/50 transition-all group"
                    >
                        <CpuIcon className="w-6 h-6 text-cyan-300 mb-3" />
                        <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                            Agente OpenClaw <ArrowRightIcon size={15} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </h3>
                        <p className="text-sm text-gray-400">Tu agente autónomo con clave propia y rotación de credenciales, orquestando las herramientas por ti.</p>
                    </button>
                    <button
                        type="button"
                        onClick={() => goToTab('simulator')}
                        className="text-left rounded-2xl border border-gray-700 bg-gray-900 p-6 hover:border-cyan-500/50 transition-all group"
                    >
                        <ZapIcon className="w-6 h-6 text-cyan-300 mb-3" />
                        <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                            SDK Simulator <ArrowRightIcon size={15} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </h3>
                        <p className="text-sm text-gray-400">Prueba flujos completos antes de llevarlos a producción, sin gastar gas ni tocar datos reales.</p>
                    </button>
                </div>
            </div>

            {/* ── SEGURIDAD ───────────────────────────────────────────────── */}
            <div>
                <SectionTitle
                    eyebrow="Seguridad"
                    icon={ShieldCheckIcon}
                    title="Buenas prácticas obligatorias"
                    subtitle="El MCP ejecuta operaciones reales sobre dinero y contratos. Estas reglas no son opcionales en producción."
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { t: 'Principio de mínimo privilegio', d: 'Una API Key por agente y por entorno, con solo los scopes que use. Nunca reutilices la clave de producción en desarrollo.' },
                        { t: 'Nunca en el repositorio', d: 'Usa variables de entorno o el prompt seguro de VS Code. Una clave filtrada en un commit se considera comprometida aunque el commit se borre.' },
                        { t: 'Rotación y revocación', d: 'Rota la clave desde la consola ante cualquier sospecha: la anterior deja de funcionar al instante y las llamadas quedan registradas.' },
                        { t: 'Rate limiting por plan', d: 'Cada plan aplica su propio límite de peticiones. Un pico anómalo se corta automáticamente y se notifica.' },
                        { t: 'Compliance antes de mover fondos', d: 'Las herramientas de pago pasan por verify_regulatory_compliance: scoring AML, sanciones y umbrales de alto valor.' },
                        { t: 'Auditoría continua', d: 'Lanza auditmos_security sobre cada contrato antes de desplegar y revisa el registro de auditoría de la consola con regularidad.' },
                    ].map((item) => (
                        <div key={item.t} className="rounded-2xl border border-gray-700 bg-gray-900 p-5 flex gap-4">
                            <ShieldCheckIcon className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <h3 className="text-white font-semibold text-sm mb-1">{item.t}</h3>
                                <p className="text-sm text-gray-400 leading-relaxed">{item.d}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── ENLACES DIRECTOS ────────────────────────────────────────── */}
            <div>
                <SectionTitle
                    eyebrow="Recursos"
                    icon={ExternalLinkIcon}
                    title="Enlaces directos"
                    subtitle="Todo lo que necesitas durante y después de la instalación, en un solo sitio."
                />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                        { icon: KeyIcon, label: 'Gestión de API Keys', desc: 'Crear, rotar y revocar claves', tab: 'keys' },
                        { icon: DownloadIcon, label: 'Descargas SDK + MCP', desc: 'Paquetes e instaladores', tab: 'downloads' },
                        { icon: TerminalIcon, label: 'Integración SDK', desc: 'Snippets por lenguaje', tab: 'sdk' },
                        { icon: NetworkIcon, label: 'Webhooks', desc: 'Eventos en tiempo real', tab: 'webhooks' },
                        { icon: BookOpenIcon, label: 'Documentación técnica', desc: 'Guías del ecosistema', to: '/docs' },
                        { icon: BookOpenIcon, label: 'Whitepaper', desc: 'Arquitectura y tokenomics', to: '/whitepaper' },
                        { icon: SparklesIcon, label: 'Planes y suscripciones', desc: 'Comparativa Be-VIP', to: '/be-vip' },
                        { icon: ShieldCheckIcon, label: 'Compliance / KYC', desc: 'Verificación regulatoria', to: '/compliance' },
                        { icon: BotIcon, label: 'Plataforma de IA', desc: 'Chat con herramientas MCP', to: '/ai-chat' },
                        { icon: ServerIcon, label: 'API Reference (Swagger)', desc: `${API_BASE}/api-docs`, href: `${API_BASE}/api-docs` },
                        { icon: ZapIcon, label: 'Estado del servidor MCP', desc: '/api/mcp/health', href: `${API_BASE}/api/mcp/health` },
                        { icon: WalletIcon, label: 'Token BEZ en Polygonscan', desc: '0xEcBa…11A8', href: 'https://polygonscan.com/token/0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8' },
                        { icon: BoxesIcon, label: `npm · ${MCP_PACKAGE}`, desc: 'Servidor MCP', href: `https://www.npmjs.com/package/${MCP_PACKAGE}` },
                        { icon: BoxesIcon, label: 'npm · @bezhas/sdk', desc: 'SDK base', href: 'https://www.npmjs.com/package/@bezhas/sdk' },
                        { icon: LifeBuoyIcon, label: 'Soporte para desarrolladores', desc: 'dev@bez.digital', href: 'mailto:dev@bez.digital' },
                    ].map((link) => {
                        const inner = (
                            <>
                                <link.icon className="w-5 h-5 text-purple-300 flex-shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-white truncate">{link.label}</p>
                                    <p className="text-xs text-gray-400 truncate">{link.desc}</p>
                                </div>
                            </>
                        );
                        const cls = 'flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-900 px-4 py-4 hover:border-purple-500/50 hover:bg-gray-900 transition-all w-full text-left';

                        if (link.tab) {
                            return (
                                <button key={link.label} type="button" onClick={() => goToTab(link.tab)} className={cls}>
                                    {inner}
                                </button>
                            );
                        }
                        if (link.to) {
                            return (
                                <Link key={link.label} to={link.to} className={cls}>
                                    {inner}
                                </Link>
                            );
                        }
                        return (
                            <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className={cls}>
                                {inner}
                            </a>
                        );
                    })}
                </div>
            </div>

            {/* ── FAQ ─────────────────────────────────────────────────────── */}
            <div>
                <SectionTitle eyebrow="Dudas frecuentes" icon={BookOpenIcon} title="Preguntas frecuentes sobre el MCP" />
                <div className="space-y-3">
                    {FAQ.map((item) => (
                        <details
                            key={item.q}
                            className="group rounded-2xl border border-gray-700 bg-gray-900 px-6 py-4 open:border-purple-500/40"
                        >
                            <summary className="flex items-center justify-between gap-4 cursor-pointer list-none text-white font-semibold">
                                {item.q}
                                <ChevronDownIcon size={18} className="text-gray-500 flex-shrink-0 transition-transform group-open:rotate-180" />
                            </summary>
                            <p className="text-sm text-gray-400 leading-relaxed mt-3">{item.a}</p>
                        </details>
                    ))}
                </div>
            </div>

            {/* ── CTA FINAL ───────────────────────────────────────────────── */}
            <div className="rounded-3xl border border-purple-500/30 bg-gradient-to-r from-[#2a1145] via-gray-900 to-[#0b2a45] p-8 md:p-12 text-center">
                <h2 className="text-2xl md:text-4xl font-black text-white">Tu IA ya sabe hablar. Dale manos.</h2>
                <p className="text-gray-300 mt-4 max-w-2xl mx-auto leading-relaxed">
                    Genera tu API Key, pega la configuración y deja que tu asistente opere pagos, contratos, compliance y
                    logística sobre la infraestructura real de BeZhas.
                </p>
                <div className="flex flex-wrap justify-center gap-3 mt-8">
                    <button
                        type="button"
                        onClick={() => goToTab('keys')}
                        className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-semibold hover:from-purple-500 hover:to-fuchsia-500 transition-all flex items-center gap-2"
                    >
                        <KeyIcon size={18} /> Crear mi API Key
                    </button>
                    <a
                        href="#mcp-instalacion"
                        className="px-6 py-3.5 rounded-xl bg-white/10 border border-white/20 text-white font-semibold hover:bg-white/20 transition-all flex items-center gap-2"
                    >
                        <TerminalIcon size={18} /> Volver a la instalación
                    </a>
                </div>
            </div>
        </section>
    );
};

export default MCPSection;
