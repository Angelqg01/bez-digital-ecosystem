import React, { useState } from 'react';
import { Code2, Copy, Check, Link2, Webhook, ChevronDown, ChevronUp } from 'lucide-react';
import { SdkCall, toCurl, L2_TESTNET_CHAIN_ID } from '../engine/sdkMap';

const METHOD_STYLE: Record<SdkCall['method'], string> = {
  GET: 'text-sky-300 border-sky-500/40 bg-sky-500/10',
  POST: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
};

interface SdkCallCardProps {
  call?: SdkCall;
  bUid: string;
  stepLabel: string;
  breached: boolean;
  className?: string;
}

/**
 * La llamada real a la API de BeZhas que corresponde a la etapa en curso:
 * método, ruta, api-key de rol, contrato que la ancla, webhook y productos.
 * Es lo que convierte la animación en un simulador de SDK.
 */
export function SdkCallCard({ call, bUid, stepLabel, breached, className = 'w-[300px]' }: SdkCallCardProps) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  if (!call) return null;
  const curl = toCurl(call, bUid);
  const path = call.path.replace(':bUid', bUid);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(curl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* portapapeles bloqueado: el usuario puede seleccionar el texto */ }
  };

  return (
    <div className={`${className} rounded-lg border backdrop-blur-md shadow-xl text-[10px]
      ${breached ? 'bg-red-950/70 border-red-500/40' : 'bg-black/75 border-teal-500/25'}`}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 border-b border-white/5">
        <span className="flex items-center gap-1.5 uppercase tracking-[0.2em] text-[9px] text-teal-300">
          <Code2 size={11} /> Llamada SDK · {stepLabel}
        </span>
        {open ? <ChevronUp size={12} className="text-zinc-500" /> : <ChevronDown size={12} className="text-zinc-500" />}
      </button>

      {open && (
        <div className="p-3 flex flex-col gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`px-1.5 py-0.5 rounded border font-mono font-bold text-[9px] ${METHOD_STYLE[call.method]}`}>{call.method}</span>
            <code className="font-mono text-zinc-200 truncate" title={path}>{path}</code>
          </div>

          <div className="flex flex-wrap gap-1">
            <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
              {call.role === 'device' ? 'x-device-key' : `rol: ${call.role}`}
            </span>
            {call.products.map((p) => (
              <span key={p} className="px-1.5 py-0.5 rounded bg-teal-500/10 border border-teal-500/20 text-teal-300">{p}</span>
            ))}
          </div>

          {call.contract && (
            <div className="flex items-start gap-1.5 text-zinc-400">
              <Link2 size={11} className="mt-0.5 shrink-0 text-violet-400" />
              <span>
                <span className="text-violet-300 font-mono">{call.contract}</span>
                {call.fn && <span className="font-mono">.{call.fn}</span>}
                <span className="block text-[9px] text-zinc-500">L2 de pruebas · chainId {L2_TESTNET_CHAIN_ID} · firma única del backend (BON pendiente)</span>
              </span>
            </div>
          )}

          {call.webhook && (
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Webhook size={11} className="text-amber-400" />
              <span className="font-mono text-amber-300">{call.webhook}</span>
            </div>
          )}

          {call.note && <p className="text-zinc-400 leading-snug">{call.note}</p>}

          <div className="relative">
            <pre className="bg-zinc-950 border border-zinc-800 rounded p-2 pr-7 font-mono text-[9px] leading-relaxed text-zinc-300 whitespace-pre-wrap break-all max-h-32 overflow-auto">{curl}</pre>
            <button type="button" onClick={copy} aria-label="Copiar curl"
              className="absolute top-1.5 right-1.5 p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300">
              {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
