import React, { useState, useEffect, useCallback } from 'react';
import {
    Activity,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Award,
    TrendingUp,
    BrainCircuit,
    Wallet,
    ShieldCheck,
    Clock,
    Package,
    Truck,
    CreditCard,
    Bot,
    UserCheck,
    Building2,
    Heart,
    Factory,
    Car,
    Zap,
    Wheat,
    GraduationCap,
    Shield,
    Film,
    Scale,
    Container,
    Landmark,
    Leaf,
    FileSearch,
    AlertCircle,
    BarChart3,
    RefreshCw,
    Eye,
    ThumbsUp,
    ThumbsDown,
    DollarSign,
    Lock
} from 'lucide-react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, keccak256, toBytes } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

const BEZ_PRICE_EUR = 0.50;
const ORACLE_FEE_EUR = 0.05;
const ORACLE_FEE_BEZ = (ORACLE_FEE_EUR / BEZ_PRICE_EUR).toFixed(2); // ~0.10 BEZ

// ── Smart Contract Addresses (Polygon Mainnet) ───────────────────────────────
const BEZ_TOKEN = '0x89c23890c742d710265dd61be789c71dc8999b12';
// QualityOracle.sol — dirección pendiente de deploy en Polygon. 
// Actualizar cuando se despliegue con el script de deploy.
const QUALITY_ORACLE_ADDRESS = import.meta.env.VITE_QUALITY_ORACLE_ADDRESS || '0x0000000000000000000000000000000000000000';

// ABIs mínimos necesarios
const ERC20_APPROVE_ABI = [
    {
        name: 'approve', type: 'function', stateMutability: 'nonpayable',
        inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
        outputs: [{ name: '', type: 'bool' }]
    }
];

const QUALITY_ORACLE_ABI = [
    {
        name: 'requestValidation', type: 'function', stateMutability: 'nonpayable',
        inputs: [
            { name: '_entityType', type: 'uint8' },   // EntityType enum
            { name: '_entityHash', type: 'bytes32' },
            { name: '_metadataURI', type: 'string' }
        ],
        outputs: [{ name: '', type: 'uint256' }]
    }
];

// Map frontend sector IDs to QualityOracle EntityType enum values
const SECTOR_TO_ENTITY_TYPE = {
    marketplace: 0,   // PRODUCT
    logistics: 4,     // LOGISTICS
    payments: 8,      // TRANSACTION
    ai_moderation: 6, // POST
    nft_rwa: 2,       // NFT
    healthcare: 1,    // SERVICE
    manufacturing: 1, // SERVICE
    automotive: 3,    // RWA
    energy: 3,        // RWA
    agriculture: 0,   // PRODUCT
    education: 1,     // SERVICE
    insurance: 1,     // SERVICE
    legal: 1,         // SERVICE
    film: 2,          // NFT
    maritime: 4,      // LOGISTICS
    real_estate: 3,   // RWA
    sustainability: 3, // RWA
    consumer: 0,      // PRODUCT
};

