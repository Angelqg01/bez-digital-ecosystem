import React, { useEffect, useState } from 'react';
import { Thermometer, Droplets, Activity, ShieldCheck, ShieldAlert, Cpu, X } from 'lucide-react';
import { SimulationStep } from '../engine/types';
import { telemetryProof, TelemetryProof } from '../engine/evidence';

const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;
const VEHICLE_NAME: Record<string, string> = { camion: 'Camión frigorífico', buque: 'Buque portacontenedores', avion: 'Avión de carga', none: 'Vehículo' };

/**
 * Ficha del vehículo (clic en la escena 3D): telemetría en vivo del Edge Node y
 * prueba de inclusión de la última lectura frente a la raíz del lote, como
 * GET /v1/iot/proof + TelemetryAnchor.verify.
 */
export function VehicleCard({ step, bUid, breached, onClose }: { step: SimulationStep; bUid: string; breached: boolean; onClose: () => void }) {
  const [proof, setProof] = useState<TelemetryProof | null>(null);
  useEffect(() => {
    let alive = true;
    telemetryProof(step, breached).then((p) => { if (alive) setProof(p); }).catch(() => { if (alive) setProof(null); });
    return () => { alive = false; };
  }, [step, breached]);

  const t = step.telemetry;
  return (
    <div className={`w-[310px] rounded-lg border bg-black/85 backdrop-blur-md shadow-2xl text-[10px] ${breached ? 'border-red-500/40' : 'border-teal-500/30'}`}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <span className="flex items-center gap-1.5 uppercase tracking-[0.2em] text-[9px] text-teal-300">
          <Cpu size={11} /> {VEHICLE_NAME[step.vehicle] ?? 'Vehículo'} · Edge Node EDGE-8842
        </span>
        <button type="button" onClick={onClose} aria-label="Cerrar ficha del vehículo" className="text-zinc-500 hover:text-white"><X size={12} /></button>
      </div>
      <div className="p-3 flex flex-col gap-2">
        {t ? (
          <div className="grid grid-cols-3 gap-1.5 font-mono">
            <span className={`flex flex-col rounded border px-2 py-1 ${breached ? 'border-red-500/40 text-red-300' : 'border-zinc-800 text-sky-300'}`}>
              <span className="flex items-center gap-1 text-[8px] text-zinc-500"><Thermometer size={9} /> TEMP</span>{t.temp}
            </span>
            <span className="flex flex-col rounded border border-zinc-800 px-2 py-1 text-cyan-300">
              <span className="flex items-center gap-1 text-[8px] text-zinc-500"><Droplets size={9} /> HUMEDAD</span>{t.humidity}
            </span>
            <span className={`flex flex-col rounded border px-2 py-1 ${t.shock !== '0.0g' ? 'border-amber-500/40 text-amber-300' : 'border-zinc-800 text-emerald-300'}`}>
              <span className="flex items-center gap-1 text-[8px] text-zinc-500"><Activity size={9} /> IMPACTO</span>{t.shock}
            </span>
          </div>
        ) : (
          <p className="text-zinc-500">Sin telemetría en esta etapa.</p>
        )}
        <p className="text-zinc-400 leading-snug">
          Lecturas firmadas por el dispositivo (ECDSA P-256) y enviadas con <code className="text-teal-300">POST /v1/iot/telemetry</code>;
          el lote se ancla con <code className="text-teal-300">POST /v1/iot/anchor/{bUid}</code>.
        </p>
        {proof && (
          <div className="rounded border border-zinc-800 bg-zinc-950/70 p-2 font-mono text-[9px] flex flex-col gap-1">
            <span className="text-zinc-500 uppercase tracking-widest text-[8px]">GET /v1/iot/proof · lectura #{proof.leafIndex}</span>
            <span className="text-zinc-400" title={proof.leaf}>hoja <span className="text-zinc-200">{short(proof.leaf)}</span></span>
            <span className="text-zinc-400" title={proof.root}>raíz <span className="text-violet-300">{short(proof.root)}</span> <span className="text-zinc-600">· {proof.rows.length} lecturas</span></span>
            {proof.proof.map((h, i) => (
              <span key={h + i} className="text-zinc-600" title={h}>hermano {i + 1} {short(h)}</span>
            ))}
            <span className={`flex items-center gap-1 ${proof.verified ? 'text-emerald-400' : 'text-red-400'}`}>
              {proof.verified ? <ShieldCheck size={10} /> : <ShieldAlert size={10} />}
              {proof.verified ? 'Prueba válida: la lectura está en el lote anclado' : 'La prueba no verifica'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
