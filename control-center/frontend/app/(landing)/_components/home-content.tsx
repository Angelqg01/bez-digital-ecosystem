/**
 * Contenido de la Landing Home.
 *
 * Fuente: `Landing Nueva/Nueva landing 2.html`, contrastado contra el repo antes
 * de publicarse. Los 35 contratos citados en `verticals` existen en
 * `smart-contracts/src/`; chainId 2708 sale de `deploy-config.json`; el supply
 * de 3.000 M lo verifica `api/__tests__/integration/live-chain.test.js`.
 *
 * No se cita ERC-3643: no hay ni un contrato en el repo que lo implemente, y una
 * afirmacion de cumplimiento sin codigo detras no deberia ir en portada.
 */

import type { ReactNode } from 'react';
import type { AnchorPill } from './AnchorPanel';
import type { ChainStep } from './EvidenceChain';
import type { Control } from './SecurityControls';
import type { LogoGroup } from './IntegrationsWall';
import type { Resource } from './ResourceCards';
import type { StatItem } from './StatGrid';
import type { Vertical } from './VerticalProtocols';
import type { ContractCard } from './OraclePanel';
import s from '../home.module.css';

/* ── Ticker ─────────────────────────────────────────────────────────────── */

export const tickerItems: [string, string][] = [
    ['Red', 'BeZhas L2 · chainId 2708'],
    ['Asentamiento', 'Ethereum L1'],
    ['Supply', '3.000.000.000 BEZ'],
    ['Protocolos', '7 verticales'],
    ['Contratos', '30+ Solidity'],
    ['Puentes', 'Polygon · BNB Chain'],
    ['Cumplimiento', 'MiCA · DAC8 · AEAT'],
    ['Seguridad', 'AEGIS fail-closed'],
];

/* ── Paneles ancla ──────────────────────────────────────────────────────── */

export const missionPills: AnchorPill[] = [
    {
        n: 'Anclar',
        t: 'El evento nace donde ya nace',
        d: 'El ERP no cambia. Se le anade una salida firmada.',
    },
    {
        n: 'Validar',
        t: 'Nadie firma su propia prueba',
        d: 'Esquema, politica y oraculo se comprueban antes de escribir.',
    },
    {
        n: 'Probar',
        t: 'La evidencia sobrevive a las partes',
        d: 'Exportable por el auditor aunque la relacion comercial termine.',
    },
];

export const aegisPills: AnchorPill[] = [
    {
        n: 'Ante la duda',
        t: 'Se detiene, no se arriesga',
        d: 'Oraculo obsoleto o contradictorio: el pago automatico no sale.',
    },
    {
        n: 'Ante el incidente',
        t: 'Se pausa por capas',
        d: 'Primero las escrituras, despues la liquidacion. La lectura sigue.',
    },
    {
        n: 'Ante el auditor',
        t: 'Se abre entero',
        d: 'Cada escritura lleva su hash de auditoria enlazado.',
    },
];

/* ── Cadena de evidencia ────────────────────────────────────────────────── */