// ========== SECTOR DEFINITIONS ==========
const ORACLE_SECTORS = {
    marketplace: {
        id: 'marketplace',
        name: 'Marketplace',
        icon: Package,
        color: 'from-blue-500 to-blue-600',
        bgColor: 'bg-blue-500',
        description: 'Validación de productos, vendedores y transacciones',
        validationTypes: ['product_listing', 'seller_verification', 'transaction_dispute', 'price_accuracy']
    },
    logistics: {
        id: 'logistics',
        name: 'Logística',
        icon: Truck,
        color: 'from-orange-500 to-orange-600',
        bgColor: 'bg-orange-500',
        description: 'Verificación de envíos, entregas y tracking',
        validationTypes: ['shipment_verification', 'delivery_confirmation', 'damage_claim', 'carrier_rating']
    },
    payments: {
        id: 'payments',
        name: 'Pagos & Escrow',
        icon: CreditCard,
        color: 'from-green-500 to-green-600',
        bgColor: 'bg-green-500',
        description: 'Disputas de pagos, liberación de escrow, fraude',
        validationTypes: ['payment_dispute', 'escrow_release', 'refund_request', 'fraud_detection']
    },
    ai_moderation: {
        id: 'ai_moderation',
        name: 'IA & Moderación',
        icon: Bot,
        color: 'from-purple-500 to-purple-600',
        bgColor: 'bg-purple-500',
        description: 'Contenido AI-generated, moderación de posts',
        validationTypes: ['content_moderation', 'ai_detection', 'hate_speech', 'spam_detection']
    },
    identity: {
        id: 'identity',
        name: 'Identidad & KYC',
        icon: UserCheck,
        color: 'from-cyan-500 to-cyan-600',
        bgColor: 'bg-cyan-500',
        description: 'Verificación de identidad, documentos KYC',
        validationTypes: ['kyc_verification', 'document_authenticity', 'identity_proof', 'age_verification']
    },
    real_estate: {
        id: 'real_estate',
        name: 'Real Estate',
        icon: Building2,
        color: 'from-amber-500 to-amber-600',
        bgColor: 'bg-amber-500',
        description: 'Validación de propiedades, RWA tokens, títulos',
        validationTypes: ['property_verification', 'title_deed', 'valuation_accuracy', 'rwa_tokenization']
    },
    healthcare: {
        id: 'healthcare',
        name: 'Healthcare',
        icon: Heart,
        color: 'from-red-500 to-red-600',
        bgColor: 'bg-red-500',
        description: 'Verificación médica, credenciales, registros',
        validationTypes: ['medical_credential', 'treatment_verification', 'insurance_claim', 'prescription_validity']
    },
    manufacturing: {
        id: 'manufacturing',
        name: 'Manufacturing',
        icon: Factory,
        color: 'from-slate-500 to-slate-600',
        bgColor: 'bg-slate-500',
        description: 'Control de calidad, certificaciones, trazabilidad',
        validationTypes: ['quality_control', 'certification_verify', 'batch_traceability', 'compliance_check']
    },
    automotive: {
        id: 'automotive',
        name: 'Automotive',
        icon: Car,
        color: 'from-zinc-500 to-zinc-600',
        bgColor: 'bg-zinc-500',
        description: 'Historial vehicular, servicios, transferencias',
        validationTypes: ['vehicle_history', 'service_record', 'ownership_transfer', 'mileage_verification']
    },
    energy: {
        id: 'energy',
        name: 'Energy',
        icon: Zap,
        color: 'from-yellow-500 to-yellow-600',
        bgColor: 'bg-yellow-500',
        description: 'Certificados de energía, producción, consumo',
        validationTypes: ['energy_certificate', 'production_verify', 'consumption_audit', 'renewable_proof']
    },
    agriculture: {
        id: 'agriculture',
        name: 'Agriculture',
        icon: Wheat,
        color: 'from-lime-500 to-lime-600',
        bgColor: 'bg-lime-500',
        description: 'Origen de productos, certificaciones orgánicas',
        validationTypes: ['origin_verification', 'organic_certification', 'harvest_record', 'fair_trade_proof']
    },
    education: {
        id: 'education',
        name: 'Education',
        icon: GraduationCap,
        color: 'from-indigo-500 to-indigo-600',
        bgColor: 'bg-indigo-500',
        description: 'Credenciales académicas, certificados, diplomas',
        validationTypes: ['degree_verification', 'course_completion', 'skill_certification', 'transcript_authenticity']
    },
    insurance: {
        id: 'insurance',
        name: 'Insurance',
        icon: Shield,
        color: 'from-teal-500 to-teal-600',
        bgColor: 'bg-teal-500',
        description: 'Reclamaciones, pólizas, evaluación de daños',
        validationTypes: ['claim_verification', 'policy_validity', 'damage_assessment', 'beneficiary_check']
    },
    entertainment: {
        id: 'entertainment',
        name: 'Entertainment',
        icon: Film,
        color: 'from-pink-500 to-pink-600',
        bgColor: 'bg-pink-500',
        description: 'Derechos de autor, royalties, NFT autenticidad',
        validationTypes: ['copyright_verify', 'royalty_distribution', 'nft_authenticity', 'content_rights']
    },
    legal: {
        id: 'legal',
        name: 'Legal',
        icon: Scale,
        color: 'from-gray-500 to-gray-600',
        bgColor: 'bg-gray-500',
        description: 'Contratos, firmas digitales, documentos legales',
        validationTypes: ['contract_validity', 'signature_verify', 'legal_compliance', 'notarization']
    },
    supply_chain: {
        id: 'supply_chain',
        name: 'Supply Chain',
        icon: Container,
        color: 'from-emerald-500 to-emerald-600',
        bgColor: 'bg-emerald-500',
        description: 'Trazabilidad, proveedores, inventario',
        validationTypes: ['supplier_verification', 'inventory_audit', 'shipment_tracking', 'quality_assurance']
    },
    government: {
        id: 'government',
        name: 'Government',
        icon: Landmark,
        color: 'from-blue-600 to-blue-700',
        bgColor: 'bg-blue-600',
        description: 'Documentos oficiales, licencias, permisos',
        validationTypes: ['license_verification', 'permit_validity', 'tax_compliance', 'official_document']
    },
    carbon_credits: {
        id: 'carbon_credits',
        name: 'Carbon Credits',
        icon: Leaf,
        color: 'from-green-600 to-green-700',
        bgColor: 'bg-green-600',
        description: 'Créditos de carbono, offset, certificaciones ESG',
        validationTypes: ['carbon_offset_verify', 'esg_certification', 'emission_audit', 'sustainability_proof']
    }
};

