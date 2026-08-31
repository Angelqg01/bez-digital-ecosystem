/**
 * 🏭 Marketplace Industrial Constants
 * Configuración completa para Marketplace B2B/B2C híbrido estilo Alibaba + Web3
 */

// ============================================
// 1. CATEGORÍAS PRINCIPALES
// ============================================
export const MARKETPLACE_CATEGORIES = [
    {
        id: 'nft',
        label: '🎨 NFTs & Arte Digital',
        description: 'Coleccionables digitales únicos en blockchain',
        subcategories: [
            'Arte Digital',
            'Coleccionables',
            'Fotografía',
            'Música',
            'Videos',
            'Avatares',
            'Mundos Virtuales',
            'Utilidad'
        ],
        saleTypes: ['nft_single', 'nft_edition']
    },
    {
        id: 'industry',
        label: '🏭 Industria y Producción',
        description: 'Materias primas y maquinaria industrial',
        subcategories: [
            'Materias Primas',
            'Metales (Cobre, Aluminio, Acero)',
            'Tierras Raras',
            'Químicos Industriales',
            'Plásticos y Resinas',
            'Minerales',
            'Tierra Agrícola / Sustratos',
            'Maquinaria Pesada',
            'Herramientas Industriales',
            'Equipos de Fabricación',
            'Energía (Placas Solares, Baterías)'
        ],
        saleTypes: ['unit', 'weight', 'volume', 'wholesale']
    },
    {
        id: 'electronics',
        label: '📱 Electrónica',
        description: 'Dispositivos y componentes electrónicos',
        subcategories: [
            'Móviles y Accesorios',
            'Tablets / Portátiles',
            'Componentes Electrónicos',
            'Iluminación LED',
            'Drones / Cámaras',
            'Domótica / Smart Home',
            'Audio y Video',
            'Gaming'
        ],
        saleTypes: ['unit', 'wholesale']
    },
    {
        id: 'home',
        label: '🏠 Hogar y Decoración',
        description: 'Muebles y accesorios para el hogar',
        subcategories: [
            'Muebles',
            'Accesorios Decorativos',
            'Textiles para Hogar',
            'Iluminación',
            'Cocina y Baño',
            'Jardín y Exterior'
        ],
        saleTypes: ['unit', 'wholesale']
    },
    {
        id: 'fashion',
        label: '👗 Moda',
        description: 'Ropa, calzado y accesorios',
        subcategories: [
            'Hombre',
            'Mujer',
            'Niños',
            'Accesorios',
            'Calzado',
            'Ropa al por Metro (Telas)',
            'Retales',
            'Rollos Completos'
        ],
        saleTypes: ['unit', 'length', 'wholesale']
    },
    {
        id: 'beauty',
        label: '💄 Belleza y Cuidado Personal',
        description: 'Cosméticos y productos de belleza',
        subcategories: [
            'Cosméticos',
            'Cabello',
            'Fragancias',
            'Herramientas de Estética',
            'Skincare',
            'Maquillaje'
        ],
        saleTypes: ['unit', 'volume', 'wholesale']
    },
    {
        id: 'vehicles',
        label: '🚗 Vehículos y Movilidad',
        description: 'Vehículos, piezas y accesorios',
        subcategories: [
            'Motocicletas',
            'Coches Eléctricos',
            'Piezas y Recambios',
            'Bicicletas y Scooters',
            'Accesorios para Vehículos'
        ],
        saleTypes: ['unit', 'wholesale']
    },
    {
        id: 'agriculture',
        label: '🌾 Agricultura y Ganadería',
        description: 'Productos agrícolas y ganaderos',
        subcategories: [
            'Semillas',
            'Fertilizantes',
            'Herramientas Agrícolas',
            'Maquinaria',
            'Granos (por Toneladas)',
            'Tierra, Arena, Piedras',
            'Animales y Ganado'
        ],
        saleTypes: ['unit', 'weight', 'wholesale']
    },
    {
        id: 'food',
        label: '🍎 Alimentación y Bebidas',
        description: 'Productos alimenticios al por mayor',
        subcategories: [
            'Productos Frescos',
            'Productos Secos',
            'Conservas',
            'Bebidas',
            'Ingredientes Industriales',
            'Especias y Condimentos'
        ],
        saleTypes: ['unit', 'weight', 'volume', 'wholesale']
    },
    {
        id: 'construction',
        label: '🏗️ Construcción',
        description: 'Materiales de construcción',
        subcategories: [
            'Cemento, Arena, Grava (Toneladas)',
            'Materiales Aislantes',
            'Tubos, Hierro, Acero',
            'Paneles Solares',
            'Pinturas',
            'Herramientas',
            'Madera'
        ],
        saleTypes: ['unit', 'weight', 'volume', 'wholesale']
    },
    {
        id: 'health',
        label: '⚕️ Salud',
        description: 'Equipos médicos y suplementos',
        subcategories: [
            'Equipos Médicos',
            'Material Sanitario',
            'Suplementos',
            'Farmacéuticos',
            'Rehabilitación'
        ],
        saleTypes: ['unit', 'wholesale']
    },
    {
        id: 'services',
        label: '🛠️ Servicios',
        description: 'Servicios profesionales y técnicos',
        subcategories: [
            'Logística',
            'Envíos y Transporte',
            'Diseño y Branding',
            'Fabricación OEM/ODM',
            'Instalación de Placas Solares',
            'Servicios Técnicos',
            'Arquitectura y Planos',
            'Consultoría'
        ],
        saleTypes: ['custom']
    }
];

