import React, { useState } from 'react';
import { FlaskConical, X, ShieldCheck, ShieldAlert, Trash2 } from 'lucide-react';
import {
  SandboxConfig, SANDBOX_ROLES, SandboxRole, checkTestEnvironment, pingSandbox, clearSandboxConfig,
} from '../engine/sandbox';

interface Props {
  config: SandboxConfig;
  onChange: (c: SandboxConfig) => void;
  onClose: () => void;
  /** No se puede cambiar la configuración mientras corre la simulación. */
  locked: boolean;
}

/** Configuración del modo Sandbox: URL de una API de PRUEBAS y claves de rol de prueba. */
export function SandboxPanel({ config, onChange, onClose, locked }: Props) {
  const [ping, setPing] = useState<{ ok: boolean; detail: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const env = checkTestEnvironment(config.baseUrl);
  const filled = SANDBOX_ROLES.filter((r) => config.keys[r]).length;

  const test = async () => { setBusy(true); setPing(await pingSandbox(config.baseUrl)); setBusy(false); };
  const setKey = (r: SandboxRole, v: string) => onChange({ ...config, keys: { ...config.keys, [r]: v.trim() || undefined } });

  return (
    <div role="dialog" aria-label="Configuración del Sandbox"
      className="w-[340px] max-h-full overflow-y-auto custom-scrollbar rounded-lg border border-amber-500/30 bg-black/90 backdrop-blur-md shadow-2xl text-[10px]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 sticky top-0 bg-black/95">
        <span className="flex items-center gap-1.5 uppercase tracking-[0.2em] text-[9px] text-amber-300"><FlaskConical size={11} /> Sandbox · API de pruebas</span>
        <button type="button" onClick={onClose} aria-label="Cerrar configuración" className="text-zinc-500 hover:text-white"><X size={12} /></button>
      </div>
      <div className="p-3 flex flex-col gap-2.5">
        <p className="text-zinc-400 leading-snug">
          Cada etapa ejecuta de verdad su llamada contra <b className="text-zinc-200">una API de pruebas</b> y muestra la respuesta real.
          Usa claves de rol <b className="text-zinc-200">de prueba</b>: se guardan sólo en esta pestaña (sessionStorage) y no se envían a ningún otro sitio.
        </p>

        <label className="flex flex-col gap-1">
          <span className="text-[8px] uppercase tracking-widest text-zinc-500">URL base de CargoLink</span>
          <input value={config.baseUrl} disabled={locked} onChange={(e) => { setPing(null); onChange({ ...config, baseUrl: e.target.value }); }}
            spellCheck={false} className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-[10px] text-zinc-200 focus:border-amber-500/60 outline-none" />
        </label>
        <span className={`flex items-center gap-1 ${env.ok ? 'text-emerald-400' : 'text-red-400'}`}>
          {env.ok ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />}
          {env.ok ? `Permitido: ${env.reason}` : `Bloqueado: ${env.reason}`}
        </span>

        <div className="grid grid-cols-1 gap-1.5">
          {SANDBOX_ROLES.map((r) => (
            <label key={r} className="flex items-center gap-2">
              <span className="w-[62px] shrink-0 font-mono text-zinc-400">{r}</span>
              <input type="password" autoComplete="off" disabled={locked} value={config.keys[r] ?? ''} placeholder="clave de prueba"
                onChange={(e) => setKey(r, e.target.value)}
                className="flex-1 min-w-0 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-[10px] text-zinc-200 focus:border-amber-500/60 outline-none" />
            </label>
          ))}
        </div>
        <span className="text-zinc-500">{filled}/5 claves. Sin la clave de un rol, sus etapas se saltan indicando el motivo.</span>

        <div className="flex items-center gap-2">
          <button type="button" onClick={test} disabled={busy || !env.ok}
            className="px-2.5 py-1 rounded border border-amber-500/40 bg-amber-500/10 text-amber-200 disabled:opacity-40 hover:bg-amber-500/20">
            {busy ? 'Probando…' : 'Probar conexión'}
          </button>
          <button type="button" disabled={locked} onClick={() => { clearSandboxConfig(); onChange({ ...config, keys: {} }); setPing(null); }}
            className="flex items-center gap-1 px-2 py-1 rounded border border-zinc-700 text-zinc-400 hover:text-white disabled:opacity-40">
            <Trash2 size={10} /> Borrar claves
          </button>
        </div>
        {ping && <span className={ping.ok ? 'text-emerald-400' : 'text-red-400'}>{ping.ok ? '✔' : '✖'} {ping.detail}</span>}
        {locked && <span className="text-amber-300">La configuración se bloquea mientras corre la simulación.</span>}
      </div>
    </div>
  );
}
