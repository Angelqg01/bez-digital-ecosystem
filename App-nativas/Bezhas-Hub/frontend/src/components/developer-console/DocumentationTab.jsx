import React, { useState } from 'react';
import { Terminal as TerminalIcon } from 'lucide-react';
import CodeBlock from './CodeBlock';

// Tab 4: API Documentation (Legacy + New Integrated)
const DocumentationTab = ({ apiKeys, address }) => {
    // State for the legacy API Docs part
    const [selectedEndpoint, setSelectedEndpoint] = useState('logistics');

    const installCode = `pnpm install @bezhas/sdk-core @bezhas/web3-ai`;

    const initCode = `import { BeZhasSDK } from '@bezhas/sdk-core';

// Inicializar con tu API KEY (Esencial para el conteo de Loyalty)
const bezhas = new BeZhasSDK({
  apiKey: '${apiKeys[0]?.key || 'pk_live_bezhas_xyz...'}',
  network: 'mainnet' // o 'testnet'
});`;

    const abiCode = `// 1. Importar ABI Estándar de Industria
import { IndustrialContractABI } from '@bezhas/abis';

// 2. Instanciar Contrato
const contract = bezhas.getContract({
  address: '0x123...',
  abi: IndustrialContractABI
});

// 3. Ejecutar Validación (Cuenta para 'Transactions Per Customer')
const result = await contract.validateOnChain({
  docHash: '0xabc...',
  validatorId: 'ai-verifier-v1'
});`;

    const aiCode = `// Uso de Identity & AI (Genera puntos para Tier Gold/Platinum)
const identityScore = await bezhas.identity.verifyAI({
  userAddress: '${address || '0xUser...'}',
  behaviorGraph: true
});

if(identityScore > 80) {
  console.log("Usuario verificado con Upsell ready");
}`;

    const realEstateCode = `// Ejemplo: Integración con Real Estate Contract
import { RealEstateABI } from '@bezhas/abis';

const realEstate = bezhas.getContract({
  address: '${import.meta.env.VITE_REALESTATE_CONTRACT_ADDRESS || '0xRealEstate...'}',
  abi: RealEstateABI
});

// Crear propiedad con validación on-chain
const property = await realEstate.createProperty({
  location: 'Carrera 7 #32-16, Bogotá',
  price: '250000',
  propertyType: 'apartment',
  verifyWithOracle: true // Activa Quality Oracle
});`;

    const endpoints = {
        logistics: {
            title: 'Logistics API',
            description: 'Gestión de envíos y tracking',
            methods: [
                {
                    method: 'POST',
                    path: '/v1/logistics/shipments',
                    description: 'Crear nuevo envío',
                    params: ['origin', 'destination', 'cargo', 'value']
                },
                {
                    method: 'GET',
                    path: '/v1/logistics/shipments/:id',
                    description: 'Obtener detalles de envío',
                    params: ['id']
                }
            ]
        },
        realestate: {
            title: 'Real Estate API',
            description: 'Tokenización de propiedades',
            methods: [
                {
                    method: 'POST',
                    path: '/v1/realestate/tokenize',
                    description: 'Tokenizar propiedad',
                    params: ['address', 'valuation', 'fractions']
                }
            ]
        },
        payments: {
            title: 'Payments & Escrow API',
            description: 'Pagos y contratos de garantía',
            methods: [
                {
                    method: 'POST',
                    path: '/v1/payments/escrow',
                    description: 'Crear contrato escrow',
                    params: ['amount', 'buyer', 'seller']
                }
            ]
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                    BeZhas SDK Documentation
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
                    Integra infraestructura Blockchain e IA en minutos. Cada llamada te acerca al nivel Platinum.
                </p>

                {/* Sección 1: Instalación */}
                <section className="mb-10">
                    <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <TerminalIcon size={24} className="text-blue-400" />
                        1. Instalación
                    </h3>
                    <CodeBlock title="Bash" code={installCode} />
                </section>

                {/* Sección 2: Inicialización */}
                <section className="mb-10">
                    <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                        2. Inicialización del SDK
                    </h3>
                    <p className="mb-4 text-gray-600 dark:text-gray-400">
                        Es crítico configurar correctamente la <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-sm">apiKey</code> para rastrear tus métricas de uso y asignar recompensas.
                    </p>
                    <CodeBlock title="JavaScript / TypeScript" code={initCode} />
                </section>

                {/* Sección 3: Smart Contracts */}
                <section className="mb-10">
                    <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                        3. Interacción con ABI (Smart Contracts)
                    </h3>
                    <p className="mb-4 text-gray-600 dark:text-gray-400">
                        Utiliza nuestros ABIs pre-optimizados para reducir costos de gas.
                    </p>
                    <CodeBlock title="Contract Interaction" code={abiCode} />
                </section>

                {/* Sección 4: AI Identity */}
                <section className="mb-10">
                    <h3 className="text-2xl font-semibold text-purple-600 dark:text-purple-400 mb-4">
                        4. Módulo AI Identity (Premium)
                    </h3>
                    <p className="mb-4 text-gray-600 dark:text-gray-400">
                        Disponible para usuarios Gold+. Valida usuarios usando comportamiento on-chain.
                    </p>
                    <CodeBlock title="AI Verification" code={aiCode} />
                </section>

                {/* Sección 5: Real Estate Integration */}
                <section className="mb-10">
                    <h3 className="text-2xl font-semibold text-green-600 dark:text-green-400 mb-4">
                        5. Integración con Real Estate
                    </h3>
                    <p className="mb-4 text-gray-600 dark:text-gray-400">
                        Ejemplo de uso con contratos industriales desplegados.
                    </p>
                    <CodeBlock title="Real Estate Contract" code={realEstateCode} />
                </section>

                {/* Endpoints Disponibles (Merged from APIDocsTab in original) */}
                <section className="mb-10">
                    <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                        6. Endpoints Disponibles
                    </h3>

                    {/* Interactive Endpoints Explorer */}
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700 mb-6">
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            {/* Sidebar */}
                            <div className="lg:col-span-1 space-y-2">
                                {Object.keys(endpoints).map(key => (
                                    <button
                                        key={key}
                                        onClick={() => setSelectedEndpoint(key)}
                                        className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-all ${selectedEndpoint === key
                                            ? 'bg-purple-600 text-white'
                                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                            }`}
                                    >
                                        {endpoints[key].title}
                                    </button>
                                ))}
                            </div>

                            {/* Content */}
                            <div className="lg:col-span-3">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                    {endpoints[selectedEndpoint].title}
                                </h3>
                                <p className="text-gray-600 dark:text-gray-400 mb-6">
                                    {endpoints[selectedEndpoint].description}
                                </p>

                                <div className="space-y-4">
                                    {endpoints[selectedEndpoint].methods.map((method, idx) => (
                                        <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className={`px-3 py-1 rounded font-bold text-sm ${method.method === 'POST' ? 'bg-green-100 text-green-700' :
                                                    method.method === 'GET' ? 'bg-blue-100 text-blue-700' :
                                                        'bg-orange-100 text-orange-700'
                                                    }`}>
                                                    {method.method}
                                                </span>
                                                <code className="text-purple-600 dark:text-purple-400">{method.path}</code>
                                            </div>
                                            <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">{method.description}</p>
                                            <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded">
                                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Parámetros:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {method.params.map(param => (
                                                        <span key={param} className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-mono">
                                                            {param}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 space-y-4 border border-gray-200 dark:border-gray-700">
                        <div className="border-l-4 border-blue-500 pl-4">
                            <p className="font-mono text-sm text-blue-600 dark:text-blue-400 mb-1">
                                GET /api/developer/keys/:address
                            </p>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                                Obtiene todas las API Keys de un desarrollador
                            </p>
                        </div>
                        <div className="border-l-4 border-green-500 pl-4">
                            <p className="font-mono text-sm text-green-600 dark:text-green-400 mb-1">
                                POST /api/developer/keys
                            </p>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                                Crea una nueva API Key
                            </p>
                        </div>
                        <div className="border-l-4 border-yellow-500 pl-4">
                            <p className="font-mono text-sm text-yellow-600 dark:text-yellow-400 mb-1">
                                GET /api/developer/usage-stats/:address
                            </p>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                                Obtiene estadísticas de uso para Loyalty Program
                            </p>
                        </div>
                        <div className="border-l-4 border-purple-500 pl-4">
                            <p className="font-mono text-sm text-purple-600 dark:text-purple-400 mb-1">
                                GET /api/vip/loyalty-stats
                            </p>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                                Calcula tier VIP y recompensas acumuladas
                            </p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default DocumentationTab;