// ============================================
// 2. TIPOS DE VENTA
// ============================================
export const SALE_TYPES = {
    // NFT & Digital
    nft_single: {
        id: 'nft_single',
        label: 'NFT Único',
        description: 'Token no fungible de edición única',
        icon: '🎨',
        units: ['NFT'],
        requiresBlockchain: true,
        fields: ['royalties', 'blockchain', 'metadata']
    },
    nft_edition: {
        id: 'nft_edition',
        label: 'NFT Edición Limitada',
        description: 'Múltiples copias del mismo NFT',
        icon: '🖼️',
        units: ['Edición'],
        requiresBlockchain: true,
        fields: ['royalties', 'blockchain', 'metadata', 'edition_size']
    },

    // Físico tradicional
    unit: {
        id: 'unit',
        label: 'Por Unidad (Retail)',
        description: 'Venta individual por pieza',
        icon: '📦',
        units: ['pz', 'unidad', 'set', 'pack'],
        fields: ['stock', 'sku']
    },

    // Venta al por mayor
    wholesale: {
        id: 'wholesale',
        label: 'Al Por Mayor (MOQ)',
        description: 'Venta con cantidad mínima',
        icon: '📊',
        units: ['pz', 'unidad'],
        fields: ['moq', 'bulk_pricing', 'production_capacity'],
        requiresMOQ: true
    },

    // Por peso
    weight: {
        id: 'weight',
        label: 'Por Peso',
        description: 'Ideal para materias primas y granos',
        icon: '⚖️',
        units: ['kg', 'ton', 'g', 'lb', 'oz'],
        fields: ['weight_unit', 'bulk_pricing']
    },

    // Por volumen (líquidos)
    volume: {
        id: 'volume',
        label: 'Por Volumen (Líquidos)',
        description: 'Aceites, químicos, combustibles',
        icon: '🛢️',
        units: ['L', 'm³', 'gal', 'barril', 'ml'],
        fields: ['volume_unit', 'bulk_pricing', 'container_type']
    },

    // Por área
    area: {
        id: 'area',
        label: 'Por Área',
        description: 'Telas, paneles, vinilos, alfombras',
        icon: '📐',
        units: ['m²', 'ft²', 'rollo', 'cm²'],
        fields: ['area_unit', 'dimensions']
    },

    // Por longitud
    length: {
        id: 'length',
        label: 'Por Longitud',
        description: 'Cables, cuerdas, tuberías, textiles',
        icon: '📏',
        units: ['m', 'cm', 'ft', 'bobina', 'rollo'],
        fields: ['length_unit', 'dimensions']
    },

    // Personalizado
    custom: {
        id: 'custom',
        label: 'Venta Personalizada',
        description: 'Configurador a medida (OEM/ODM)',
        icon: '🎯',
        units: ['proyecto', 'servicio'],
        fields: ['customization_options', 'lead_time', 'quote_required']
    }
};

