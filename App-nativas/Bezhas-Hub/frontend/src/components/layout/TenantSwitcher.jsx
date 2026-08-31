/**
 * TenantSwitcher — selector de Organización / Sede para el Header + chip de la
 * identidad única BeZhas_ID. Al elegir sede, OrgContext persiste la selección y
 * el interceptor de http.js scopea TODAS las llamadas (X-Org-Id / X-Site-Id).
 */
import React, { useState, useRef, useEffect } from 'react';
import { Building2, ChevronDown, MapPin, Check, Fingerprint } from 'lucide-react';
import { useOrg } from '../../context/OrgContext';
import { useAuth } from '../../context/AuthContext';

export default function TenantSwitcher() {
  const { orgs, sites, org, site, setOrg, setSite } = useOrg();
  const { bezhasId } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Sin organizaciones: no mostramos el selector (solo el chip de identidad si existe).
  if (!orgs.length) {
    return bezhasId ? <BezhasIdChip bezhasId={bezhasId} /> : null;
  }

  return (
    <div className="flex items-center gap-2">
      <BezhasIdChip bezhasId={bezhasId} />
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors max-w-[220px]"
          title="Cambiar organización / sede"
        >
          <Building2 size={16} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
          <span className="flex flex-col items-start leading-tight overflow-hidden">
            <span className="text-xs font-semibold text-gray-900 dark:text-white truncate max-w-[150px]">
              {org?.name || 'Selecciona organización'}
            </span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[150px]">
              {site ? site.name : 'Toda la organización'}
            </span>
          </span>
          <ChevronDown size={14} className="text-gray-400 shrink-0" />
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
            {/* Organizaciones */}
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
              Organización
            </div>
            <ul className="max-h-44 overflow-y-auto py-1">
              {orgs.map((o) => (
                <li key={o.id}>
                  <button
                    onClick={() => setOrg(o.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
                  >
                    <Building2 size={14} className="text-gray-400" />
                    <span className="flex-1 text-left truncate">{o.name}</span>
                    {o.id === org?.id && <Check size={14} className="text-cyan-500" />}
                  </button>
                </li>
              ))}
            </ul>

            {/* Sedes de la organización seleccionada */}
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-y border-gray-100 dark:border-gray-800">
              Sede
            </div>
            <ul className="max-h-44 overflow-y-auto py-1">
              <li>
                <button
                  onClick={() => { setSite(null); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
                >
                  <MapPin size={14} className="text-gray-400" />
                  <span className="flex-1 text-left">Toda la organización</span>
                  {!site && <Check size={14} className="text-cyan-500" />}
                </button>
              </li>
              {sites.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => { setSite(s.id); setOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
                  >
                    <MapPin size={14} className="text-gray-400" />
                    <span className="flex-1 text-left truncate">{s.name}</span>
                    <span className="text-[10px] text-gray-400">{s.type}</span>
                    {s.id === site?.id && <Check size={14} className="text-cyan-500" />}
                  </button>
                </li>
              ))}
              {sites.length === 0 && (
                <li className="px-3 py-2 text-xs text-gray-400">Esta organización aún no tiene sedes.</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function BezhasIdChip({ bezhasId }) {
  if (!bezhasId) return null;
  const copy = () => { try { navigator.clipboard?.writeText(bezhasId); } catch { /* noop */ } };
  return (
    <button
      onClick={copy}
      title="Tu BeZhas_ID único — clic para copiar"
      className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-300/40 dark:border-cyan-600/40 text-cyan-700 dark:text-cyan-300"
    >
      <Fingerprint size={13} />
      <span className="text-[11px] font-mono font-semibold">{bezhasId}</span>
    </button>
  );
}
