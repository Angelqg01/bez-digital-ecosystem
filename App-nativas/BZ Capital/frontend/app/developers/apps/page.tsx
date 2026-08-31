import React from 'react';
import {
    Beaker,
    CodeSquare,
    Home,
    Map,
    ShieldCheck,
    Truck,
    Wrench,
} from 'lucide-react';
import AppCard from '../../../components/AppCard';
import SectorCard from '../../../components/SectorCard';

const appsInDevelopment = [
    {
        sector: '1. Sector Logística y Transporte',
        icon: <Truck className="w-6 h-6 text-blue-500" />,
        apps: [
            {
                name: 'BeZhas Cargo Fingerprint',
                function: 'App para operarios de almacén que utiliza Visión Artificial (algoritmo SIFT y métricas SSIM/MSE) para escanear palés y crear una "Huella Dactilar Visual" o "Golden Image". Bloquea pagos en el smart contract si hay daños.',
                tags: ['Visión Artificial', 'Smart Contracts']
            },
            {
                name: 'BeZhas Smart Stowage',
                function: 'Utiliza ARCore y Gemini Vision para escanear volúmenes 3D en contenedores marítimos. Calcula el centro de gravedad (COG) y advierte con Realidad Aumentada si hay inestabilidad.',
                tags: ['ARCore', 'Gemini Vision', '3D']
            },
            {
                name: 'BeZhas Customs Sync',
                function: 'Transforma datos volumétricos a JSON/XML y los enruta automáticamente a sistemas aduaneros (ASYCUDA World / SIMPLE) para liquidación sin fricción.',
                tags: ['Logística', 'Aduanas', 'Datos']
            }
        ]
    },
    {
        sector: '2. Sector Automoción y Seguros',
        icon: <ShieldCheck className="w-6 h-6 text-blue-500" />,
        apps: [
            {
                name: 'BeZhas Auto-Appraiser',
                function: 'La IA analiza videos de coches para flotas/seguros, localiza daños y emite reportes. Conectado a un "Quality Oracle" para liberar depósitos en Escrow instantáneamente si no hay daños.',
                tags: ['IA', 'Escrow', 'Seguros']
            }
        ]
    },
    {
        sector: '3. Sector Inmobiliario y Hotelería',
        icon: <Home className="w-6 h-6 text-blue-500" />,
        apps: [
            {
                name: 'BeZhas Space Mapper',
                function: 'Usa API de Profundidad Geoespacial para escanear y generar mapas 3D de locales/habitaciones. Facilita "Check-in/Check-out" automatizado en hoteles.',
                tags: ['3D Mapping', 'Gemelos Digitales']
            },
            {
                name: 'BeZhas RWA Tokenizer',
                function: 'Tokenización de propiedades físicas en fracciones bajo el estándar ERC-3643, cobrando dividendos mensuales directos en la wallet BeZhas.',
                tags: ['RWA', 'ERC-3643', 'Inversión']
            }
        ]
    },
    {
        sector: '4. Sector Retail y Lujo',
        icon: <Map className="w-6 h-6 text-blue-500" />,
        apps: [
            {
                name: 'BeZhas Authenticator',
                function: 'Escaner para artículos de lujo que recupera el NFT inmutable que certifica su origen. Facilita reventa y regalías automáticas para creadores.',
                tags: ['NFT', 'Retail', 'Trazabilidad']
            }
        ]
    },
    {
        sector: '5. Sector Industrial y Robótica',
        icon: <Wrench className="w-6 h-6 text-blue-500" />,
        apps: [
            {
                name: 'BeZhas Predictive Maintenance',
                function: 'Detecta micro-vibraciones y desgaste de engranajes mediante flujo óptico. El MCP se conecta al ERP para pedir repuestos automáticamente.',
                tags: ['IoT', 'Mantenimiento Predictivo']
            }
        ]
    },
    {
        sector: '6. Sector Agroalimentario y Salud',
        icon: <Beaker className="w-6 h-6 text-blue-500" />,
        apps: [
            {
                name: 'BeZhas Food Oracle',
                function: 'Escanea frutas/vegetales para calcular biomasa, nutrición y señales fúngicas. Paraliza pagos a proveedores defectuosos inmediatamente.',
                tags: ['Agro', 'Oráculo', 'Calidad']
            },
            {
                name: 'BeZhas Bio-Agent',
                function: 'Orquestador biotecnológico para laboratorios. Agentes de IA autónomos (Gemini / Protocolo MCP) que operan plataformas Web3 en segundo plano.',
                tags: ['IA', 'Biotecnología', 'MCP']
            }
        ]
    }
];