// ============================================
// 3. OPCIONES DE ENVÍO
// ============================================
export const SHIPPING_METHODS = [
    { id: 'standard', label: 'Envío Estándar', icon: '📦', maxWeight: 30, type: 'small' },
    { id: 'express', label: 'Envío Exprés', icon: '⚡', maxWeight: 30, type: 'small' },
    { id: 'pallet', label: 'Carga Paletizada', icon: '🏗️', maxWeight: 1000, type: 'industrial' },
    { id: 'container_20', label: 'Contenedor 20ft', icon: '🚢', maxWeight: 25000, type: 'bulk' },
    { id: 'container_40', label: 'Contenedor 40ft', icon: '🚢', maxWeight: 30000, type: 'bulk' },
    { id: 'tanker', label: 'Cisterna', icon: '🛢️', maxVolume: 50000, type: 'liquid' },
    { id: 'bulk', label: 'A Granel (Camión)', icon: '🚛', type: 'bulk' },
    { id: 'pickup', label: 'Recoger en Fábrica', icon: '🏭', type: 'pickup' },
    { id: 'digital', label: 'Entrega Digital (NFT)', icon: '💎', type: 'digital' }
];

// ============================================
// 4. MÉTODOS DE PAGO
// ============================================
export const PAYMENT_METHODS = [
    {
        id: 'card',
        name: 'Stripe',
        label: 'Tarjeta de Crédito/Débito',
        icon: '💳',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg',
        fee: 2.9,
        requiresConnection: true,
        description: 'Paga con tarjeta de crédito o débito'
    },
    {
        id: 'crypto',
        name: 'Wallet',
        label: 'Criptomonedas (BEZ/ETH)',
        icon: '₿',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg',
        fee: 0,
        requiresConnection: true,
        description: 'Conecta tu wallet para pagar con crypto'
    },
    { id: 'paypal', label: 'PayPal', icon: '🅿️', fee: 3.5 },
    { id: 'bank_transfer', label: 'Transferencia Bancaria', icon: '🏦', fee: 0 },
    { id: 'escrow', label: 'Depósito en Custodia', icon: '🔒', fee: 1 },
    { id: 'credit', label: 'Crédito Empresarial', icon: '📊', requiresApproval: true }
];

// ============================================
// 5. CERTIFICACIONES
// ============================================
export const CERTIFICATIONS = [
    { id: 'ce', name: 'CE', description: 'Conformidad Europea', icon: '🇪🇺' },
    { id: 'iso_9001', name: 'ISO 9001', description: 'Gestión de Calidad', icon: '✓' },
    { id: 'iso_14001', name: 'ISO 14001', description: 'Gestión Ambiental', icon: '🌱' },
    { id: 'rohs', name: 'RoHS', description: 'Sin sustancias peligrosas', icon: '⚠️' },
    { id: 'fda', name: 'FDA', description: 'Food & Drug Administration', icon: '🏥' },
    { id: 'gmp', name: 'GMP', description: 'Buenas Prácticas de Manufactura', icon: '⚕️' },
    { id: 'haccp', name: 'HACCP', description: 'Análisis de Peligros y Puntos Críticos', icon: '🍽️' },
    { id: 'organic', name: 'Organic', description: 'Certificación Orgánica', icon: '🌿' },
    { id: 'fair_trade', name: 'Fair Trade', description: 'Comercio Justo', icon: '🤝' },
    { id: 'fsc', name: 'FSC', description: 'Forest Stewardship Council', icon: '🌲' },
    { id: 'energy_star', name: 'Energy Star', description: 'Eficiencia Energética', icon: '⭐' },
    { id: 'ul', name: 'UL', description: 'Underwriters Laboratories', icon: '🔌' },
    { id: 'oeko_tex', name: 'OEKO-TEX', description: 'Textiles sin sustancias nocivas', icon: '👕' }
];

