import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, Fingerprint, GitBranch } from 'lucide-react';
import { SimulationStep } from '../engine/types';
import { SdkCall } from '../engine/sdkMap';
import { evidenceForStep, StepEvidence } from '../engine/evidence';

const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;

/**
 * Evidencia de una etapa: hash del payload (como cargolink_transitions) y, en
 * las etapas de telemetría, raíz Merkle del lote con prueba de inclusión
 * verificada en el navegador con el algoritmo de TelemetryAnchor.verify.
 */
export function EvidenceBlock({ step, call, bUid, breached }: { step: SimulationStep; call?: SdkCall; bUid: string; breached: boolean }) {
  const [ev, setEv] = useState<StepEvidence | null>(null);
  useEffect(() => {
    let alive = true;
    evidenceForStep(step, call, bUid, breached).then((e) => { if (alive) setEv(e); }).catch(() => { if (alive) setEv(null); });
    return () => { alive = false; };
  }, [step, call, bUid, breached]);

  if (!ev) return null;
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950/70 p-2 text-[9px] font-mono flex flex-col gap-1">
      <span className="flex items-center gap-1 text-zinc-500 uppercase tracking-widest text-[8px]"><Fingerprint size={10} /> Evidencia</span>
      <span className="text-zinc-400" title={ev.payloadHash}>
        payload_hash <span className="text-zinc-200">{short(ev.payloadHash)}</span>
      </span>
      {ev.merkle && (
        <>
          <span className="flex items-center gap-1 text-zinc-400" title={ev.merkle.root}>
            <GitBranch size={10} className="text-violet-400" /> raíz Merkle <span className="text-violet-300">{short(ev.merkle.root)}</span>
            <span className="text-zinc-600">· {ev.merkle.leaves} lecturas</span>
          </span>
          <span className={`flex items-center gap-1 ${ev.merkle.verified ? 'text-emerald-400' : 'text-red-400'}`}>
            {ev.merkle.verified ? <ShieldCheck size={10} /> : <ShieldAlert size={10} />}
            Lectura #{ev.merkle.leafIndex} {ev.merkle.verified ? 'verificada' : 'NO verifica'} con {ev.merkle.proofLength} hermanos
          </span>
          <span className="text-zinc-600 leading-snug">Mismo algoritmo que TelemetryAnchor.verify (sha256, pares ordenados). Consultable con GET /v1/iot/proof.</span>
        </>
      )}
    </div>
  );
}
