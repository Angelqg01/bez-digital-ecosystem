'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './mcp.module.css';

// Endpoints públicos del MCP. Si cambia el dominio al desplegar (GCP), se
// cambia SOLO aquí: todas las instrucciones y botones de copiar los leen.
const MCP_URL = 'https://mcp.bez.digital/mcp';
const MCP_ONBOARDING_URL = 'https://mcp.bez.digital/mcp/onboarding';
const MCP_ORIGIN = 'https://mcp.bez.digital';
const SALES_EMAIL = 'info.bezcoin@bez.digital';

type Plan = 'Starter' | 'Creator Pro' | 'Business' | 'Enterprise VIP';

// Espejo de api/config/mcp-tools.js (nombre, qué hace y plan mínimo).
const CAPABILITIES: { icon: string; title: string; text: string; tools: string[]; plan: Plan; prompt: string }[] = [
    {
        icon: 'token',
        title: 'Consultar BEZ-Coin y mercado',
        text: 'Precio, supply y datos del token. Desde Creator Pro, precios del oráculo por cadena y en tiempo real.',
        tools: ['bezhas_token_info', 'bezhas_token_price', 'bezhas_oracle_prices'],
        plan: 'Starter',
        prompt: '¿A cuánto está BEZ-Coin ahora y de dónde sale el precio?',
    },
    {
        icon: 'swap_horiz',
        title: 'Cotizar intercambios y liquidez',
        text: 'Cuánto recibirías en un swap y el estado del pool antes de decidir nada.',
        tools: ['bezhas_dex_quote', 'bezhas_dex_pool'],
        plan: 'Creator Pro',
        prompt: 'Cotízame 5.000 BEZ a USDT y dime cuánta liquidez hay en el pool.',
    },
    {
        icon: 'lan',
        title: 'Red y contratos',
        text: 'Salud de la red, bloques y el catálogo de contratos desplegados con sus direcciones.',
        tools: ['bezhas_network_stats', 'bezhas_contracts_list'],
        plan: 'Starter',
        prompt: '¿Cómo está la red ahora mismo? Lista los contratos del núcleo.',
    },
    {
        icon: 'edit_document',
        title: 'Preparar operaciones con fondos',
        text: 'La IA deja la operación preparada, simulada y evaluada. Una persona de tu equipo la aprueba con su firma.',
        tools: ['bezhas_tx_prepare'],
        plan: 'Creator Pro',
        prompt: 'Prepara un pago de 250 BEZ al proveedor habitual para la factura 2026-118.',
    },
    {
        icon: 'track_changes',
        title: 'Seguir el estado de cada operación',
        text: 'Pendiente de aprobación, aprobada, enviada o confirmada: sin abrir otro panel.',
        tools: ['bezhas_tx_status'],
        plan: 'Creator Pro',
        prompt: '¿En qué estado está el pago que preparamos esta mañana?',
    },
    {
        icon: 'calculate',
        title: 'Saber el coste antes de actuar',
        text: 'Cuánto cuesta una operación con las mismas tarifas con las que se factura, y qué pagarías de verdad con tu plan.',
        tools: ['bezhas_cost_estimate'],
        plan: 'Starter',
        prompt: '¿Cuánto nos costarían 50 tareas de marketing en OPERANT y comprar 500 USD de BEZ?',
    },
    {
        icon: 'workspace_premium',
        title: 'Tu suscripción y consumo',
        text: 'Qué incluye tu plan, qué módulos tienes activos y qué te falta para lo que quieres hacer.',
        tools: ['bezhas_subscription'],
        plan: 'Starter',
        prompt: 'Dime mi plan y qué herramientas de BeZhas tengo disponibles.',
    },
];

const ROADMAP = [
    { icon: 'point_of_sale', label: 'Cobros con BEZ-Pay' },
    { icon: 'savings', label: 'Staking' },
    { icon: 'alt_route', label: 'Bridges' },
    { icon: 'apartment', label: 'Tokenización de activos' },
    { icon: 'inventory_2', label: 'Tu ERP (SAP, Odoo) · Business+' },
];

type ClientId = 'claude' | 'chatgpt' | 'claude-code' | 'codex' | 'gemini' | 'ide' | 'api';