// ========== MOCK DATA GENERATOR ==========
const generateMockValidationItems = (sectorId, count = 3) => {
    const sector = ORACLE_SECTORS[sectorId];
    const items = [];

    const mockData = {
        marketplace: [
            { preview: 'Vendedor "ElectroMax" solicita verificación Premium', flags: ['New Seller'], risk: 'medium' },
            { preview: 'Disputa en producto iPhone 15 Pro - Comprador reclama falsificación', flags: ['High Value', 'Dispute'], risk: 'high' },
            { preview: 'Listado de Rolex Submariner - Verificación de autenticidad', flags: ['Luxury Item'], risk: 'medium' }
        ],
        logistics: [
            { preview: 'Envío #LOG-2851 - Paquete dañado en tránsito', flags: ['Damage Claim'], risk: 'high' },
            { preview: 'Confirmación de entrega - Destinatario no reconoce recepción', flags: ['Delivery Dispute'], risk: 'medium' },
            { preview: 'Carrier "FastShip" solicita rating de servicio', flags: ['Rating Request'], risk: 'low' }
        ],
        payments: [
            { preview: 'Escrow de $15,000 USD pendiente de liberación - Venta inmobiliaria', flags: ['High Value', 'Escrow'], risk: 'medium' },
            { preview: 'Solicitud de reembolso - Producto no recibido después de 30 días', flags: ['Refund Request'], risk: 'high' },
            { preview: 'Detección de actividad sospechosa en cuenta 0x7a2...', flags: ['Fraud Alert'], risk: 'critical' }
        ],
        ai_moderation: [
            { preview: 'Post detectado con posible contenido generado por IA', flags: ['AI Content'], risk: 'low' },
            { preview: 'Comentario flaggeado por hate speech por ML model', flags: ['Hate Speech', 'Auto-flagged'], risk: 'high' },
            { preview: 'Usuario reportado por spam masivo - 50+ mensajes similares', flags: ['Spam'], risk: 'medium' }
        ],
        identity: [
            { preview: 'Verificación KYC Nivel 3 - Documentos subidos para revisión', flags: ['KYC L3'], risk: 'low' },
            { preview: 'Documento de identidad posiblemente alterado detectado', flags: ['Altered Doc', 'Fraud Risk'], risk: 'critical' },
            { preview: 'Verificación de edad para contenido restringido', flags: ['Age Verify'], risk: 'low' }
        ],
        real_estate: [
            { preview: 'Tokenización de propiedad - Penthouse Miami Beach $2.5M', flags: ['RWA', 'High Value'], risk: 'medium' },
            { preview: 'Verificación de título de propiedad - Casa en Barcelona', flags: ['Title Deed'], risk: 'low' },
            { preview: 'Disputa de valoración - Diferencia del 40% con tasación', flags: ['Valuation Dispute'], risk: 'high' }
        ],
        healthcare: [
            { preview: 'Verificación de credencial médica - Dr. García, Cirujano', flags: ['Medical License'], risk: 'low' },
            { preview: 'Reclamación de seguro médico - Procedimiento de $25,000', flags: ['Insurance Claim'], risk: 'medium' },
            { preview: 'Validación de prescripción controlada', flags: ['Controlled Substance'], risk: 'high' }
        ],
        manufacturing: [
            { preview: 'Certificación ISO 9001 - Fábrica de componentes electrónicos', flags: ['Certification'], risk: 'low' },
            { preview: 'Control de calidad - Lote #MFG-4521 con defectos reportados', flags: ['Quality Issue'], risk: 'high' },
            { preview: 'Trazabilidad de materias primas - Verificación de origen', flags: ['Traceability'], risk: 'medium' }
        ],
        automotive: [
            { preview: 'Historial vehicular - BMW M3 2022, verificación pre-venta', flags: ['Vehicle History'], risk: 'low' },
            { preview: 'Disputa de kilometraje - Posible manipulación de odómetro', flags: ['Mileage Fraud'], risk: 'critical' },
            { preview: 'Transferencia de propiedad - Tesla Model S', flags: ['Ownership Transfer'], risk: 'low' }
        ],
        energy: [
            { preview: 'Certificado de energía renovable - Parque solar 50MW', flags: ['REC'], risk: 'low' },
            { preview: 'Auditoría de consumo energético - Edificio corporativo', flags: ['Energy Audit'], risk: 'medium' },
            { preview: 'Verificación de producción - Turbina eólica #ENG-892', flags: ['Production Verify'], risk: 'low' }
        ],
        agriculture: [
            { preview: 'Certificación orgánica - Finca de café en Colombia', flags: ['Organic Cert'], risk: 'low' },
            { preview: 'Verificación de origen - Lote de aguacates Hass', flags: ['Origin Verify'], risk: 'medium' },
            { preview: 'Certificación Fair Trade - Cooperativa de cacao', flags: ['Fair Trade'], risk: 'low' }
        ],
        education: [
            { preview: 'Verificación de título universitario - MIT Computer Science', flags: ['Degree Verify'], risk: 'low' },
            { preview: 'Certificación de curso - Blockchain Developer Bootcamp', flags: ['Course Cert'], risk: 'low' },
            { preview: 'Transcripción académica - Solicitud de empleador', flags: ['Transcript'], risk: 'medium' }
        ],
        insurance: [
            { preview: 'Reclamación por daños - Incendio en propiedad comercial $500K', flags: ['Major Claim'], risk: 'high' },
            { preview: 'Verificación de póliza de vida - Cambio de beneficiario', flags: ['Beneficiary Change'], risk: 'medium' },
            { preview: 'Evaluación de daños por accidente vehicular', flags: ['Damage Assessment'], risk: 'medium' }
        ],
        entertainment: [
            { preview: 'Verificación de derechos de autor - Track musical "Sunset"', flags: ['Copyright'], risk: 'medium' },
            { preview: 'Autenticidad de NFT - Bored Ape #8542', flags: ['NFT Verify'], risk: 'high' },
            { preview: 'Distribución de royalties - Película independiente', flags: ['Royalties'], risk: 'medium' }
        ],
        legal: [
            { preview: 'Validación de contrato inteligente - Acuerdo de licencia', flags: ['Smart Contract'], risk: 'medium' },
            { preview: 'Verificación de firma digital - Documento notarial', flags: ['Digital Signature'], risk: 'low' },
            { preview: 'Cumplimiento regulatorio - Empresa FinTech', flags: ['Compliance'], risk: 'high' }
        ],
        supply_chain: [
            { preview: 'Verificación de proveedor - Fábrica textil en Vietnam', flags: ['Supplier Audit'], risk: 'medium' },
            { preview: 'Auditoría de inventario - Almacén central', flags: ['Inventory'], risk: 'low' },
            { preview: 'Tracking de envío internacional - Contenedor #SC-7291', flags: ['Shipment Track'], risk: 'low' }
        ],
        government: [
            { preview: 'Verificación de licencia comercial - Restaurante "El Sabor"', flags: ['License'], risk: 'low' },
            { preview: 'Validación de permiso de construcción', flags: ['Building Permit'], risk: 'medium' },
            { preview: 'Cumplimiento fiscal - Declaración anual empresa', flags: ['Tax Compliance'], risk: 'medium' }
        ],
        carbon_credits: [
            { preview: 'Verificación de offset de carbono - Proyecto reforestación Amazonas', flags: ['Carbon Offset'], risk: 'medium' },
            { preview: 'Certificación ESG - Empresa manufacturing', flags: ['ESG Cert'], risk: 'low' },
            { preview: 'Auditoría de emisiones - Planta industrial', flags: ['Emission Audit'], risk: 'high' }
        ]
    };

    const sectorData = mockData[sectorId] || mockData.marketplace;

    for (let i = 0; i < Math.min(count, sectorData.length); i++) {
        const data = sectorData[i];
        const aiScore = data.risk === 'critical' ? Math.floor(Math.random() * 20) + 5 :
            data.risk === 'high' ? Math.floor(Math.random() * 30) + 20 :
                data.risk === 'medium' ? Math.floor(Math.random() * 30) + 40 :
                    Math.floor(Math.random() * 20) + 75;

        items.push({
            id: `${sectorId}-${Date.now()}-${i}`,
            sector: sectorId,
            type: sector.validationTypes[Math.floor(Math.random() * sector.validationTypes.length)],
            contentPreview: data.preview,
            author: `0x${Math.random().toString(16).substr(2, 4)}...${Math.random().toString(16).substr(2, 4)}`,
            aiScore,
            aiVerdict: aiScore >= 70 ? 'Safe' : aiScore >= 40 ? 'Review' : 'High Risk',
            timestamp: `Hace ${Math.floor(Math.random() * 30) + 1} min`,
            flags: data.flags,
            value: data.risk === 'high' || data.risk === 'critical' ? `$${(Math.random() * 50000 + 5000).toFixed(0)}` : null,
            urgency: data.risk === 'critical' ? 'urgent' : data.risk === 'high' ? 'high' : 'normal'
        });
    }

    return items;
};