export const chainSteps: ChainStep[] = [
    {
        n: 'PASO 01',
        title: 'El sistema empresarial emite el evento',
        desc: 'SAP, Odoo, un MES o un IoT de planta publican la operacion tal y como ya la registran. No se cambia el proceso de negocio.',
        tags: ['SAP', 'Odoo', 'MES', 'IoT'],
    },
    {
        n: 'PASO 02',
        title: 'El Edge Node valida antes de firmar',
        desc: 'Comprueba esquema, politica, senales de riesgo de la IA y la evidencia del oraculo. Anonimiza lo que sea dato regulado y solo deja pasar el hash.',
        tags: ['EDGE_NODE_ROLE', 'schema check', 'anonimizacion'],
    },
    {
        n: 'PASO 03',
        title: 'La Smart Wallet aplica la politica',
        desc: 'Limites diarios, permisos de sesion y reglas de paymaster. Una integracion comprometida no puede gastar mas alla de su cupo.',
        tags: ['SmartWalletFactory', 'Paymaster'],
    },
    {
        n: 'PASO 04',
        title: 'MultiSig aprueba lo sensible',
        desc: 'Tesoreria, custodia, alta de oraculos y cambios de administracion exigen firma multiple y timelock. Ninguna clave individual mueve reservas.',
        tags: ['MultiSigWallet', 'timelock', 'TREASURY_ROLE'],
    },
    {
        n: 'PASO 05',
        title: 'El contrato sectorial registra la evidencia',
        desc: 'Hashes, atestaciones, IDs de token, certificados y estados de escrow. Lo que queda escrito es irreversible y no contiene datos personales.',
        tags: ['SupplyTracker', 'QualityCertificateNFT', 'EvidenceVault'],
    },
    {
        n: 'PASO 06',
        title: 'El auditor exporta la prueba',
        desc: 'Dashboards y paquete de evidencia construidos desde los artefactos de despliegue y los logs de eventos. El auditor lee; nunca escribe.',
        tags: ['AUDITOR_ROLE', 'evidence pack', 'ISO / SOC'],
    },
];

export const chainStats: StatItem[] = [
    { to: 7, text: 'protocolos verticales especificados y versionados' },
    { to: 30, suffix: '+', text: 'contratos Solidity en el repositorio del nucleo' },
    { to: 7, text: 'roles de permiso definidos en toda la red' },
    { to: 5, text: 'agentes de IA operando bajo aprobacion humana' },
];

/* ── Protocolos verticales ──────────────────────────────────────────────── */

const ico = (children: ReactNode) => (
    <svg
        className={s.vcardIco}
        viewBox="0 0 40 40"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
    >
        {children}
    </svg>
);