const CLIENTS: {
    id: ClientId;
    name: string;
    icon: string;
    auth: string;
    steps?: string[];
    code?: { label: string; lang: string; value: string }[];
    note?: string;
}[] = [
    {
        id: 'claude',
        name: 'Claude',
        icon: 'forum',
        auth: 'OAuth · sin api-key',
        steps: [
            'En Claude (web o escritorio) abre Ajustes → Conectores.',
            'Pulsa «Añadir conector personalizado». Nombre: BeZhas.',
            `Pega la URL del servidor: ${MCP_URL}`,
            'Pulsa «Conectar», inicia sesión con tu cuenta de BeZhas y elige la organización.',
            'Autoriza. BeZhas aparece en tus conectores y ya puedes pedírselo en cualquier chat.',
        ],
        note: 'La disponibilidad de conectores personalizados depende de tu plan de Claude.',
    },
    {
        id: 'chatgpt',
        name: 'ChatGPT',
        icon: 'chat',
        auth: 'OAuth · sin api-key',
        steps: [
            'En ChatGPT abre Ajustes → Aplicaciones y conectores → Avanzado y activa el modo desarrollador.',
            'Crea un conector nuevo. Nombre: BeZhas.',
            `URL del servidor MCP: ${MCP_URL} · Autenticación: OAuth.`,
            'Guarda, inicia sesión con tu cuenta de BeZhas y elige la organización.',
            'Activa el conector desde el menú «+» de la conversación.',
        ],
        note: 'El modo desarrollador y las acciones de escritura dependen de tu plan de ChatGPT (Business, Enterprise o Edu). En otros planes puede quedar limitado a consulta.',
    },
    {
        id: 'claude-code',
        name: 'Claude Code',
        icon: 'terminal',
        auth: 'OAuth o api-key',
        code: [
            { label: 'Con OAuth (recomendado)', lang: 'bash', value: `claude mcp add --transport http bezhas ${MCP_URL}` },
            { label: 'Con api-key', lang: 'bash', value: `claude mcp add --transport http bezhas ${MCP_URL} \\\n  --header "x-api-key: $BEZHAS_API_KEY"` },
        ],
        note: 'Con OAuth, escribe /mcp dentro de Claude Code para autorizar la conexión.',
    },
    {
        id: 'codex',
        name: 'Codex',
        icon: 'code_blocks',
        auth: 'OAuth o api-key',
        code: [
            { label: '~/.codex/config.toml — con OAuth', lang: 'toml', value: `[mcp_servers.bezhas]\nurl = "${MCP_URL}"` },
            { label: '~/.codex/config.toml — con api-key (desde una variable de entorno)', lang: 'toml', value: `[mcp_servers.bezhas]\nurl = "${MCP_URL}"\nenv_http_headers = { "x-api-key" = "BEZHAS_API_KEY" }` },
        ],
        note: 'La configuración la comparten Codex CLI, la extensión de IDE y la app de escritorio.',
    },
    {
        id: 'gemini',
        name: 'Gemini · Antigravity',
        icon: 'auto_awesome',
        auth: 'OAuth o api-key',
        code: [
            { label: 'Gemini CLI — ~/.gemini/settings.json', lang: 'json', value: `{\n  "mcpServers": {\n    "bezhas": { "httpUrl": "${MCP_URL}" }\n  }\n}` },
            { label: 'Antigravity — mcp_config.json (Gestionar servidores MCP → ver configuración)', lang: 'json', value: `{\n  "mcpServers": {\n    "bezhas": { "serverUrl": "${MCP_URL}" }\n  }\n}` },
        ],
        note: 'Si tu versión usa otro nombre de campo para la URL, el valor es siempre el mismo endpoint.',
    },
    {
        id: 'ide',
        name: 'Cursor · VS Code',
        icon: 'integration_instructions',
        auth: 'OAuth o api-key',
        code: [
            { label: 'Cursor — ~/.cursor/mcp.json', lang: 'json', value: `{\n  "mcpServers": {\n    "bezhas": { "url": "${MCP_URL}" }\n  }\n}` },
            { label: 'VS Code — .vscode/mcp.json', lang: 'json', value: `{\n  "servers": {\n    "bezhas": { "type": "http", "url": "${MCP_URL}" }\n  }\n}` },
        ],
    },
    {
        id: 'api',
        name: 'Agente propio',
        icon: 'smart_toy',
        auth: 'api-key',
        code: [
            {
                label: 'MCP estándar sobre HTTP — sirve para n8n, LangChain, el SDK de Anthropic u OpenAI',
                lang: 'bash',
                value: `curl -X POST ${MCP_URL} \\\n  -H "x-api-key: $BEZHAS_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -H "Accept: application/json, text/event-stream" \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`,
            },
        ],
        note: 'No hay SDK que instalar. Guarda la api-key en una variable de entorno o un gestor de secretos, nunca en el repositorio.',
    },
];

// Espejo de api/config/plans.js + api/config/plan-entitlements.js.
const PLANS: {
    name: Plan;
    profile: string;
    price: string;
    period: string;
    yearly?: string;
    highlight?: boolean;
    cta: { label: string; href: string };
    features: string[];
}[] = [
    {
        name: 'Starter',
        profile: 'Autónomos y startups',
        price: '0 €',
        period: 'sin cuota · pago por uso',
        cta: { label: 'Empezar 15 días gratis', href: '/register' },
        features: [
            '5 herramientas de consulta, incluido el coste antes de actuar',
            '30 llamadas MCP por minuto',
            '150 acciones de IA al mes',
            'Dato de mercado con 15 min de retraso',
            'Sin operaciones con fondos',
        ],
    },
    {
        name: 'Creator Pro',
        profile: 'Pymes y creadores',
        price: '99 €',
        period: '/ mes',
        yearly: '990 € / año',
        cta: { label: 'Contratar Creator Pro', href: '/register' },
        features: [
            'Las 11 herramientas, incluido preparar operaciones',
            '120 llamadas MCP por minuto',
            '1.500 acciones de IA al mes',
            'Mercado en tiempo real',
            'Operaciones de hasta 1.000 € con aprobación',
            '25 % de gas subvencionado',
        ],
    },
    {
        name: 'Business',
        profile: 'Empresas en crecimiento',
        price: '499 €',
        period: '/ mes',
        yearly: '4.990 € / año',
        highlight: true,
        cta: { label: 'Contratar Business', href: '/register' },
        features: [
            'Todo lo de Creator Pro',
            '600 llamadas MCP por minuto',
            '15.000 acciones de IA al mes',
            'Zero-retention: no guardamos tus conversaciones',
            'Oráculo por cadena e histórico de mercado',
            'Operaciones de hasta 10.000 € · retirada a FIAT',
            'Conector ERP gestionado y Edge Node',
        ],
    },
    {
        name: 'Enterprise VIP',
        profile: 'Holdings e instituciones',
        price: '2.499 €',
        period: '/ mes',
        yearly: '24.990 € / año',
        cta: { label: 'Hablar con ventas', href: `mailto:${SALES_EMAIL}?subject=BeZhas%20MCP%20Enterprise%20VIP` },
        features: [
            'Todo lo de Business',
            '1.200 llamadas MCP por minuto',
            'Acciones de IA sin límite y agentes en paralelo',
            'Residencia de datos dedicada',
            'Operaciones de hasta 100.000 € · todos los carriles FIAT',
            'Nodos Enterprise dedicados',
        ],
    },
];

