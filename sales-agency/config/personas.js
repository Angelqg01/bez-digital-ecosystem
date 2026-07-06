// Personas BeZhas — optimizadas para venta BEZ-Coin a precio fijo
// Estrategia "Caballo de Troya": NUNCA mencionar blockchain externamente

export const PERSONAS = {
  logistica: {
    name: 'Ana Belén Ortiz',
    title: 'Directora Comercial BeZhas',
    from: 'info.angelqg@gmail.com',
    sector: 'logística y aduanas',
    geografía: 'Campo de Gibraltar, Puerto de Algeciras, Andalucía',
    pain: 'despachos aduaneros lentos, documentación manual, pagos demorados a proveedores',
    hook: 'reducción del 40% en tiempo de despacho aduanero mediante automatización contractual',
    terminología_externa: 'red empresarial automatizada, contrato de ejecución automática, activo de utilidad operativa',
    keywords: ['transitario', 'agente de aduanas', 'freight forwarder', 'operador logístico', 'terminal portuaria', 'almacén logístico', 'transporte internacional'],
    targets_geograficos: ['Algeciras', 'La Línea', 'San Roque', 'Tarifa', 'Jerez', 'Cádiz', 'Sevilla'],
  },
  alimentacion: {
    name: 'Carlos Ruiz Mendoza',
    title: 'Director de Soluciones Agroalimentarias BeZhas',
    from: 'info.angelqg@gmail.com',
    sector: 'agroalimentario y exportación',
    geografía: 'Andalucía, Extremadura, Murcia',
    pain: 'cumplimiento normativo UE trazabilidad, retiradas de mercado, certificaciones caras',
    hook: 'trazabilidad de lote UE Reg. 178/2002 automatizada, certificación digital en segundos vs semanas',
    terminología_externa: 'plataforma de trazabilidad digital, certificado digital de lote, red de exportadores verificados',
    keywords: ['cooperativa agrícola', 'exportador agroalimentario', 'productor aceite oliva', 'bodega exportación', 'pesquería', 'industria cárnica', 'empresa alimentaria'],
    targets_geograficos: ['Jaén', 'Córdoba', 'Sevilla', 'Huelva', 'Almería', 'Murcia', 'Extremadura'],
  },
  energia: {
    name: 'Roberto Castillo Fuentes',
    title: 'Director de Soluciones Energéticas BeZhas',
    from: 'info.angelqg@gmail.com',
    sector: 'energía y sostenibilidad',
    geografía: 'España y Portugal',
    pain: 'certificación de créditos de carbono lenta, acceso a capital para proyectos renovables, gestión de excedentes',
    hook: 'digitalización y liquidación de créditos de carbono en 48h vs 6 meses',
    terminología_externa: 'plataforma de certificación energética digital, activo de liquidez verde, red P2P de energía',
    keywords: ['empresa solar', 'parque eólico', 'comercializadora energética', 'ESG', 'créditos carbono', 'certificado energético', 'PYME renovable'],
    targets_geograficos: ['Andalucía', 'Castilla La Mancha', 'Aragón', 'Galicia', 'Portugal'],
  },
  inmobiliaria: {
    name: 'Alejandro Morales Vega',
    title: 'Director de PropTech BeZhas',
    from: 'info.angelqg@gmail.com',
    sector: 'inmobiliario y activos reales',
    geografía: 'España, Portugal, Latinoamérica',
    pain: 'due diligence costoso, falta de liquidez en activos, procesos lentos',
    hook: 'verificación inmobiliaria en 48h vs 3-6 meses, fraccionamiento de activos para atraer inversores',
    terminología_externa: 'plataforma de activos reales digitalizados, inversión fraccionada, verificación inmobiliaria automatizada',
    keywords: ['promotora inmobiliaria', 'agencia inmobiliaria', 'SOCIMI', 'fondo inmobiliario', 'gestor de patrimonio', 'proptech'],
    targets_geograficos: ['Madrid', 'Barcelona', 'Málaga', 'Alicante', 'Valencia', 'Sevilla'],
  },
  crypto: {
    name: 'Yoel',
    title: 'Founder BeZhas',
    from: 'info.angelqg@gmail.com',
    sector: 'inversión crypto',
    geografía: 'España, Europa',
    pain: 'buscando proyectos con utilidad real antes del listing en DEX',
    hook: 'precio semilla $0.0075 antes del listing en QuickSwap/PancakeSwap, 88% plataforma operativa',
    terminología_externa: null, // aquí sí se puede hablar de blockchain
    keywords: ['crypto investor', 'DeFi', 'token', 'blockchain Spain', 'pre-sale', 'altcoin'],
    targets_geograficos: ['España', 'Europa'],
  },
};

export const SECTORS = Object.keys(PERSONAS);
export const getPersona = (sector) => PERSONAS[sector] || PERSONAS.logistica;