export const verticals: Vertical[] = [
    {
        title: 'Logistica global',
        desc: 'Tokenizacion de SKU, reputacion de proveedor, checkpoints de transporte, despacho aduanero y liquidacion instantanea en puertos y hubs.',
        contracts: (
            <>
                <b>SupplyTracker</b> · WarehouseManager · ProcurementNFT
                <br />
                CustomsClearanceOracle · <b>ClearanceCertificateNFT</b> · QualityEscrow
            </>
        ),
        href: '/commerce',
        icon: ico(
            <>
                <rect x="4" y="14" width="20" height="14" rx="1.5" />
                <path d="M24 19h6l4 5v4h-10z" />
                <circle cx="11" cy="30" r="2.6" />
                <circle cx="28" cy="30" r="2.6" />
                <path d="M8 10h12" />
            </>,
        ),
    },
    {
        title: 'Manufactura industrial',
        desc: 'Gemelos digitales de linea, tokens de planificacion de materiales, mantenimiento predictivo firmado y certificados de calidad con escrow de disputas.',
        contracts: (
            <>
                <b>DigitalTwinRegistry</b> · MaterialTokenMRP
                <br />
                PredictiveMaintenanceLog · <b>QualityCertificateNFT</b>
            </>
        ),
        href: '/solutions',
        icon: ico(
            <>
                <path d="M5 32V17l8 5v-5l8 5v-5l8 5v15z" />
                <path d="M5 32h29" strokeLinecap="round" />
                <circle cx="13" cy="27" r="1.6" />
                <circle cx="21" cy="27" r="1.6" />
                <circle cx="29" cy="27" r="1.6" />
            </>,
        ),
    },
    {
        title: 'RWA, finanzas y fiscalidad',
        desc: 'Catastro y titulos, identidad de flota, factoring de facturas, prestamo con colateral real, tesoreria institucional y paquete de evidencia fiscal.',
        contracts: (
            <>
                <b>LandCadastralRegistry</b> · LandTitleNFT · VehicleIdentityNFT
                <br />
                InvoiceFactoring · MicroLendingPool · <b>TreasuryVault</b>
            </>
        ),
        href: '/financial',
        icon: ico(
            <>
                <path d="M6 33h28M9 33V16l11-8 11 8v17" />
                <path d="M16 33v-9h8v9" />
            </>,
        ),
    },
    {
        title: 'Energia y ESG',
        desc: 'Tokenizacion de activo renovable, mercado P2P de energia, creditos de carbono con evidencia de registro y atestacion de score ESG.',
        contracts: (
            <>
                <b>SolarFarmToken</b> · P2PEnergyMarket
                <br />
                <b>CarbonCreditToken</b> · ESGScoreOracle
            </>
        ),
        href: 'https://bezhas-energy-o5xep6gbwq-ew.a.run.app',
        icon: ico(<path d="M22 4 10 22h9l-2 14 13-19h-9z" strokeLinejoin="round" />),
    },
    {
        title: 'Salud y bio',
        desc: 'Anclaje de historia clinica sin PHI en cadena, mercado de datasets con consentimiento revocable, custodia farmaceutica y escrow asegurador.',
        contracts: (
            <>
                <b>HealthRecordSBT</b> · ClinicalDataMarketplace
                <br />
                PharmaTracker · <b>HealthInsuranceEscrow</b>
            </>
        ),
        href: '/solutions',
        icon: ico(
            <>
                <path
                    d="M20 34S6 26 6 16a7 7 0 0 1 14-2 7 7 0 0 1 14 2c0 10-14 18-14 18z"
                    strokeLinejoin="round"
                />
                <path d="M12 20h5l2-4 3 8 2-4h4" strokeLinecap="round" strokeLinejoin="round" />
            </>,
        ),
    },
    {
        title: 'Seguros y bovedas DeFi',
        desc: 'Poliza como NFT, seguro parametrico con disparador por oraculo, ajuste de siniestros, pool de reaseguro y bovedas con limite de tesoreria.',
        contracts: (
            <>
                <b>PolicyNFT</b> · ParametricInsurance · ClaimAdjuster
                <br />
                <b>ReinsurancePool</b> · StakingPool · TreasuryVault
            </>
        ),
        href: '/financial',
        icon: ico(
            <>
                <path d="M20 5 7 10v10c0 8 6 13 13 15 7-2 13-7 13-15V10z" strokeLinejoin="round" />
                <path d="m14 20 4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
            </>,
        ),
    },
    {
        title: 'Legal, IP y gobierno',
        desc: 'Boveda de evidencia documental, registro de propiedad intelectual, identidad on-chain y gobernanza DAO con voto verificable.',
        contracts: (
            <>
                <b>EvidenceVault</b> · IPRegistryNFT
                <br />
                IdentityRegistry · <b>GovernanceSystem</b>
            </>
        ),
        href: '/enterprise',
        icon: ico(
            <>
                <rect x="6" y="12" width="28" height="20" rx="2" />
                <path d="M6 18h28M14 12V7h12v5" />
                <path d="M17 25h6" strokeLinecap="round" />
            </>,
        ),
    },
    {
        title: 'Modelo de oraculo',
        desc: 'Los oraculos son servicios permisionados hasta que un vertical pueda descentralizarse con seguridad. Todos declaran fuente, esquema, frescura y fallback.',
        contracts: (
            <>
                <b>ORACLE_ROLE</b> · replay protection
                <br />
                confidence score · <b>audit hash</b>
            </>
        ),
        href: '/network',
        icon: ico(
            <>
                <circle cx="20" cy="20" r="14" />
                <path d="M20 6c-4 4-6 9-6 14s2 10 6 14c4-4 6-9 6-14s-2-10-6-14z" />
                <path d="M6.5 20h27" />
            </>,
        ),
    },
];

/* ── AEGIS ──────────────────────────────────────────────────────────────── */