const RESOURCES: { group: string; items: { label: string; desc: string; href: string; icon: string; external?: boolean }[] }[] = [
    {
        group: 'Integrar',
        items: [
            { label: 'Referencia de API', desc: 'Gateway REST, autenticación y errores', href: '/docs/api-reference', icon: 'api' },
            { label: 'Webhooks', desc: 'Eventos de pago firmados y reintentos', href: '/docs/webhooks', icon: 'webhook' },
            { label: 'SDK e integraciones', desc: 'Conecta tus sistemas sin Solidity', href: '/docs/sdk-integraciones', icon: 'integration_instructions' },
            { label: 'RPC y endpoints', desc: 'Redes, chain IDs y nodos', href: '/docs/rpc-endpoints', icon: 'lan' },
            { label: 'Guía MCP', desc: 'Cómo encaja MCP en la arquitectura', href: '/docs/mcp', icon: 'account_tree' },
            { label: 'Developer Portal', desc: 'SDK, Apps Nativas y plantillas', href: '/developers', icon: 'code' },
        ],
    },
    {
        group: 'Pagar y operar',
        items: [
            { label: 'Planes y suscripción', desc: 'Qué incluye cada plan en el MCP', href: '#planes', icon: 'workspace_premium' },
            { label: 'BEZ-Pay', desc: 'Cobros FIAT y cripto con checkout alojado', href: '/payments', icon: 'point_of_sale' },
            { label: 'Comprar BEZ-Coin', desc: 'Packs con tarjeta y pago en BEZ (−20 %)', href: '/token/buy', icon: 'shopping_cart' },
            { label: 'BEZ-Coin', desc: 'Utilidad, staking y tokenomics', href: '/token', icon: 'token' },
            { label: 'Pagos y gas', desc: 'Idempotencia, comisiones y gas sin coste', href: '/docs/pagos-y-gas', icon: 'local_gas_station' },
            { label: 'Conectar tu ERP', desc: 'Webhook de ERP y WordPress', href: '/onboarding/erp-webhook', icon: 'inventory_2' },
        ],
    },
    {
        group: 'Cuenta y ayuda',
        items: [
            { label: 'Crear cuenta', desc: 'Starter con 15 días gratis', href: '/register', icon: 'person_add' },
            { label: 'Iniciar sesión', desc: 'Accede a tu panel', href: '/login', icon: 'login' },
            { label: 'Seguridad', desc: 'Buenas prácticas y modelo de amenazas', href: '/docs/seguridad', icon: 'shield' },
            { label: 'OPERANT', desc: 'Agentes de IA por departamento', href: '/docs/operant', icon: 'groups' },
            { label: 'Estado de la red', desc: 'TPS, latencia y nodos', href: '/network', icon: 'sensors' },
            { label: 'Soporte', desc: 'Centro de ayuda y Telegram', href: '/support', icon: 'support_agent' },
        ],
    },
];

const BENEFITS = [
    { icon: 'bolt', title: 'Sin cambiar de herramienta', text: 'Tu equipo sigue en Claude, ChatGPT o su editor. Nada que aprender, nada que instalar en su equipo.' },
    { icon: 'draw', title: 'La IA nunca firma sola', text: 'El agente prepara; una persona aprueba con su firma. La clave de firma vive en un firmante aislado al que la IA no llega.' },
    { icon: 'tune', title: 'Tu plan manda, no el prompt', text: 'La IA solo ve las herramientas que tu plan y tus permisos incluyen. Lo que no te corresponde no existe para ella.' },
    { icon: 'fact_check', title: 'Todo queda registrado', text: 'Cada llamada se audita en un registro encadenado que se ancla en la blockchain. Nadie puede reescribirlo después.' },
    { icon: 'lock', title: 'Privacidad por plan', text: 'Zero-retention desde Business. Tus datos llegan a la IA marcados como datos, no como instrucciones.' },
    { icon: 'hub', title: 'Un conector para todas las IA', text: 'Estándar abierto MCP con OAuth 2.1 y PKCE. La IA que uses mañana se conecta igual que la de hoy.' },
];

const SECURITY_STEPS = ['Identidad', 'Plan y permisos', 'Política', 'Riesgo', 'Simulación', 'Aprobación humana', 'Firmante aislado'];

