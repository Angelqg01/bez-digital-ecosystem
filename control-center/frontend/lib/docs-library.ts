/**
 * lib/docs-library.ts
 * Registro de la biblioteca de documentacion publica de BeZhas.
 *
 * IMPORTANTE — POLITICA DE PUBLICACION
 * Solo se listan aqui documentos aptos para consumo publico. Queda excluido de
 * forma explicita todo lo que comprometa la seguridad o la privacidad de la
 * plataforma: credenciales, claves, runbooks de infraestructura, arquitectura
 * interna de seguridad, informes financieros internos, material comercial de
 * inversores, prompts operativos y guias de despliegue en la nube.
 *
 * Cualquier documento nuevo se anade a DOC_LIBRARY y su .md a content/docs/.
 * Si un documento contiene datos internos, NO se anade: se resume una version
 * publica o se deja fuera.
 */

import fs from 'node:fs';
import path from 'node:path';
import { renderMarkdown, type DocHeading } from './markdown';

export interface DocEntry {
    slug: string;
    title: string;
    description: string;
    category: DocCategory;
    icon: string;
    /** Nivel orientativo para quien entra por primera vez. */
    level: 'Básico' | 'Intermedio' | 'Avanzado';
}

export type DocCategory =
    | 'Empezar'
    | 'Integración'
    | 'Token y tokenización'
    | 'Red e infraestructura'
    | 'Referencia';

export const DOC_CATEGORIES: { id: DocCategory; icon: string; blurb: string }[] = [
    {
        id: 'Empezar',
        icon: 'rocket_launch',
        blurb: 'Qué es BeZhas y cómo hacer tu primera llamada.',
    },
    {
        id: 'Integración',
        icon: 'integration_instructions',
        blurb: 'API, SDK, RPC y contratos para conectar tus sistemas.',
    },
    {
        id: 'Token y tokenización',
        icon: 'token',
        blurb: 'BEZ-Coin, tokenizar activos reales, NFT y pagos.',
    },
    {
        id: 'Red e infraestructura',
        icon: 'hub',
        blurb: 'Nodos, validadores, staking, gobernanza y puentes.',
    },
    {
        id: 'Referencia',
        icon: 'menu_book',
        blurb: 'Seguridad, whitepaper, glosario y preguntas frecuentes.',
    },
];