const liveApps = [
    {
        id: '11880710874053749561',
        name: 'BeZhas Stitch App 1',
        description: 'Aplicación en vivo conectada a la API de BeZhas. Gestión de transacciones y estados de smart contracts en tiempo real.',
        url: 'https://stitch.withgoogle.com/projects/11880710874053749561'
    },
    {
        id: '1748814075638175899',
        name: 'BeZhas Stitch App 2',
        description: 'Dashboard de monitorización de nodos y liquidación de operaciones en la L2 de BeZhas.',
        url: 'https://stitch.withgoogle.com/projects/1748814075638175899'
    },
    {
        id: '1346082238094736459',
        name: 'BeZhas Stitch App 3',
        description: 'Interfaz de interacción DeFi y Oráculos, utilizando el ecosistema de BeZcoin.',
        url: 'https://stitch.withgoogle.com/projects/1346082238094736459'
    },
    {
        id: '3596731133041282362',
        name: 'BeZhas Stitch App 4',
        description: 'Herramienta de desarrollador para la creación visual de contratos inteligentes.',
        url: 'https://stitch.withgoogle.com/projects/3596731133041282362'
    },
    {
        id: '17204754316042250875',
        name: 'BeZhas Stitch App 5',
        description: 'Aplicación de trazabilidad de RWA utilizando la red BeZhas Edge.',
        url: 'https://stitch.withgoogle.com/projects/17204754316042250875'
    },
    {
        id: '4220044291862618733',
        name: 'BeZhas Stitch App 6',
        description: 'Plataforma administrativa y sincronización de identidades on-chain.',
        url: 'https://stitch.withgoogle.com/projects/4220044291862618733'
    }
];

export default function DevelopersAppsPage() {
    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 p-8 sm:p-12 lg:p-20">

            {/* Hero Section */}
            <section className="mb-16 text-center max-w-4xl mx-auto">
                <h1 className="text-5xl font-extrabold text-blue-900 mb-6 tracking-tight">
                    BeZhas Ecosystem Apps & SDK
                </h1>
                <p className="text-xl text-gray-600">
                    Descubre el conjunto de aplicaciones conectadas a la sección Developer y API de BeZhas.
                    Explora las herramientas operativas en vivo y el ambicioso roadmap de desarrollo para sectores estratégicos.
                </p>
            </section>

            {/* Live Apps Section */}
            <section className="mb-20">
                <div className="flex items-center gap-3 mb-8 border-b pb-4 border-gray-200">
                    <CodeSquare className="w-8 h-8 text-green-600" />
                    <h2 className="text-3xl font-bold text-gray-800">Live Apps (Integradas vía Stitch / API)</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {liveApps.map((app) => (
                        <AppCard
                            key={app.id}
                            id={app.id}
                            name={app.name}
                            description={app.description}
                            url={app.url}
                        />
                    ))}
                </div>
            </section>

            {/* Apps in Development Section */}
            <section>
                <div className="flex items-center gap-3 mb-10 border-b pb-4 border-gray-200">
                    <Wrench className="w-8 h-8 text-orange-500" />
                    <h2 className="text-3xl font-bold text-gray-800">Aplicaciones en Desarrollo</h2>
                </div>

                <div className="space-y-12">
                    {appsInDevelopment.map((sectorObj, idx) => (
                        <SectorCard
                            key={idx}
                            sector={sectorObj.sector}
                            icon={sectorObj.icon}
                            apps={sectorObj.apps}
                        />
                    ))}
                </div>
            </section>
        </div>
    );
}