const FAQS: { q: string; a: React.ReactNode }[] = [
    {
        q: '¿Qué es BeZhas MCP?',
        a: <>Es el conector oficial de BeZhas basado en el Model Context Protocol, el estándar abierto que permite a las IA consultar datos reales y actuar sobre ellos. Conecta tu cuenta de BeZhas —BEZ-Coin, red, contratos, suscripción y operaciones— con la IA que ya usas, dentro de la misma conversación.</>,
    },
    {
        q: '¿Con qué IA funciona?',
        a: <>Con Claude, ChatGPT, Claude Code, Codex, Gemini CLI, Antigravity, Cursor, VS Code y cualquier agente propio que hable MCP por HTTP. Es un único endpoint para todas: <code className="text-[var(--mcp-accent)]">{MCP_URL}</code>.</>,
    },
    {
        q: '¿Necesito ser desarrollador?',
        a: <>No. En Claude y ChatGPT se añade como conector: pegas la URL, inicias sesión con tu cuenta de BeZhas y autorizas. Sin api-keys ni ficheros de configuración. Las opciones con api-key son para equipos técnicos y agentes propios.</>,
    },
    {
        q: '¿Qué plan necesito? ¿Tiene coste adicional?',
        a: <>No hay suscripción aparte para el MCP: está incluido en tu plan de BeZhas y lo que puede hacer tu IA es exactamente lo que incluye tu plan. Starter empieza con 15 días gratis y después se paga por uso. Consulta la <a href="#planes" className="text-[var(--mcp-accent)] underline">comparativa de planes</a>.</>,
    },
    {
        q: '¿Puede la IA mover mis fondos?',
        a: <>No por su cuenta. La IA puede <strong>preparar</strong> una operación: BeZhas la valida, la simula, evalúa el riesgo y aplica tus límites. Para ejecutarla hace falta la firma de una persona autorizada de tu equipo (dos firmas por encima del umbral de tu plan). Ninguna herramienta del MCP firma ni envía dinero.</>,
    },
    {
        q: '¿Qué pasa con mis datos?',
        a: <>En Starter y Creator Pro se recoge telemetría de uso seudonimizada (desactivable en Creator Pro); el contenido de tus operaciones no se usa para entrenar. Desde Business, zero-retention: no se conserva nada más allá de prestar el servicio. Enterprise VIP añade residencia dedicada.</>,
    },
    {
        q: '¿OAuth o api-key? ¿Qué diferencia hay?',
        a: <>Con OAuth, una persona autoriza el conector desde su navegador y la IA recibe un permiso de corta duración que puedes revocar en cualquier momento; es lo recomendado para Claude, ChatGPT y los editores. La api-key es para agentes propios y automatizaciones sin navegador: guárdala siempre en un gestor de secretos.</>,
    },
    {
        q: '¿Hay un entorno de pruebas?',
        a: <>Sí. Al pedir credenciales para tu IA puedes elegir <strong>pruebas (sandbox)</strong> o producción. Empieza siempre por pruebas: pasar a producción es cambiar de credencial, no rehacer la integración.</>,
    },
    {
        q: '¿Cómo pago mi suscripción o compro BEZ-Coin?',
        a: <>Con tarjeta o SEPA a través de <Link href="/payments" className="text-[var(--mcp-accent)] underline">BEZ-Pay</Link>, o con BEZ-Coin con un 20 % de descuento. Los packs de BEZ-Coin se compran en <Link href="/token/buy" className="text-[var(--mcp-accent)] underline">Comprar BEZ-Coin</Link>; los BEZ se entregan cuando el pago está confirmado.</>,
    },
    {
        q: '¿Cómo recibo avisos de mis pagos en mi sistema?',
        a: <>Registra un webhook con tu api-key y BeZhas te enviará eventos firmados como <code className="text-[var(--mcp-accent)]">payment.settled</code> o <code className="text-[var(--mcp-accent)]">payment.refunded</code>, con reintentos automáticos. Tienes la guía completa en <Link href="/docs/webhooks" className="text-[var(--mcp-accent)] underline">Webhooks</Link>.</>,
    },
    {
        q: '¿Cómo retiro el acceso a mi IA?',
        a: <>Desconecta BeZhas desde los conectores de tu IA: el permiso deja de funcionar. Si una organización o una clave se desactiva en BeZhas, cualquier permiso emitido para ella deja de valer al momento, aunque no haya caducado.</>,
    },
    {
        q: 'Aún no soy cliente. ¿Puede darme de alta mi propia IA?',
        a: <>Sí. Conecta el servidor de alta <code className="text-[var(--mcp-accent)]">{MCP_ONBOARDING_URL}</code> (no necesita cuenta) y pídele a tu IA que te recomiende un plan y empiece el alta. Lo sensible —aceptar condiciones, datos bancarios, recoger credenciales— siempre lo haces tú en una pantalla segura de BeZhas, nunca en el chat.</>,
    },
];

function CopyButton({ value, label = 'Copiar' }: { value: string; label?: string }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch {
            setCopied(false);
        }
    };
    return (
        <button
            type="button"
            onClick={copy}
            aria-label={`${label}: ${value}`}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/75 hover:text-white hover:border-tertiary/60 transition-colors"
        >
            <span className="material-symbols-outlined text-sm">{copied ? 'check' : 'content_copy'}</span>
            <span aria-live="polite">{copied ? 'Copiado' : label}</span>
        </button>
    );
}

// Siempre sobre fondo oscuro, en ambos temas: es un terminal, y así el código
// mantiene el contraste y el botón de copiar se lee igual.
function CodeBlock({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border border-white/10 bg-[#0b1418] overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-white/10">
                <span className={`text-[10px] uppercase tracking-widest truncate ${styles.codeLabel}`}>{label}</span>
                <CopyButton value={value} />
            </div>
            <pre className={`px-4 py-3 text-xs font-mono overflow-x-auto whitespace-pre ${styles.code}`}><code>{value}</code></pre>
        </div>
    );
}

function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
    return (
        <div className="max-w-3xl mb-10">
            <div className="text-[10px] tracking-[0.4em] uppercase text-[var(--mcp-accent)] font-bold mb-3">{eyebrow}</div>
            <h2 className="text-3xl md:text-5xl font-black italic tracking-tighter uppercase leading-none mb-4">{title}</h2>
            {text && <p className="text-[var(--mcp-dim)] leading-relaxed">{text}</p>}
        </div>
    );
}

const PLAN_BADGE: Record<Plan, string> = {
    Starter: 'bg-emerald-400/15 border-emerald-500/40',
    'Creator Pro': 'bg-primary/15 border-primary/40',
    Business: 'bg-secondary/15 border-secondary/40',
    'Enterprise VIP': 'bg-amber-300/15 border-amber-500/40',
};

