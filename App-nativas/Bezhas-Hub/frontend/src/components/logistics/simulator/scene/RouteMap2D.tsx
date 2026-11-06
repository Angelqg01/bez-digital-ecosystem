import React, { useMemo } from 'react';
import { LOCATIONS, LocationNode, SimulationStep, TransitMode, VehicleType } from '../engine/types';

/**
 * Mapa 2D del recorrido (SVG), al estilo de un plano de metro. Se usa cuando
 * el navegador no puede crear un contexto WebGL: en vez de un hueco negro, el
 * usuario sigue viendo dónde está la mercancía, qué tramos se han completado y
 * si la cadena de frío se ha roto.
 *
 * Las posiciones 3D no sirven en plano: el clúster de origen tiene 7 paradas
 * en una franja estrecha y las etiquetas se pisan. Aquí las paradas se reparten
 * por orden, el tramo internacional ocupa más (es el más largo) y las
 * etiquetas alternan arriba y abajo.
 */

const W = 780;
const H = 330;
const MID = H / 2;
const ZIG = 44;            // desplazamiento vertical alterno de las paradas en tierra
const INTL_WEIGHT = 3.2;   // el tramo marítimo/aéreo ocupa ~3 tramos de tierra

const ICON: Record<LocationNode['type'], string> = {
  factory: '🏭', warehouse: '📦', gate: '🚧', customs: '🛃', port: '⚓', airport: '🛫', customer: '🏪',
};
const VEHICLE_ICON: Record<VehicleType, string> = { camion: '🚛', buque: '🚢', avion: '✈️', none: '•' };

// Nombres cortos: en plano las etiquetas de LOCATIONS se pisan.
const SHORT: Record<number, string> = {
  0: 'Fábrica', 1: 'Embalaje RFID', 2: 'Acceso ZF', 3: 'Depósito ZF', 4: 'Aduana',
  5: 'Inspección', 6: 'Muelle origen', 7: 'Puerto destino', 8: 'Aduana destino',
  9: 'Almacén', 10: 'Distribuidor', 11: 'Aeropuerto origen', 12: 'Aeropuerto destino',
};

const TEAL = '#2dd4bf';
const RED = '#f87171';

interface RouteMap2DProps {
  flow: SimulationStep[];
  stepIndex: number;
  isRunning: boolean;
  isFinished: boolean;
  isBreached: boolean;
  breachFromIndex: number;
  mode: TransitMode;
  vehicle: VehicleType;
  onRetry3D?: () => void;
}

interface Stop {
  loc: number;
  firstStep: number;
  x: number;
  y: number;
  phase: SimulationStep['phase'];
}