export const DOC_LIBRARY: DocEntry[] = [
    // ─── Empezar ───────────────────────────────────────────────────────────
    {
        slug: 'introduccion',
        title: 'Introducción a BeZhas',
        description:
            'Arquitectura en capas, redes soportadas y las tres formas de usar el protocolo.',
        category: 'Empezar',
        icon: 'explore',
        level: 'Básico',
    },
    {
        slug: 'primeros-pasos',
        title: 'Primeros pasos',
        description:
            'Requisitos, instalación del SDK y tu primera lectura on-chain en cinco pasos.',
        category: 'Empezar',
        icon: 'play_circle',
        level: 'Básico',
    },

    // ─── Integración ───────────────────────────────────────────────────────
    {
        slug: 'api-reference',
        title: 'Referencia de API',
        description:
            'Gateway unificado: wallet, staking, gobernanza, bridge y endpoints sectoriales.',
        category: 'Integración',
        icon: 'api',
        level: 'Intermedio',
    },
    {
        slug: 'sdk-integraciones',
        title: 'SDK e integraciones',
        description:
            'Uso de @bezhas/sdk, ethers, escucha de eventos y patrón de integración con un ERP.',
        category: 'Integración',
        icon: 'download',
        level: 'Intermedio',
    },
    {
        slug: 'operant',
        title: 'OPERANT — gestión empresarial autónoma',
        description:
            'Los 10 departamentos de agentes IA: qué incluye cada plan, cómo lanzar tareas, aprobaciones humanas y auditoría anclada en L2.',
        category: 'Integración',
        icon: 'smart_toy',
        level: 'Intermedio',
    },
    {
        slug: 'rpc-endpoints',
        title: 'RPC y endpoints',
        description:
            'Chain IDs, métodos JSON-RPC, conexión con ethers y viem, y añadir la red a la wallet.',
        category: 'Integración',
        icon: 'lan',
        level: 'Intermedio',
    },
    {
        slug: 'smart-contracts',
        title: 'Smart contracts y ABIs',
        description:
            'Catálogo completo de contratos del núcleo y de los 16 sectores, con acceso a ABIs.',
        category: 'Integración',
        icon: 'description',
        level: 'Avanzado',
    },
    {
        slug: 'mcp',
        title: 'MCP — Model Context Protocol',
        description:
            'Orquestación multi-agente entre empresas y el patrón seguro para dispositivos IoT.',
        category: 'Integración',
        icon: 'account_tree',
        level: 'Avanzado',
    },

    // ─── Token y tokenización ──────────────────────────────────────────────
    {
        slug: 'bez-coin',
        title: 'BEZ-Coin: el token nativo',
        description:
            'Supply, roles, delegación de voto, permit y la semántica real de burn en BEZCoinV2.',
        category: 'Token y tokenización',
        icon: 'paid',
        level: 'Básico',
    },
    {
        slug: 'tokenizacion-activos',
        title: 'Tokenización de activos',
        description:
            'Elegir estándar, heredar de BEZSectorStandard, escrow, metadatos y errores comunes.',
        category: 'Token y tokenización',
        icon: 'inventory_2',
        level: 'Intermedio',
    },
    {
        slug: 'nft-y-sbt',
        title: 'NFT y credenciales SBT',
        description:
            'NFT industriales vs credenciales no transferibles, emisión, metadatos y catálogo.',
        category: 'Token y tokenización',
        icon: 'style',
        level: 'Intermedio',
    },
    {
        slug: 'pagos-y-gas',
        title: 'Pagos y gas',
        description:
            'BeZhasPayment, idempotencia por orderId, comisiones y transacciones sin gas.',
        category: 'Token y tokenización',
        icon: 'payments',
        level: 'Intermedio',
    },

    // ─── Red e infraestructura ─────────────────────────────────────────────
    {
        slug: 'nodos-enterprise-edge',
        title: 'Nodos Enterprise y Edge',
        description:
            'Crear y operar un nodo: configuración, arranque, endpoints y endurecimiento.',
        category: 'Red e infraestructura',
        icon: 'dns',
        level: 'Avanzado',
    },
    {
        slug: 'validadores-staking',
        title: 'Validadores y staking',
        description:
            'Tiers, boosts, unbonding de 7 días, recompensas DePIN y reglas de slashing.',
        category: 'Red e infraestructura',
        icon: 'verified_user',
        level: 'Avanzado',
    },
    {
        slug: 'gobernanza-dao',
        title: 'Gobernanza DAO',
        description:
            'Parámetros del Governor, delegación de voto, ciclo de una propuesta y timelock.',
        category: 'Red e infraestructura',
        icon: 'how_to_vote',
        level: 'Intermedio',
    },
    {
        slug: 'puentes-cross-chain',
        title: 'Puentes cross-chain',
        description:
            'Rutas disponibles, mecanismo de bloqueo y acuñación, y riesgos a comunicar.',
        category: 'Red e infraestructura',
        icon: 'alt_route',
        level: 'Avanzado',
    },

    // ─── Referencia ────────────────────────────────────────────────────────
    {
        slug: 'seguridad',
        title: 'Seguridad y buenas prácticas',
        description:
            'Reglas absolutas, gestión de secretos, privacidad RGPD y reporte de vulnerabilidades.',
        category: 'Referencia',
        icon: 'shield',
        level: 'Básico',
    },
    {
        slug: 'whitepaper',
        title: 'Whitepaper (resumen técnico)',
        description:
            'Tesis, arquitectura, economía del token, gobernanza y marco regulatorio.',
        category: 'Referencia',
        icon: 'article',
        level: 'Básico',
    },
    {
        slug: 'faq',
        title: 'Preguntas frecuentes',
        description:
            'Dudas reales de integración: errores 401, OrderAlreadyProcessed, supply, unbonding.',
        category: 'Referencia',
        icon: 'help',
        level: 'Básico',
    },
    {
        slug: 'glosario',
        title: 'Glosario',
        description:
            'Términos del protocolo explicados: DePIN, SBT, slashing, timelock, bps y más.',
        category: 'Referencia',
        icon: 'menu_book',
        level: 'Básico',
    },
    {
        slug: 'comunidad',
        title: 'Comunidad y soporte',
        description:
            'Canales, acceso de desarrollador, contribución y documentación bajo acuerdo.',
        category: 'Referencia',
        icon: 'groups',
        level: 'Básico',
    },
];

const CONTENT_DIR = path.join(process.cwd(), 'content', 'docs');

export function getDocEntry(slug: string): DocEntry | undefined {
    return DOC_LIBRARY.find((d) => d.slug === slug);
}

export function getDocsByCategory(category: DocCategory): DocEntry[] {
    return DOC_LIBRARY.filter((d) => d.category === category);
}

export interface LoadedDoc {
    entry: DocEntry;
    html: string;
    headings: DocHeading[];
    /** Minutos estimados de lectura, redondeado al alza. */
    readingMinutes: number;
}

/**
 * Carga y renderiza un documento. Se ejecuta en build (generateStaticParams),
 * por lo que el acceso a disco no ocurre en tiempo de peticion.
 */
export function loadDoc(slug: string): LoadedDoc | null {
    const entry = getDocEntry(slug);
    if (!entry) return null;

    // El slug siempre procede de DOC_LIBRARY, nunca directamente de la URL.
    const file = path.join(CONTENT_DIR, `${entry.slug}.md`);
    if (!fs.existsSync(file)) return null;

    const source = fs.readFileSync(file, 'utf8');
    const { html, headings } = renderMarkdown(source);
    const words = source.split(/\s+/).filter(Boolean).length;

    return {
        entry,
        html,
        headings,
        readingMinutes: Math.max(1, Math.ceil(words / 220)),
    };
}

/** Documento anterior y siguiente segun el orden de la biblioteca. */
export function getDocNeighbours(slug: string): {
    prev: DocEntry | null;
    next: DocEntry | null;
} {
    const index = DOC_LIBRARY.findIndex((d) => d.slug === slug);
    if (index === -1) return { prev: null, next: null };
    return {
        prev: index > 0 ? DOC_LIBRARY[index - 1] : null,
        next: index < DOC_LIBRARY.length - 1 ? DOC_LIBRARY[index + 1] : null,
    };
}