// ============================================
// 6. PAÍSES DE FABRICACIÓN (Todos excepto Somalia, Sudán del Sur, Afganistán, Yemen, RCA)
// ============================================
export const MANUFACTURING_COUNTRIES = [
    'Albania', 'Alemania', 'Andorra', 'Angola', 'Antigua y Barbuda', 'Arabia Saudita', 'Argelia', 'Argentina',
    'Armenia', 'Australia', 'Austria', 'Azerbaiyán', 'Bahamas', 'Baréin', 'Bangladesh', 'Barbados',
    'Bélgica', 'Belice', 'Benín', 'Bielorrusia', 'Birmania', 'Bolivia', 'Bosnia y Herzegovina', 'Botsuana',
    'Brasil', 'Brunéi', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Bután', 'Cabo Verde', 'Camboya',
    'Camerún', 'Canadá', 'Catar', 'Chad', 'Chequia', 'Chile', 'China', 'Chipre', 'Colombia', 'Comoras',
    'Congo', 'Corea del Norte', 'Corea del Sur', 'Costa de Marfil', 'Costa Rica', 'Croacia', 'Cuba',
    'Dinamarca', 'Dominica', 'Ecuador', 'Egipto', 'El Salvador', 'Emiratos Árabes Unidos', 'Eritrea',
    'Eslovaquia', 'Eslovenia', 'España', 'Estados Unidos', 'Estonia', 'Esuatini', 'Etiopía', 'Filipinas',
    'Finlandia', 'Fiyi', 'Francia', 'Gabón', 'Gambia', 'Georgia', 'Ghana', 'Granada', 'Grecia',
    'Guatemala', 'Guinea', 'Guinea-Bisáu', 'Guinea Ecuatorial', 'Guyana', 'Haití', 'Honduras', 'Hungría',
    'India', 'Indonesia', 'Irak', 'Irán', 'Irlanda', 'Islandia', 'Islas Marshall', 'Islas Salomón',
    'Israel', 'Italia', 'Jamaica', 'Japón', 'Jordania', 'Kazajistán', 'Kenia', 'Kirguistán', 'Kiribati',
    'Kosovo', 'Kuwait', 'Laos', 'Lesoto', 'Letonia', 'Líbano', 'Liberia', 'Libia', 'Liechtenstein',
    'Lituania', 'Luxemburgo', 'Macedonia del Norte', 'Madagascar', 'Malasia', 'Malaui', 'Maldivas', 'Malí',
    'Malta', 'Marruecos', 'Mauricio', 'Mauritania', 'México', 'Micronesia', 'Moldavia', 'Mónaco', 'Mongolia',
    'Montenegro', 'Mozambique', 'Namibia', 'Nauru', 'Nepal', 'Nicaragua', 'Níger', 'Nigeria', 'Noruega',
    'Nueva Zelanda', 'Omán', 'Países Bajos', 'Pakistán', 'Palaos', 'Panamá', 'Papúa Nueva Guinea', 'Paraguay',
    'Perú', 'Polonia', 'Portugal', 'Reino Unido', 'República Democrática del Congo', 'República Dominicana',
    'Ruanda', 'Rumanía', 'Rusia', 'Samoa', 'San Cristóbal y Nieves', 'San Marino', 'San Vicente y las Granadinas',
    'Santa Lucía', 'Santo Tomé y Príncipe', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leona', 'Singapur',
    'Siria', 'Sri Lanka', 'Sudáfrica', 'Sudán', 'Suecia', 'Suiza', 'Surinam', 'Tailandia', 'Tanzania',
    'Tayikistán', 'Timor Oriental', 'Togo', 'Tonga', 'Trinidad y Tobago', 'Túnez', 'Turkmenistán', 'Turquía',
    'Tuvalu', 'Ucrania', 'Uganda', 'Uruguay', 'Uzbekistán', 'Vanuatu', 'Vaticano', 'Venezuela', 'Vietnam',
    'Yibuti', 'Zambia', 'Zimbabue'
];

// ============================================
// 7. PLAZOS DE FABRICACIÓN
// ============================================
export const LEAD_TIMES = [
    { value: '1-3', label: '1-3 días' },
    { value: '3-7', label: '3-7 días' },
    { value: '7-15', label: '1-2 semanas' },
    { value: '15-30', label: '2-4 semanas' },
    { value: '30-60', label: '1-2 meses' },
    { value: '60+', label: 'Más de 2 meses' },
    { value: 'custom', label: 'Según pedido' }
];

// ============================================
// HELPERS
// ============================================

/**
 * Obtener tipos de venta compatibles con una categoría
 */
export const getSaleTypesForCategory = (categoryId) => {
    const category = MARKETPLACE_CATEGORIES.find(cat => cat.id === categoryId);
    if (!category) return Object.values(SALE_TYPES);

    return category.saleTypes.map(typeId => SALE_TYPES[typeId]).filter(Boolean);
};

/**
 * Validar si un producto requiere MOQ
 */
export const requiresMOQ = (saleTypeId) => {
    return SALE_TYPES[saleTypeId]?.requiresMOQ || false;
};

/**
 * Obtener campos requeridos según tipo de venta
 */
export const getRequiredFields = (saleTypeId) => {
    return SALE_TYPES[saleTypeId]?.fields || [];
};
