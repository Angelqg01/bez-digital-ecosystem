// portalData.js — datos del Portal Integrado (diseño "Cyber-Pipeline").
//
// Fuente única de los enlaces/servicios que muestra el portal rediseñado.
// TODO enlace es REAL: deep-link a la SubApp en producción (config/subappUrls.js)
// o ruta interna del propio Hub. No hay placeholders.

import {
  Ship, Wallet, Landmark, Bolt, BadgeCheck, ScanLine, Network, Eye,
  Fuel, Globe2, CreditCard, ShoppingBag, ShieldCheck, Boxes,
  LineChart, Cpu, BookOpen, LifeBuoy,
} from 'lucide-react';
import { subappUrl } from '../../config/subappUrls';

/**
 * @typedef {Object} PortalLink
 * @property {string} id
 * @property {string} name
 * @property {string} desc
 * @property {import('lucide-react').LucideIcon} icon
 * @property {string} href      URL absoluta (SubApp) o ruta interna ('/...')
 * @property {boolean} external true → abre en nueva pestaña (SubApp)
 * @property {'active'|'syncing'|'core'} status
 */

const ext = (app, sub = '') => ({ href: subappUrl(app, sub), external: true });
const internal = (path) => ({ href: path, external: false });

// ── Módulos núcleo (grid del Dashboard) ──────────────────────────────────────
/** @type {PortalLink[]} */
export const CORE_MODULES = [
  { id: 'cargolink', name: 'CargoLink', desc: 'Logística y aduanas', icon: Ship,       status: 'active',  ...ext('cargolink') },
  { id: 'wallet',    name: 'Wallet',    desc: 'Custodia BEZ',        icon: Wallet,     status: 'core',    ...ext('wallet') },
  { id: 'capital',   name: 'Capital',   desc: 'DeFi y tesorería',    icon: Landmark,   status: 'active',  ...ext('capital') },
  { id: 'energy',    name: 'Energy',    desc: 'VPP · OMIE',          icon: Bolt,       status: 'active',  ...ext('energy') },
  { id: 'prestige',  name: 'Prestige',  desc: 'Club B2B verificado', icon: BadgeCheck, status: 'active',  ...ext('prestige') },
  { id: 'purescan',  name: 'PureScan',  desc: 'Compliance y auditoría', icon: ScanLine, status: 'active', ...ext('purescan') },
  { id: 'genesis',   name: 'Genesis',   desc: 'ERP y onboarding',    icon: Network,    status: 'active',  ...ext('genesis') },
  { id: 'vision',    name: 'Vision',    desc: 'Trazabilidad IA',     icon: Eye,        status: 'active',  ...ext('vision') },
];

// ── Matriz de Servicios (explorador completo) ────────────────────────────────
/** @type {PortalLink[]} */
export const SERVICE_MATRIX = [
  { id: 'pay',        name: 'BeZhas Pay',        desc: 'Cobros y pagos fiat/cripto, on-ramp y liquidación.', icon: CreditCard, status: 'active',  ...internal('/pay') },
  { id: 'cargolink',  name: 'BZ CargoLink',      desc: 'B-UID, POS bridge, IoT y manifiestos aduaneros.',    icon: Ship,        status: 'active',  ...ext('cargolink') },
  { id: 'capital',    name: 'BZ Capital · DeFi', desc: 'Staking, farming, liquidez y tesorería.',            icon: Landmark,    status: 'active',  ...ext('capital') },
  { id: 'energy',     name: 'BeZhas Energy',     desc: 'Virtual Power Plant y mercado energético OMIE.',      icon: Bolt,        status: 'active',  ...ext('energy') },
  { id: 'purescan',   name: 'BZ PureScan',       desc: 'Verificación de socios, certificados y auditoría.',   icon: ShieldCheck, status: 'active',  ...ext('purescan') },
  { id: 'prestige',   name: 'BZ Prestige',       desc: 'Networking B2B y directorio verificado.',            icon: BadgeCheck,  status: 'active',  ...ext('prestige') },
  { id: 'vision',     name: 'BEZ Vision Scan',   desc: 'Trazabilidad de activos por visión artificial + IA.', icon: Eye,        status: 'active',  ...ext('vision') },
  { id: 'genesis',    name: 'BZ Genesis',        desc: 'Gestión empresarial integral, ERP-bridge.',          icon: Network,     status: 'active',  ...ext('genesis') },
  { id: 'gas',        name: 'Gas Tank Manager',  desc: 'Gas abstraction, paymaster y predicción Aegis ML.',   icon: Fuel,        status: 'active',  ...ext('gas') },
  { id: 'edge',       name: 'Edge Node Manager', desc: 'Nodos DePIN, validadores y recompensas de red.',      icon: Cpu,         status: 'syncing', ...ext('edge') },
  { id: 'sphere',     name: 'BZ Sphere',         desc: 'Espacio colaborativo y datos compartidos.',          icon: Globe2,      status: 'active',  ...ext('sphere') },
  { id: 'marketplace',name: 'Marketplace & RWA', desc: 'Activos del mundo real y servicios tokenizados.',     icon: ShoppingBag, status: 'active',  ...internal('/rwa') },
  { id: 'oracle',     name: 'Data Oracle',       desc: 'Oráculo de datos y precios on-chain.',               icon: LineChart,   status: 'active',  ...internal('/oracle') },
  { id: 'compliance', name: 'Compliance',        desc: 'Panel MiCA · AEAT · DAC8 y reporting.',              icon: ShieldCheck, status: 'active',  ...internal('/compliance') },
  { id: 'docs',       name: 'API & SDK Docs',    desc: 'Referencia técnica, webhooks y contratos.',          icon: BookOpen,    status: 'core',    ...internal('/docs') },
  { id: 'dev',        name: 'Developer Console',  desc: 'API keys, integraciones y herramientas SDK.',        icon: Boxes,       status: 'core',    ...internal('/developer-console') },
];

// ── Mensajes del feed de red (preview) ───────────────────────────────────────
export const NETWORK_FEED = [
  {
    id: 'evt-743', icon: 'verified', tone: 'cyan', title: 'Contract Executed', when: 'Just now',
    body: 'Smart contract #743 validado entre Empresa X y Proveedor Y. Sin disputas detectadas.',
    hash: '0x8F…42b',
  },
  {
    id: 'evt-upg', icon: 'sync', tone: 'cyan', title: 'Protocol Upgrade Pending', when: '2h ago',
    body: 'Actualización programada para el bloque 1.540.200. Optimiza el throughput cross-chain.',
  },
  {
    id: 'evt-lat', icon: 'alert', tone: 'orange', title: 'High Latency Detected', when: '5h ago',
    body: 'Pico temporal de latencia en el segmento europeo. Resolución en progreso, sin pérdida de datos.',
  },
];

export const NETWORK_HEALTH = { activeNodes: '1,204', tps: '3,450', uptime: '99.99%' };

export const CONTACT = {
  email: 'info.bezcoin@bezhas.com',
  social: '@BeZhas',
  supportHref: '/docs', // centro de ayuda / documentación interna
};