export default function McpPage() {
    const [active, setActive] = useState<ClientId>('claude');
    const client = CLIENTS.find((c) => c.id === active) ?? CLIENTS[0];

    const goConnect = (id: ClientId) => {
        setActive(id);
        document.getElementById('conectar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div className={`max-w-7xl mx-auto ${styles.page}`}>
            {/* ── Hero ─────────────────────────────────────────────── */}
            <section className="relative overflow-hidden rounded-2xl border border-[var(--mcp-line)] px-6 sm:px-10 py-16 md:py-24 mb-6">
                <div className="absolute inset-0 bezhas-grid opacity-40 pointer-events-none" />
                <div className={`absolute -top-24 -left-24 w-96 h-96 bg-primary/30 blur-[120px] pointer-events-none ${styles.glow}`} />
                <div className={`absolute -bottom-24 -right-24 w-96 h-96 bg-tertiary/20 blur-[120px] pointer-events-none ${styles.glow}`} />
                <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                    <div className="lg:col-span-7">
                        <div className="inline-flex items-center gap-2 bg-[var(--mcp-card)] border border-[var(--mcp-line)] px-3 py-1 rounded-full mb-6">
                            <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
                            <span className="text-[10px] tracking-[0.3em] uppercase text-[var(--mcp-accent)] font-bold">BeZhas MCP · Model Context Protocol</span>
                        </div>
                        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black italic tracking-tighter uppercase leading-[0.95] mb-6">
                            Opera BeZhas <span className="text-[var(--mcp-accent)]">desde tu IA.</span>
                        </h1>
                        <p className="text-lg md:text-xl text-[var(--mcp-dim)] leading-relaxed max-w-2xl mb-8">
                            Consulta BEZ-Coin, prepara pagos, sigue operaciones y gestiona tu suscripción desde Claude, ChatGPT, Codex, Gemini o Cursor.
                            BeZhas sigue siendo tu sistema de registro; tu chat es donde se hace el trabajo.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 mb-8">
                            <a href="#conectar" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-[#ffffff] text-sm font-bold uppercase tracking-widest rounded-xl shadow-[0_0_30px_rgba(13,51,242,0.45)] hover:brightness-110 active:scale-95 transition-all">
                                <span className="material-symbols-outlined text-lg">cable</span>
                                Conectar mi IA
                            </a>
                            <Link href="/register" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[var(--mcp-card)] border border-[var(--mcp-line)] text-[var(--mcp-text)] text-sm font-bold uppercase tracking-widest rounded-xl hover:border-tertiary/50 active:scale-95 transition-all">
                                Crear cuenta · 15 días gratis
                            </Link>
                        </div>
                        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0b1418] px-4 py-3 max-w-xl">
                            <span className={`hidden sm:inline text-[10px] uppercase tracking-widest shrink-0 ${styles.codeLabel}`}>Servidor MCP</span>
                            <code className={`flex-1 min-w-0 truncate text-xs sm:text-sm font-mono ${styles.code}`}>{MCP_URL}</code>
                            <CopyButton value={MCP_URL} />
                        </div>
                    </div>

                    {/* Ejemplo de conversación */}
                    <div className="lg:col-span-5">
                        <div className="glass-panel rounded-2xl border border-[var(--mcp-line)] p-5 shadow-[0_0_60px_rgba(34,211,238,0.08)]">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[10px] uppercase tracking-widest text-[var(--mcp-mut)]">Ejemplo de conversación</span>
                                <span className="text-[10px] uppercase tracking-widest text-[var(--mcp-accent)]">BeZhas conectado</span>
                            </div>
                            <div className="space-y-3 text-sm">
                                <div className="ml-auto max-w-[85%] rounded-xl rounded-br-sm bg-primary/25 border border-primary/30 px-4 py-3">
                                    Prepara el pago de 250 BEZ al proveedor de la factura 2026-118 y dime si necesita aprobación.
                                </div>
                                <div className="rounded-lg border border-[var(--mcp-line)] bg-[var(--mcp-card)] px-3 py-2 font-mono text-[11px] text-[var(--mcp-mut)]">
                                    <span className="text-[var(--mcp-accent)]">→ bezhas_tx_prepare</span> · simulado · riesgo bajo
                                </div>
                                <div className="max-w-[92%] rounded-xl rounded-bl-sm bg-[var(--mcp-card)] border border-[var(--mcp-line)] px-4 py-3 text-[var(--mcp-dim)]">
                                    Listo: pago preparado y simulado, destino verificado y dentro de tu límite. Queda <strong className="text-[var(--mcp-text)]">pendiente de aprobación</strong>: una persona autorizada de tu equipo tiene que firmarla antes de que se ejecute.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Chips de confianza + navegación interna ─────────── */}
            <nav aria-label="En esta página" className="sticky top-20 z-20 mb-16 rounded-xl border border-[var(--mcp-line)] bg-[var(--mcp-nav-bg)] backdrop-blur-md px-3 py-2 flex gap-1 overflow-x-auto">
                {[
                    ['#que-hace', 'Qué puede hacer'],
                    ['#conectar', 'Conectar'],
                    ['#planes', 'Planes'],
                    ['#beneficios', 'Beneficios'],
                    ['#recursos', 'Enlaces'],
                    ['#faq', 'Preguntas'],
                ].map(([href, label]) => (
                    <a key={href} href={href} className="shrink-0 px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest text-[var(--mcp-dim)] hover:text-[var(--mcp-text)] hover:bg-[var(--mcp-card)] transition-colors">
                        {label}
                    </a>
                ))}
            </nav>

            {/* ── Problema → solución ─────────────────────────────── */}
            <section className="mb-24 grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { icon: 'lock_person', title: 'OAuth 2.1 + PKCE', text: 'Autorizas con tu cuenta de BeZhas. Sin claves pegadas en el chat.' },
                    { icon: 'draw', title: 'La IA nunca firma', text: 'Todo lo que mueve valor necesita la firma de una persona.' },
                    { icon: 'verified', title: 'MiCA · DAC8 · RGPD', text: 'Diseñado para operar dentro del marco europeo.' },
                ].map((c) => (
                    <div key={c.title} className="flex gap-4 items-start rounded-xl border border-[var(--mcp-line)] bg-[var(--mcp-card)] p-5">
                        <span className="material-symbols-outlined text-[var(--mcp-accent)] text-2xl">{c.icon}</span>
                        <div>
                            <div className="font-bold uppercase tracking-tight text-[var(--mcp-text)] mb-1">{c.title}</div>
                            <p className="text-sm text-[var(--mcp-dim)]">{c.text}</p>
                        </div>
                    </div>
                ))}
            </section>

            {/* ── Qué puede hacer ─────────────────────────────────── */}
            <section id="que-hace" className="mb-24 scroll-mt-40">
                <SectionTitle
                    eyebrow="Toda tu operativa, una conversación"
                    title="Lo que tu IA puede hacer en BeZhas"
                    text="Tu equipo ya usa la IA para investigar y planificar. Con BeZhas MCP también puede consultar la red y dejar preparadas las operaciones, sin cambiar de pestaña ni copiar datos a mano."
                />
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {CAPABILITIES.map((c) => (
                        <div key={c.title} className="group rounded-xl border border-[var(--mcp-line)] bg-[var(--mcp-card-strong)] p-6 flex flex-col hover:border-tertiary/40 transition-colors">
                            <div className="flex items-start justify-between gap-3 mb-5">
                                <div className="h-11 w-11 rounded-lg bg-tertiary/10 flex items-center justify-center text-[var(--mcp-accent)]">
                                    <span className="material-symbols-outlined">{c.icon}</span>
                                </div>
                                <span className={`text-[9px] font-bold uppercase tracking-widest border rounded-full px-2 py-1 text-[var(--mcp-text)] ${PLAN_BADGE[c.plan]}`}>
                                    Desde {c.plan}
                                </span>
                            </div>
                            <h3 className="text-lg font-black italic uppercase tracking-tight mb-2">{c.title}</h3>
                            <p className="text-sm text-[var(--mcp-dim)] leading-relaxed mb-5">{c.text}</p>
                            <div className="mt-auto rounded-lg bg-[var(--mcp-card)] border border-[var(--mcp-line)] p-3">
                                <div className="text-[9px] uppercase tracking-widest text-[var(--mcp-mut)] mb-1">Pídeselo así</div>
                                <p className="text-sm text-[var(--mcp-dim)] italic">“{c.prompt}”</p>
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {c.tools.map((t) => (
                                        <code key={t} className="text-[10px] font-mono text-[var(--mcp-accent)] bg-tertiary/5 rounded px-1.5 py-0.5">{t}</code>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-6 rounded-xl border border-dashed border-[var(--mcp-line)] p-5 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="shrink-0">
                        <div className="text-[10px] uppercase tracking-[0.3em] text-amber-200 font-bold">En construcción</div>
                        <div className="text-sm text-[var(--mcp-dim)]">Próximas herramientas, siempre con aprobación humana:</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {ROADMAP.map((r) => (
                            <span key={r.label} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--mcp-line)] bg-[var(--mcp-card)] px-3 py-1.5 text-xs text-[var(--mcp-dim)]">
                                <span className="material-symbols-outlined text-sm text-[var(--mcp-mut)]">{r.icon}</span>
                                {r.label}
                            </span>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Conectar ────────────────────────────────────────── */}
            <section id="conectar" className="mb-24 scroll-mt-40">
                <SectionTitle
                    eyebrow="Empieza en tres pasos"
                    title="Conecta BeZhas a tu IA"
                    text="Un solo servidor MCP para todas las IA. Elige la tuya y sigue las instrucciones."
                />

                <ol className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                    {[
                        { n: '01', title: 'Crea tu cuenta', text: 'Regístrate en BeZhas. Starter incluye 15 días gratis; puedes cambiar de plan cuando quieras.', link: { href: '/register', label: 'Crear cuenta' } },
                        { n: '02', title: 'Conecta tu IA', text: 'Añade BeZhas como conector o pega la configuración en tu editor. Tienes las instrucciones justo debajo.', link: null },
                        { n: '03', title: 'Autoriza y trabaja', text: 'Inicia sesión con tu cuenta de BeZhas, elige la organización y pídele a tu IA: «Dime mi plan y qué herramientas de BeZhas tengo».', link: null },
                    ].map((s) => (
                        <li key={s.n} className="rounded-xl border border-[var(--mcp-line)] bg-[var(--mcp-card)] p-6">
                            <div className="text-3xl font-black italic text-primary mb-3">{s.n}</div>
                            <div className="font-bold uppercase tracking-tight text-[var(--mcp-text)] mb-2">{s.title}</div>
                            <p className="text-sm text-[var(--mcp-dim)] leading-relaxed">{s.text}</p>
                            {s.link && (
                                <Link href={s.link.href} className="mt-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-[var(--mcp-accent)] hover:text-[var(--mcp-text)] transition-colors">
                                    {s.link.label} <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                </Link>
                            )}
                        </li>
                    ))}
                </ol>

                <div className="rounded-2xl border border-[var(--mcp-line)] bg-[var(--mcp-card-strong)] overflow-hidden">
                    <div role="tablist" aria-label="Elige tu IA" className="flex gap-1 overflow-x-auto md:flex-wrap md:overflow-visible border-b border-[var(--mcp-line)] p-2">
                        {CLIENTS.map((c) => (
                            <button
                                key={c.id}
                                role="tab"
                                type="button"
                                aria-selected={active === c.id}
                                aria-controls={`panel-${c.id}`}
                                id={`tab-${c.id}`}
                                onClick={() => setActive(c.id)}
                                className={`shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
                                    active === c.id ? 'bg-primary text-[#ffffff]' : 'text-[var(--mcp-dim)] hover:text-[var(--mcp-text)] hover:bg-[var(--mcp-card)]'
                                }`}
                            >
                                <span className="material-symbols-outlined text-base">{c.icon}</span>
                                {c.name}
                            </button>
                        ))}
                    </div>
                    <div role="tabpanel" id={`panel-${client.id}`} aria-labelledby={`tab-${client.id}`} className="p-6 md:p-8">
                        <div className="flex flex-wrap items-center gap-3 mb-6">
                            <h3 className="text-2xl font-black italic uppercase tracking-tight">{client.name}</h3>
                            <span className="text-[10px] font-bold uppercase tracking-widest border border-tertiary/30 text-[var(--mcp-accent)] rounded-full px-2.5 py-1">{client.auth}</span>
                        </div>
                        {client.steps && (
                            <ol className="space-y-3 mb-6">
                                {client.steps.map((s, i) => (
                                    <li key={s} className="flex gap-3 text-sm text-[var(--mcp-dim)]">
                                        <span className="shrink-0 w-6 h-6 rounded-full border border-[var(--mcp-line)] text-[11px] font-bold flex items-center justify-center text-[var(--mcp-dim)]">{i + 1}</span>
                                        <span className="pt-0.5 leading-relaxed">{s}</span>
                                    </li>
                                ))}
                            </ol>
                        )}
                        {client.steps && (
                            <div className="mb-6">
                                <CodeBlock label="URL del servidor MCP" value={MCP_URL} />
                            </div>
                        )}
                        {client.code && (
                            <div className="space-y-4 mb-6">
                                {client.code.map((c) => <CodeBlock key={c.label} label={c.label} value={c.value} />)}
                            </div>
                        )}
                        {client.note && (
                            <p className="text-xs text-[var(--mcp-mut)] flex gap-2">
                                <span className="material-symbols-outlined text-sm text-[var(--mcp-mut)]">info</span>
                                {client.note}
                            </p>
                        )}
                    </div>
                </div>

                <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-[var(--mcp-line)] bg-[var(--mcp-card)] p-6">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-[var(--mcp-accent)]">person_add</span>
                            <div className="font-bold uppercase tracking-tight">¿Aún no eres cliente?</div>
                        </div>
                        <p className="text-sm text-[var(--mcp-dim)] mb-4">
                            Conecta el servidor de alta (sin cuenta) y pídele a tu IA que te recomiende un plan y empiece el registro. Lo sensible lo completas tú en una pantalla segura de BeZhas.
                        </p>
                        <CodeBlock label="Servidor MCP de alta" value={MCP_ONBOARDING_URL} />
                    </div>
                    <div className="rounded-xl border border-[var(--mcp-line)] bg-[var(--mcp-card)] p-6">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-[var(--mcp-accent)]">shield_lock</span>
                            <div className="font-bold uppercase tracking-tight">Buenas prácticas la primera semana</div>
                        </div>
                        <ul className="text-sm text-[var(--mcp-dim)] space-y-2">
                            <li>· Empieza en <strong className="text-[var(--mcp-text)]">sandbox</strong>: datos sintéticos, sin coste.</li>
                            <li>· Deja las herramientas en confirmación manual hasta conocer su comportamiento.</li>
                            <li>· Nunca marques «permitir siempre» en una herramienta que prepara operaciones.</li>
                            <li>· Nombra a dos personas para aprobar operaciones, con suplente.</li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* ── Planes ──────────────────────────────────────────── */}
            <section id="planes" className="mb-24 scroll-mt-40">
                <SectionTitle
                    eyebrow="Incluido en tu suscripción"
                    title="Qué incluye cada plan"
                    text="El MCP no tiene suscripción aparte: lo que puede hacer tu IA es exactamente lo que incluye tu plan. Precios sin IVA."
                />
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                    {PLANS.map((p) => (
                        <div
                            key={p.name}
                            className={`relative rounded-2xl border p-6 flex flex-col ${
                                p.highlight ? 'border-tertiary/60 bg-tertiary/[0.04] shadow-[0_0_40px_rgba(34,211,238,0.12)]' : 'border-[var(--mcp-line)] bg-[var(--mcp-card-strong)]'
                            }`}
                        >
                            {p.highlight && (
                                <span className="absolute -top-3 left-6 text-[9px] font-bold uppercase tracking-widest bg-tertiary text-[#000000] rounded-full px-2.5 py-1">
                                    Más completo para empresas
                                </span>
                            )}
                            <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--mcp-mut)] mb-1">{p.profile}</div>
                            <h3 className="text-xl font-black italic uppercase tracking-tight mb-4">{p.name}</h3>
                            <div className="mb-1 flex items-baseline gap-2">
                                <span className="text-4xl font-black tracking-tighter">{p.price}</span>
                                <span className="text-xs text-[var(--mcp-mut)]">{p.period}</span>
                            </div>
                            <div className="text-xs text-[var(--mcp-mut)] mb-6 min-h-[16px]">{p.yearly ? `o ${p.yearly} (2 meses gratis)` : '15 días gratis, luego por consumo'}</div>
                            <ul className="space-y-2.5 mb-8 text-sm">
                                {p.features.map((f) => (
                                    <li key={f} className="flex gap-2 text-[var(--mcp-dim)]">
                                        <span className="material-symbols-outlined text-base text-[var(--mcp-accent)]">check</span>
                                        <span>{f}</span>
                                    </li>
                                ))}
                            </ul>
                            <a
                                href={p.cta.href}
                                className={`mt-auto inline-flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                                    p.highlight ? 'bg-tertiary text-[#000000] hover:brightness-110' : 'bg-primary text-[#ffffff] hover:brightness-110'
                                }`}
                            >
                                {p.cta.label}
                            </a>
                        </div>
                    ))}
                </div>
                <div className="mt-6 flex flex-col md:flex-row gap-3 md:items-center justify-between rounded-xl border border-[var(--mcp-line)] bg-[var(--mcp-card)] p-5">
                    <p className="text-sm text-[var(--mcp-dim)]">
                        Paga con tarjeta o SEPA mediante <Link href="/payments" className="text-[var(--mcp-accent)] underline">BEZ-Pay</Link>, o con
                        <strong className="text-[var(--mcp-text)]"> BEZ-Coin y ahorra un 20 %</strong>.
                    </p>
                    <div className="flex gap-2">
                        <Link href="/token/buy" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-[#ffffff] text-xs font-bold uppercase tracking-widest hover:brightness-110">
                            <span className="material-symbols-outlined text-base">shopping_cart</span> Comprar BEZ-Coin
                        </Link>
                        <Link href="/payments" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--mcp-line)] text-[var(--mcp-dim)] text-xs font-bold uppercase tracking-widest hover:text-[var(--mcp-text)] hover:border-tertiary/50">
                            BEZ-Pay
                        </Link>
                    </div>
                </div>
            </section>

            {/* ── Beneficios ──────────────────────────────────────── */}
            <section id="beneficios" className="mb-24 scroll-mt-40">
                <SectionTitle eyebrow="Por qué BeZhas MCP" title="Beneficios para tu empresa" />
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-10">
                    {BENEFITS.map((b) => (
                        <div key={b.title} className="rounded-xl border border-[var(--mcp-line)] bg-[var(--mcp-card)] p-6">
                            <span className="material-symbols-outlined text-3xl text-[var(--mcp-accent)] mb-4 block">{b.icon}</span>
                            <h3 className="font-black italic uppercase tracking-tight text-lg mb-2">{b.title}</h3>
                            <p className="text-sm text-[var(--mcp-dim)] leading-relaxed">{b.text}</p>
                        </div>
                    ))}
                </div>
                <div className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-6 md:p-8">
                    <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--mcp-accent)] font-bold mb-2">Así se protege cada operación</div>
                    <p className="text-sm text-[var(--mcp-dim)] mb-6 max-w-3xl">
                        Antes de que una operación preparada por tu IA pueda ejecutarse, atraviesa estos controles. Si uno falla, se detiene; y el firmante vuelve a comprobarlo todo por su cuenta.
                    </p>
                    <ol className="flex flex-wrap items-center gap-2">
                        {SECURITY_STEPS.map((s, i) => (
                            <li key={s} className="flex items-center gap-2">
                                <span className="rounded-lg border border-[var(--mcp-line)] bg-[var(--mcp-card)] px-3 py-2 text-xs font-bold uppercase tracking-wider text-[var(--mcp-dim)]">{s}</span>
                                {i < SECURITY_STEPS.length - 1 && <span className="material-symbols-outlined text-sm text-[var(--mcp-mut)]">chevron_right</span>}
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            {/* ── Recursos / enlaces directos ─────────────────────── */}
            <section id="recursos" className="mb-24 scroll-mt-40">
                <SectionTitle
                    eyebrow="Todo lo que necesitas, enlazado"
                    title="Enlaces directos"
                    text="API, webhooks, suscripción, BEZ-Pay, compra de BEZ-Coin y soporte, en un solo sitio."
                />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {RESOURCES.map((g) => (
                        <div key={g.group}>
                            <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--mcp-mut)] font-bold mb-3">{g.group}</div>
                            <div className="space-y-2">
                                {g.items.map((it) => (
                                    <Link
                                        key={it.label}
                                        href={it.href}
                                        className="group flex items-center gap-4 rounded-xl border border-[var(--mcp-line)] bg-[var(--mcp-card)] p-4 hover:border-tertiary/40 hover:bg-[var(--mcp-card)] transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[var(--mcp-accent)]">{it.icon}</span>
                                        <span className="flex-1 min-w-0">
                                            <span className="block text-sm font-bold text-[var(--mcp-text)]">{it.label}</span>
                                            <span className="block text-xs text-[var(--mcp-mut)] truncate">{it.desc}</span>
                                        </span>
                                        <span className="material-symbols-outlined text-sm text-[var(--mcp-mut)] group-hover:text-[var(--mcp-accent)] group-hover:translate-x-0.5 transition-all">arrow_forward</span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-6 rounded-xl border border-[var(--mcp-line)] bg-[var(--mcp-card)] p-5">
                    <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--mcp-mut)] font-bold mb-3">Para equipos técnicos · descubrimiento OAuth</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <CodeBlock label="Servidor de autorización" value={`${MCP_ORIGIN}/.well-known/oauth-authorization-server`} />
                        <CodeBlock label="Recurso protegido" value={`${MCP_ORIGIN}/.well-known/oauth-protected-resource`} />
                    </div>
                </div>
            </section>

            {/* ── FAQ ─────────────────────────────────────────────── */}
            <section id="faq" className="mb-24 scroll-mt-40">
                <SectionTitle eyebrow="Preguntas frecuentes" title="Lo que suelen preguntarnos" />
                <div className="divide-y divide-[var(--mcp-line)] rounded-2xl border border-[var(--mcp-line)] bg-[var(--mcp-card-strong)]">
                    {FAQS.map((f) => (
                        <details key={f.q} className="group px-6 py-5">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-[var(--mcp-text)]">
                                <span>{f.q}</span>
                                <span className="material-symbols-outlined text-[var(--mcp-mut)] transition-transform group-open:rotate-45">add</span>
                            </summary>
                            <div className="pt-3 text-sm text-[var(--mcp-dim)] leading-relaxed max-w-3xl">{f.a}</div>
                        </details>
                    ))}
                </div>
            </section>

            {/* ── CTA final ───────────────────────────────────────── */}
            <section className="relative overflow-hidden rounded-2xl border border-tertiary/30 px-6 py-16 text-center mb-10">
                <div className="absolute inset-0 bezhas-grid opacity-30 pointer-events-none" />
                <div className="relative max-w-3xl mx-auto">
                    <h2 className="text-3xl md:text-5xl font-black italic tracking-tighter uppercase mb-4">
                        Tu IA ya sabe trabajar. <span className="text-[var(--mcp-accent)]">Dale acceso a BeZhas.</span>
                    </h2>
                    <p className="text-[var(--mcp-dim)] mb-8">
                        Conecta la IA que tu equipo ya usa y empieza en sandbox hoy mismo.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <a href="#conectar" onClick={() => goConnect('claude')} className="inline-flex items-center justify-center gap-2 px-6 py-4 bg-primary text-[#ffffff] text-xs font-bold uppercase tracking-widest rounded-xl hover:brightness-110">
                            Conectar a Claude
                        </a>
                        <a href="#conectar" onClick={() => goConnect('chatgpt')} className="inline-flex items-center justify-center gap-2 px-6 py-4 bg-primary text-[#ffffff] text-xs font-bold uppercase tracking-widest rounded-xl hover:brightness-110">
                            Conectar a ChatGPT
                        </a>
                        <a href="#conectar" onClick={() => goConnect('codex')} className="inline-flex items-center justify-center gap-2 px-6 py-4 border border-[var(--mcp-line)] text-[var(--mcp-text)] text-xs font-bold uppercase tracking-widest rounded-xl hover:border-tertiary/50">
                            Codex · Gemini · Cursor
                        </a>
                    </div>
                </div>
            </section>

            <p className="text-[11px] text-[var(--mcp-mut)] leading-relaxed max-w-4xl mx-auto text-center pb-6">
                Las funciones marcadas como «En construcción» todavía no están disponibles. Límites, herramientas y precios dependen del plan contratado y pueden cambiar;
                los precios no incluyen IVA. BEZ-Coin es un token de utilidad de la plataforma BeZhas y no constituye un producto de inversión.
                Claude, ChatGPT, Codex, Gemini, Antigravity, Cursor y VS Code son marcas de sus respectivos titulares.
            </p>
        </div>
    );
}