export const securityControls: Control[] = [
    {
        badge: 'Fail-closed',
        title: 'Ventana de frescura y anti-replay',
        desc: 'Cada atestacion declara su antiguedad maxima. Fuera de ventana, el contrato rechaza la escritura en lugar de asumirla valida.',
    },
    {
        badge: 'Contencion',
        title: 'Pausa por capas',
        desc: 'El incidente deshabilita primero las escrituras de oraculo, despues la liquidacion, y mantiene la lectura abierta para no romper la continuidad de auditoria.',
    },
    {
        badge: 'Custodia',
        title: 'Separacion de funciones',
        desc: 'Claves listas para HSM/KMS, MultiSig de tesoreria, timelock en cambios de parametro y runbooks firmados antes de produccion.',
    },
    {
        badge: 'Claves',
        title: 'Revocacion sin redespliegue',
        desc: 'Una clave de oraculo atada a un equipo de planta se revoca sin volver a desplegar el protocolo completo.',
    },
    {
        badge: 'Datos',
        title: 'Lo regulado no toca la cadena',
        desc: 'PHI, PII, facturas comerciales y rutas sensibles permanecen fuera. On-chain solo van hashes irreversibles y referencias no sensibles.',
    },
    {
        badge: 'Normativa',
        title: 'MiCA · DAC8 · AEAT · AML/KYC',
        desc: 'El agente de cumplimiento evalua cada flujo contra el marco europeo y espanol, y el oraculo KYC escribe solo estado de elegibilidad — nunca datos personales.',
    },
    {
        badge: 'IA',
        title: 'Aprobacion humana obligatoria',
        desc: 'Los agentes de trading y de acceso a datasets operan tras puertas de aprobacion, con registro conservado para revision de cumplimiento.',
    },
    {
        badge: 'Evidencia',
        title: 'Paquete post-incidente',
        desc: 'Logs de API, Edge Node, wallet, oraculo e indexador se preservan y se publica la evidencia con direcciones de contrato y hashes afectados.',
    },
];

export const securityStats: StatItem[] = [
    { to: 7, text: 'roles: admin, operador, oraculo, tesoreria, pausa, auditor y edge node' },
    { to: 0, text: 'datos personales escritos en la cadena, por diseno' },
    { label: '2/N', text: 'firmas minimas para cualquier movimiento de tesoreria' },
    { to: 100, suffix: '%', text: 'de las escrituras de oraculo con hash de auditoria enlazado' },
];

/* ── Integraciones ──────────────────────────────────────────────────────── */

export const integrationGroups: LogoGroup[] = [
    {
        label: 'Sistemas empresariales',
        chips: [
            { name: 'SAP', note: 'ERP' },
            { name: 'Odoo', note: 'ERP' },
            { name: 'Salesforce', note: 'CRM' },
            { name: 'MES', note: 'Planta' },
            { name: 'IoT', note: 'Edge' },
            { name: 'MCP', note: 'Nodo dedicado' },
        ],
    },
    {
        label: 'Redes y puentes',
        chips: [
            { name: 'Ethereum', note: 'L1 de asentamiento' },
            { name: 'BeZhas L2', note: 'chainId 2708' },
            { name: 'Polygon', note: 'Bridge activo' },
            { name: 'BNB Chain', note: 'Bridge activo' },
            { name: 'IPFS', note: 'Documentos' },
        ],
    },
];

/* ── Token ──────────────────────────────────────────────────────────────── */

export const tokenFacts: [string, string][] = [
    ['Red de asentamiento', 'Ethereum L1'],
    ['Capa de ejecucion', 'BeZhas L2 · chainId 2708'],
    ['Supply total', '3.000.000.000 BEZ'],
    ['Estandar', 'ERC-20 · BEP-20'],
    ['Puentes', 'Polygon · BNB Chain'],
    ['Gobernanza', 'GovernanceSystem on-chain'],
    ['Marco regulatorio', 'MiCA (UE) · AEAT (ES)'],
];