// ========== STAT CARD COMPONENT ==========
const StatCard = ({ title, value, subtext, icon: Icon, color }) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex justify-between items-start">
            <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value}</h3>
                {subtext && <p className="text-xs text-green-500 mt-1">{subtext}</p>}
            </div>
            <div className={`p-2.5 rounded-lg ${color} bg-opacity-10`}>
                <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
            </div>
        </div>
    </div>
);

// ========== SECTOR TAB COMPONENT ==========
const SectorTab = ({ sector, isActive, onClick, pendingCount }) => {
    const Icon = sector.icon;
    return (
        <button
            onClick={onClick}
            className={`
                flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                ${isActive
                    ? `bg-gradient-to-r ${sector.color} text-white shadow-md`
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}
            `}
        >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{sector.name}</span>
            {pendingCount > 0 && (
                <span className={`
                    px-1.5 py-0.5 rounded-full text-xs font-bold
                    ${isActive ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}
                `}>
                    {pendingCount}
                </span>
            )}
        </button>
    );
};

// ========== VALIDATION ITEM COMPONENT ==========
const ValidationItem = ({ item, onVote, sector }) => {
    const [showDetails, setShowDetails] = useState(false);

    const getScoreColor = (score) => {
        if (score >= 70) return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400';
        if (score >= 40) return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400';
        return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400';
    };

    const getUrgencyBadge = (urgency) => {
        if (urgency === 'urgent') return 'bg-red-500 text-white animate-pulse';
        if (urgency === 'high') return 'bg-orange-500 text-white';
        return 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300';
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 border border-gray-200 dark:border-gray-600 relative overflow-hidden"
        >
            {/* Indicador de Costo por Voto */}
            <div className="absolute top-0 right-0 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-bl-lg text-xs font-semibold flex items-center gap-1 border-l border-b border-indigo-200 dark:border-indigo-800">
                <BrainCircuit className="w-3 h-3" /> Costo de Oráculo: {ORACLE_FEE_BEZ} BEZ (~€{ORACLE_FEE_EUR})
            </div>
            {/* Header */}
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${getUrgencyBadge(item.urgency)}`}>
                        {item.type.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{item.timestamp}</span>
                    {item.value && (
                        <span className="text-xs font-bold text-green-600 dark:text-green-400 flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />{item.value}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500">AI:</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getScoreColor(item.aiScore)}`}>
                        {item.aiScore}/100
                    </span>
                </div>
            </div>

            {/* Content Preview */}
            <div className="mb-4">
                <p className="text-gray-800 dark:text-gray-200 text-base leading-relaxed">
                    {item.contentPreview}
                </p>
                {item.flags.length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                        {item.flags.map(flag => (
                            <span key={flag} className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">
                                <AlertTriangle className="w-3 h-3" /> {flag}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Details Toggle */}
            <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline mb-4 flex items-center gap-1"
            >
                <Eye className="w-4 h-4" />
                {showDetails ? 'Ocultar detalles' : 'Ver más detalles'}
            </button>

            <AnimatePresence>
                {showDetails && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mb-4 p-3 bg-gray-100 dark:bg-gray-600 rounded-lg text-sm overflow-hidden"
                    >
                        <div className="grid grid-cols-2 gap-2 text-gray-600 dark:text-gray-300">
                            <div><strong>ID:</strong> {item.id}</div>
                            <div><strong>Sector:</strong> {sector.name}</div>
                            <div><strong>Autor:</strong> {item.author}</div>
                            <div><strong>Veredicto AI:</strong> {item.aiVerdict}</div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-3">
                <button
                    onClick={() => onVote(item.id, 'reject')}
                    aria-label="Rechazar"
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-semibold transition-colors border border-red-200 dark:border-red-800"
                >
                    <ThumbsDown className="w-4 h-4" />
                    <span className="hidden sm:inline">Rechazar</span>
                </button>
                <button
                    onClick={() => onVote(item.id, 'escalate')}
                    aria-label="Escalar"
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 text-amber-600 dark:text-amber-400 font-semibold transition-colors border border-amber-200 dark:border-amber-800"
                >
                    <AlertCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">Escalar</span>
                </button>
                <button
                    onClick={() => onVote(item.id, 'approve')}
                    aria-label="Aprobar"
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 text-green-600 dark:text-green-400 font-semibold transition-colors border border-green-200 dark:border-green-800"
                >
                    <ThumbsUp className="w-4 h-4" />
                    <span className="hidden sm:inline">Aprobar</span>
                </button>
            </div>
        </motion.div>
    );
};

// ========== MAIN ORACLE PAGE COMPONENT ==========
const OraclePage = () => {
    const { address, isConnected } = useAccount();

    // ── On-chain: Approve BEZ spend ──────────────────────────────────────────
    const { writeContractAsync: approveAsync } = useWriteContract();
    const { writeContractAsync: validateAsync, data: validateTxHash } = useWriteContract();
    const { isSuccess: isValidateSuccess } = useWaitForTransactionReceipt({ hash: validateTxHash });

    const [activeSector, setActiveSector] = useState('marketplace');
    const [validationQueues, setValidationQueues] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessingTx, setIsProcessingTx] = useState(false);
    const [pendingVoteItem, setPendingVoteItem] = useState(null);
    const [stats, setStats] = useState({
        totalValidations: 1245,
        accuracy: 96.2,
        pendingRewards: 450,
        stakedAmount: 5000,
        reputation: 98.5
    });

    // Initialize validation queues for all sectors
    useEffect(() => {
        const initialQueues = {};
        Object.keys(ORACLE_SECTORS).forEach(sectorId => {
            initialQueues[sectorId] = generateMockValidationItems(sectorId, Math.floor(Math.random() * 4) + 1);
        });
        setValidationQueues(initialQueues);
    }, []);

    /**
     * handleVote — On-chain oracle validation
     * 
     * Flow:
     *   1. Approve QualityOracle to spend ORACLE_FEE_BEZ BEZ tokens
     *   2. Call QualityOracle.requestValidation() which transfers the fee
     *
     * The "vote" (approve/reject/flag) maps to a human-readable metadataURI
     * stored off-chain. The on-chain action simply registers the fee payment.
     */
    const handleVote = useCallback(async (itemId, vote) => {
        if (!isConnected || !address) {
            toast.error('Wallet no conectada');
            return;
        }

        const oracleAddress = QUALITY_ORACLE_ADDRESS;
        const isContractDeployed = oracleAddress !== '0x0000000000000000000000000000000000000000';
        const feeAmount = parseUnits(ORACLE_FEE_BEZ, 18);
        const entityType = SECTOR_TO_ENTITY_TYPE[activeSector] ?? 0;
        const entityHash = keccak256(toBytes(`${activeSector}:${itemId}:${Date.now()}`));
        const metadataURI = `bezhas://oracle/${activeSector}/${itemId}/${vote}`;

        try {
            setIsProcessingTx(true);
            setPendingVoteItem({ itemId, vote });

            if (isContractDeployed) {
                // ── PASO 1: Approve ───────────────────────────────
                toast.loading('Aprobando gasto de BEZ...', { id: 'oracle-approve' });
                await approveAsync({
                    address: BEZ_TOKEN,
                    abi: ERC20_APPROVE_ABI,
                    functionName: 'approve',
                    args: [oracleAddress, feeAmount],
                    chainId: 137,
                });
                toast.dismiss('oracle-approve');

                // ── PASO 2: requestValidation ────────────────────────
                toast.loading('Registrando voto on-chain...', { id: 'oracle-validate' });
                await validateAsync({
                    address: oracleAddress,
                    abi: QUALITY_ORACLE_ABI,
                    functionName: 'requestValidation',
                    args: [entityType, entityHash, metadataURI],
                    chainId: 137,
                });
                toast.dismiss('oracle-validate');
            } else {
                // Contrato no desplegado aún — simulación con log
                toast.loading('Registrando voto (modo simulación)...', { id: 'oracle-sim' });
                await new Promise(r => setTimeout(r, 800));
                toast.dismiss('oracle-sim');
                console.warn('[Oracle] QUALITY_ORACLE_ADDRESS no configurado. Usando simulación.');
            }

            toast.success(`Voto "${vote}" registrado. Oracle fee: ${ORACLE_FEE_BEZ} BEZ`);
            setValidationQueues(prev => ({
                ...prev,
                [activeSector]: prev[activeSector].filter(item => item.id !== itemId)
            }));

            const reward = vote === 'approve' ? 5 : vote === 'reject' ? 3 : 2;
            setStats(prev => ({
                ...prev,
                totalValidations: prev.totalValidations + 1,
                pendingRewards: prev.pendingRewards + reward - parseFloat(ORACLE_FEE_BEZ)
            }));
        } catch (error) {
            console.error('Error en oracle vote:', error);
            toast.dismiss('oracle-approve');
            toast.dismiss('oracle-validate');
            toast.dismiss('oracle-sim');
            toast.error('Transacción rechazada o error de red.');
        } finally {
            setIsProcessingTx(false);
            setPendingVoteItem(null);
        }
    }, [isConnected, address, activeSector, approveAsync, validateAsync]);

    const handleRefresh = useCallback(() => {
        setIsLoading(true);
        setTimeout(() => {
            setValidationQueues(prev => ({
                ...prev,
                [activeSector]: [
                    ...prev[activeSector],
                    ...generateMockValidationItems(activeSector, 2)
                ]
            }));
            setIsLoading(false);
        }, 1000);
    }, [activeSector]);

    const getTotalPending = () => {
        return Object.values(validationQueues).reduce((acc, queue) => acc + (queue?.length || 0), 0);
    };

    const currentQueue = validationQueues[activeSector] || [];
    const currentSector = ORACLE_SECTORS[activeSector];

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="relative mb-8">
                    <ShieldCheck className="w-24 h-24 text-indigo-500" />
                    <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full p-2">
                        <BrainCircuit className="w-8 h-8 text-white" />
                    </div>
                </div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                    BeZhas Quality Oracle
                </h2>
                <p className="text-gray-600 dark:text-gray-400 max-w-lg mb-6">
                    El oráculo multi-sector de BeZhas combina IA avanzada con validación humana descentralizada
                    para garantizar la calidad y autenticidad en 18 sectores industriales.
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-8">
                    {Object.values(ORACLE_SECTORS).slice(0, 6).map(sector => {
                        const Icon = sector.icon;
                        return (
                            <div key={sector.id} className={`p-3 rounded-xl bg-gradient-to-br ${sector.color} text-white`}>
                                <Icon className="w-6 h-6 mx-auto" />
                            </div>
                        );
                    })}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-500">
                    Conecta tu wallet para acceder al panel de validadores
                </p>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-6 max-w-7xl">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <BrainCircuit className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                        Quality Oracle
                        <span className="text-sm font-normal bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 px-2 py-1 rounded-full">
                            Multi-Sector
                        </span>
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
                        Validación híbrida IA + Humano para {Object.keys(ORACLE_SECTORS).length} sectores industriales
                    </p>
                </div>

                <div className="flex items-center gap-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 px-4 py-3 rounded-xl border border-indigo-100 dark:border-indigo-800">
                    <div className="text-right">
                        <p className="text-xs text-indigo-600 dark:text-indigo-300 font-semibold">REPUTACIÓN</p>
                        <p className="text-xl font-bold text-indigo-900 dark:text-white">{stats.reputation}/100</p>
                    </div>
                    <Award className="w-10 h-10 text-indigo-500" />
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                <StatCard title="Validaciones" value={stats.totalValidations.toLocaleString()} subtext="+12 hoy" icon={Activity} color="bg-blue-500" />
                <StatCard title="Precisión" value={`${stats.accuracy}%`} subtext="Top 5%" icon={CheckCircle} color="bg-green-500" />
                <StatCard title="Pendientes" value={getTotalPending()} subtext="Total sectores" icon={Clock} color="bg-amber-500" />
                <StatCard title="Rewards" value={`${stats.pendingRewards} BEZ`} subtext="≈ $22.50" icon={Wallet} color="bg-purple-500" />
                <StatCard title="Staked" value={`${stats.stakedAmount.toLocaleString()} BEZ`} subtext="Nivel: Guardián" icon={ShieldCheck} color="bg-indigo-500" />
            </div>

            {/* Sector Tabs */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 mb-6 overflow-hidden">
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                    {Object.values(ORACLE_SECTORS).map(sector => (
                        <SectorTab
                            key={sector.id}
                            sector={sector}
                            isActive={activeSector === sector.id}
                            onClick={() => setActiveSector(sector.id)}
                            pendingCount={validationQueues[sector.id]?.length || 0}
                        />
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Validation Queue */}
                <div className="lg:col-span-2">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        {/* Sector Header */}
                        <div className={`p-4 bg-gradient-to-r ${currentSector.color} text-white`}>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <currentSector.icon className="w-6 h-6" />
                                    <div>
                                        <h2 className="text-lg font-bold">{currentSector.name}</h2>
                                        <p className="text-sm opacity-90">{currentSector.description}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleRefresh}
                                    disabled={isLoading}
                                    className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                                >
                                    <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>

                        {/* Queue Content */}
                        <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
                            <AnimatePresence mode="popLayout">
                                {currentQueue.length === 0 ? (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="text-center py-12 text-gray-500"
                                    >
                                        <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500 opacity-50" />
                                        <p className="text-lg font-medium">¡Cola vacía!</p>
                                        <p className="text-sm">No hay validaciones pendientes en {currentSector.name}</p>
                                        <button
                                            onClick={handleRefresh}
                                            className="mt-4 px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-sm font-medium hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
                                        >
                                            Cargar más validaciones
                                        </button>
                                    </motion.div>
                                ) : (
                                    currentQueue.map(item => (
                                        <ValidationItem
                                            key={item.id}
                                            item={item}
                                            onVote={handleVote}
                                            sector={currentSector}
                                        />
                                    ))
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Validator Status */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-green-500" />
                            Estado del Validador
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                                <span className="text-gray-600 dark:text-gray-400 text-sm">Estado</span>
                                <span className="text-green-500 font-bold flex items-center gap-1 text-sm">
                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Activo
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                                <span className="text-gray-600 dark:text-gray-400 text-sm">Nivel</span>
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold text-sm">Guardián</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                                <span className="text-gray-600 dark:text-gray-400 text-sm">Sectores Activos</span>
                                <span className="text-gray-900 dark:text-white font-medium text-sm">{Object.keys(ORACLE_SECTORS).length}</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-gray-600 dark:text-gray-400 text-sm">Lock Period</span>
                                <span className="text-gray-900 dark:text-white font-medium text-sm">14 Días</span>
                            </div>
                        </div>
                        <button className="w-full mt-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors text-sm">
                            Gestionar Stake
                        </button>
                    </div>

                    {/* Sector Stats */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-indigo-500" />
                            Stats por Sector
                        </h3>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {Object.values(ORACLE_SECTORS).slice(0, 8).map(sector => {
                                const Icon = sector.icon;
                                const count = validationQueues[sector.id]?.length || 0;
                                return (
                                    <button
                                        key={sector.id}
                                        onClick={() => setActiveSector(sector.id)}
                                        className={`
                                            w-full flex items-center justify-between p-2 rounded-lg transition-colors text-sm
                                            ${activeSector === sector.id
                                                ? 'bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700'
                                                : 'hover:bg-gray-50 dark:hover:bg-gray-700'}
                                        `}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Icon className={`w-4 h-4 ${sector.bgColor.replace('bg-', 'text-')}`} />
                                            <span className="text-gray-700 dark:text-gray-300">{sector.name}</span>
                                        </div>
                                        <span className={`
                                            px-2 py-0.5 rounded-full text-xs font-bold
                                            ${count > 0 ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}
                                        `}>
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Quick Guide */}
                    <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-xl shadow-sm p-5 text-white">
                        <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                            <FileSearch className="w-5 h-5" />
                            Guía de Validación
                        </h3>
                        <ul className="space-y-2 text-indigo-100 text-sm">
                            <li className="flex gap-2">
                                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>Usa el AI Score como guía, pero aplica tu criterio</span>
                            </li>
                            <li className="flex gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>Escala casos complejos o con alto valor</span>
                            </li>
                            <li className="flex gap-2">
                                <Wallet className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>Costo de Operación: <strong>{ORACLE_FEE_BEZ} BEZ (~€{ORACLE_FEE_EUR})</strong> por validar.</span>
                            </li>
                            <li className="flex gap-2">
                                <Award className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>Rewards Promedio: 2 - 5 BEZ (Rentable al final)</span>
                            </li>
                            <li className="flex gap-2">
                                <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>Votos maliciosos reducen tu stake general</span>
                            </li>
                        </ul>
                    </div>

                    {/* Loader superpuesto cuando se interactúa */}
                    {isProcessingTx && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-white">
                            <div className="w-16 h-16 border-4 border-t-transparent border-indigo-400 rounded-full animate-spin mb-4"></div>
                            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 to-purple-300">
                                Emitiendo Voto en el Blockchain...
                            </h2>
                            <p className="mt-2 text-indigo-200">Por favor confirma el pago de {ORACLE_FEE_BEZ} BEZ en tu wallet.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OraclePage;