export function RouteMap2D({ flow, stepIndex, isRunning, isFinished, isBreached, breachFromIndex, mode, vehicle, onRetry3D }: RouteMap2DProps) {
  const [copied, setCopied] = React.useState(false);
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* sin portapapeles */ }
  };
  const stops = useMemo<Stop[]>(() => {
    const seq: Omit<Stop, 'x' | 'y'>[] = [];
    flow.forEach((s, i) => {
      if (!seq.length || seq[seq.length - 1].loc !== s.locationIndex) {
        seq.push({ loc: s.locationIndex, firstStep: i, phase: s.phase });
      }
    });
    // Peso de cada tramo: el internacional (cambio de fase origen → tránsito/destino
    // entre puertos o aeropuertos) se dibuja más largo.
    const weights = seq.slice(1).map((s, i) => {
      const a = LOCATIONS[seq[i].loc].type;
      const b = LOCATIONS[s.loc].type;
      return (a === 'port' || a === 'airport') && (b === 'port' || b === 'airport') ? INTL_WEIGHT : 1;
    });
    const total = weights.reduce((t, w) => t + w, 0);
    const left = 46;
    const span = W - 92;
    let acc = 0;
    let land = 0;
    return seq.map((s, i) => {
      if (i > 0) acc += weights[i - 1];
      const intlEnd = i > 0 && weights[i - 1] === INTL_WEIGHT;
      const intlStart = i < weights.length && weights[i] === INTL_WEIGHT;
      // Puertos/aeropuertos del tramo internacional, en la línea central; el resto zigzaguea.
      const y = intlEnd || intlStart ? MID : MID + (land++ % 2 === 0 ? -ZIG : ZIG);
      return { ...s, x: left + (acc / total) * span, y };
    });
  }, [flow]);

  const active = isRunning || isFinished;
  const reached = active ? stops.filter((s) => s.firstStep <= stepIndex).length - 1 : -1;
  const breachStop = stops.findIndex((s) => s.firstStep >= breachFromIndex);
  const broken = (i: number) => isBreached && breachStop >= 0 && i >= breachStop;
  const current = active ? stops[Math.max(reached, 0)] : stops[0];

  // La etiqueta va hacia fuera de la línea; el vehículo, al lado contrario para no taparla.
  const isLabelBelow = (s: Stop, i: number) => s.y > MID || (s.y === MID && i % 2 === 1);
  const currentIdx = Math.max(reached, 0);
  const vehicleDy = isLabelBelow(current, currentIdx) ? -42 : 42;

  const segPath = (a: Stop, b: Stop) => {
    if (a.y === MID && b.y === MID && b.x - a.x > 150) {
      return `M${a.x},${a.y} Q${(a.x + b.x) / 2},${MID - 95} ${b.x},${b.y}`;
    }
    const mx = (a.x + b.x) / 2;
    return `M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`;
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-[radial-gradient(ellipse_at_45%_50%,_rgba(20,184,166,0.09),_transparent_60%)]">
      {/* Zona libre entre los overlays: HUD (izq.), nodos (arriba), validadores y timeline (abajo), explorer (dcha.) */}
      <div className="absolute top-[150px] left-[250px] right-4 lg:right-[356px] bottom-[175px]">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
        role="img"
        aria-label={`Recorrido del envío: ${LOCATIONS[current.loc].name}`}
      >
        <defs>
          <filter id="rm-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" /></filter>
        </defs>

        {/* Tramos: base gris + progreso */}
        {stops.slice(1).map((b, i) => {
          const a = stops[i];
          const d = segPath(a, b);
          const intl = a.y === MID && b.y === MID && b.x - a.x > 150;
          const done = i + 1 <= reached;
          return (
            <g key={`seg-${a.loc}-${b.loc}`}>
              <path d={d} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth={intl ? 2 : 4}
                strokeDasharray={intl ? '7 9' : undefined} strokeLinecap="round" />
              {done && (
                <path d={d} fill="none" stroke={broken(i + 1) ? RED : TEAL} strokeWidth={intl ? 2.5 : 4}
                  strokeDasharray={intl ? '7 9' : undefined} strokeLinecap="round" />
              )}
              {intl && (
                <text x={(a.x + b.x) / 2} y={MID - 58} textAnchor="middle" fontSize="11"
                  fontFamily="ui-monospace, monospace" letterSpacing="3" className="fill-zinc-500">
                  {mode === 'sea' ? '≈ RUTA MARÍTIMA ≈' : '✈ RUTA AÉREA'}
                </text>
              )}
            </g>
          );
        })}

        {/* Paradas */}
        {stops.map((s, i) => {
          const l = LOCATIONS[s.loc];
          const done = i <= reached;
          const isCur = active && i === reached;
          const color = broken(i) && done ? RED : TEAL;
          const labelBelow = isLabelBelow(s, i);
          return (
            <g key={`stop-${s.loc}`}>
              {isCur && <circle cx={s.x} cy={s.y} r="24" fill={color} opacity="0.35" filter="url(#rm-glow)" />}
              <circle cx={s.x} cy={s.y} r="16" fill="#0a0a0f"
                stroke={isCur ? color : done ? color : '#3f3f46'} strokeOpacity={done || isCur ? 1 : 0.9}
                strokeWidth={isCur ? 3 : 1.5} />
              <text x={s.x} y={s.y + 5} textAnchor="middle" fontSize="14">{ICON[l.type]}</text>
              <text x={s.x} y={labelBelow ? s.y + 36 : s.y - 26} textAnchor="middle" fontSize="11"
                fontWeight={isCur ? 700 : 400}
                className={isCur ? (broken(i) ? 'fill-red-300' : 'fill-teal-200') : done ? 'fill-zinc-200' : 'fill-zinc-500'}>
                {SHORT[s.loc] ?? l.name}
              </text>
            </g>
          );
        })}

        {/* Vehículo */}
        {active && current && (
          <g style={{ transform: `translate(${current.x}px, ${current.y + vehicleDy}px)`, transition: 'transform 700ms ease-in-out' }}>
            <rect x="-17" y="-14" width="34" height="26" rx="7" fill="#18181b"
              stroke={broken(reached) ? RED : TEAL} strokeWidth="1.2" />
            <text x="0" y="5" textAnchor="middle" fontSize="16">{VEHICLE_ICON[vehicle]}</text>
          </g>
        )}

        {/* Leyenda de fases */}
        {(['origin', 'transit', 'destination'] as const).map((ph) => {
          const ofPhase = stops.filter((s) => s.phase === ph);
          if (!ofPhase.length) return null;
          const x = (ofPhase[0].x + ofPhase[ofPhase.length - 1].x) / 2;
          const label = ph === 'origin' ? 'ORIGEN · ZONA FRANCA' : ph === 'transit' ? 'TRÁNSITO' : 'DESTINO';
          return (
            <text key={ph} x={x} y={H - 6} textAnchor="middle" fontSize="10" letterSpacing="3"
              fontFamily="ui-monospace, monospace" className="fill-zinc-600">{label}</text>
          );
        })}
      </svg>
      </div>

      {/* La vista principal es la 3D: aquí sólo se llega sin WebGL. */}
      <div className="absolute bottom-[180px] left-[250px] right-4 lg:right-[356px] flex justify-center pointer-events-auto">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-black/80 backdrop-blur px-3 py-2 text-[10px] text-zinc-300 shadow-xl">
          <span className="text-amber-300 font-semibold uppercase tracking-[0.15em]">Vista 3D no disponible</span>
          <span className="text-zinc-400">Este navegador no permite WebGL. Abre esta página en Chrome o Firefox para ver el gemelo digital 3D.</span>
          <button type="button" onClick={copyLink}
            className="px-2 py-1 rounded border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200">
            {copied ? 'Enlace copiado' : 'Copiar enlace'}
          </button>
          {onRetry3D && (
            <button type="button" onClick={onRetry3D}
              className="px-2 py-1 rounded border border-teal-500/40 bg-teal-500/10 hover:bg-teal-500/20 text-teal-200">
              Reintentar 3D
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