export const tokenUses: { title: string; text: string }[] = [
    {
        title: 'Gas de la L2.',
        text: 'Cada escritura de evidencia y cada liquidacion se paga en BEZ, con patrocinio via Paymaster para las cuentas empresariales.',
    },
    {
        title: 'Liquidacion entre proveedores.',
        text: 'BeZhasPayment cierra la operacion cuando el comprador acepta; si la calidad se disputa, los fondos van a QualityEscrow.',
    },
    {
        title: 'Acceso al SDK B2B.',
        text: 'La licencia de integracion y los nodos dedicados se activan con token bloqueado o con suscripcion corporativa.',
    },
    {
        title: 'Gobernanza y validacion.',
        text: 'Voto sobre parametros de protocolo, registro de validadores y recompensas de Edge Node (DePIN).',
    },
];

export const BEZ_POLYGON_ADDRESS = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';
export const BEZ_BNB_ADDRESS = '0x8a1e3930fde1f151471c368fdbb39f3f63a65b55';

export const oracleContracts: ContractCard[] = [
    {
        chainId: 137,
        name: 'Polygon',
        address: BEZ_POLYGON_ADDRESS,
        explorerLabel: 'Polygonscan',
        explorerUrl: `https://polygonscan.com/token/${BEZ_POLYGON_ADDRESS}`,
        mark: (
            <svg className={s.ccMark} viewBox="0 0 32 32" aria-hidden="true">
                <path
                    d="M16 3.5 27 10v12l-11 6.5L5 22V10z"
                    fill="none"
                    stroke="#8B5CF6"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                />
                <path d="M16 11.5 21.5 15v6L16 24l-5.5-3v-6z" fill="#8B5CF6" opacity=".85" />
            </svg>
        ),
    },
    {
        chainId: 56,
        name: 'BNB Chain',
        address: BEZ_BNB_ADDRESS,
        explorerLabel: 'BscScan',
        explorerUrl: `https://bscscan.com/token/${BEZ_BNB_ADDRESS}`,
        mark: (
            <svg className={s.ccMark} viewBox="0 0 32 32" aria-hidden="true">
                <path d="M16 4.5 20.2 8.7 16 12.9 11.8 8.7z" fill="#F0B90B" />
                <path d="M23.3 11.8 27.5 16l-4.2 4.2L19.1 16z" fill="#F0B90B" />
                <path d="M8.7 11.8 12.9 16l-4.2 4.2L4.5 16z" fill="#F0B90B" />
                <path d="M16 19.1 20.2 23.3 16 27.5l-4.2-4.2z" fill="#F0B90B" />
                <path d="M16 11.8 20.2 16 16 20.2 11.8 16z" fill="#F0B90B" opacity=".6" />
            </svg>
        ),
    },
];

/* ── Recursos ───────────────────────────────────────────────────────────── */

export const resources: Resource[] = [
    {
        type: 'Whitepaper',
        title: 'Especificacion tecnica BeZhas',
        desc: 'Arquitectura L2, modelo de oraculo y tokenomics completo.',
        cta: 'En preparacion',
    },
    {
        type: 'Control pack',
        title: 'Protocolos verticales CTO/CISO',
        desc: 'Mapa de contratos, permisos, oraculos y estandar de despliegue por sector.',
        href: 'mailto:info.angelqg@gmail.com?subject=BeZhas%20—%20Control%20pack%20CTO/CISO',
        cta: 'Solicitar acceso',
    },
    {
        type: 'Deck',
        title: 'Presentacion enterprise',
        desc: 'Casos de uso, integracion y modelo de suscripcion corporativa.',
        href: 'https://drive.google.com/file/d/10M3q1iUC_vbu8XaCvOGFKg6OYWuKrKQt/view',
        cta: 'Abrir deck',
    },
    {
        type: 'Developer portal',
        title: 'SDK y referencia de API',
        desc: 'Universal Bridge API, esquemas de evento y guia del Edge Node.',
        href: '/developers',
        cta: 'Abrir portal',
    },
];
