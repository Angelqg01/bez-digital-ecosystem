export interface CargoConfig {
  id: string;
  name: string;
  description: string;
  tempRange: string;
  humidityRange: string;
  shockTolerance: string;
  volume: string;
  weight: string;
  typeLabel: string;
  optimalTemp: number;
  optimalHum: number;
  criticalLimit: number; // Temperatura máxima segura (o mínima en criogénicos)
  isCryo?: boolean;
  icon: string;
  color: string;
  borderColor: string;
  badgeBg: string;
  statusText: string;
  broker: string;
}

export const CARGOS: CargoConfig[] = [
  {
    id: 'blueberries',
    name: 'Arándanos Premium',
    description: 'Cosecha fresca seleccionada de origen certificado. Transporte refrigerado de alta densidad y control fitosanitario extremo.',
    tempRange: '4.0°C - 8.0°C',
    humidityRange: '80% - 90%',
    shockTolerance: 'Máx 1.5G',
    volume: '14.2 m³',
    weight: '2,450 kg',
    typeLabel: 'Perecedero (Fresco)',
    optimalTemp: 5.5,
    optimalHum: 85,
    criticalLimit: 9.5,
    icon: '🫐',
    color: 'text-blue-400',
    borderColor: 'border-blue-500/20',
    badgeBg: 'bg-blue-500/10 text-blue-400',
    statusText: 'Integrity OK',
    broker: 'Productor Certificado Origen',
  },
  {
    id: 'tuna',
    name: 'Atún Rojo Premium',
    description: 'Atún rojo capturado artesanalmente de flota certificada. Exige congelación criogénica ininterrumpida para preservar la calidad sashimi.',
    tempRange: '-60.0°C - -20.0°C',
    humidityRange: '30% - 45%',
    shockTolerance: 'Máx 2.0G',
    volume: '8.5 m³',
    weight: '3,800 kg',
    typeLabel: 'Criogénico (Ultra Frío)',
    optimalTemp: -45.0,
    optimalHum: 35,
    criticalLimit: -15.0,
    isCryo: true,
    icon: '🐟',
    color: 'text-cyan-400',
    borderColor: 'border-cyan-500/20',
    badgeBg: 'bg-cyan-500/10 text-cyan-400',
    statusText: 'Cryo Integrity OK',
    broker: 'Consorcio Pesquero Certificado',
  },
  {
    id: 'wine',
    name: 'Vino Premium (Sherry)',
    description: 'Botas de vino amontillado envejecido de alta gama. Requiere control riguroso de humedad y tolerancia mínima al impacto (vibración).',
    tempRange: '12.0°C - 16.0°C',
    humidityRange: '60% - 70%',
    shockTolerance: 'Máx 1.0G',
    volume: '12.0 m³',
    weight: '4,100 kg',
    typeLabel: 'Líquido de Alto Valor',
    optimalTemp: 14.0,
    optimalHum: 65,
    criticalLimit: 19.0,
    icon: '🍷',
    color: 'text-rose-400',
    borderColor: 'border-rose-500/20',
    badgeBg: 'bg-rose-500/10 text-rose-400',
    statusText: 'Wine Integrity OK',
    broker: 'Bodega D.O. Certificada',
  },
];
