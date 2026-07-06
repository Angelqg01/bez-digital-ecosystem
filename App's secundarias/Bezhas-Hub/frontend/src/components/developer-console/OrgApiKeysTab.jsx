/**
 * OrgApiKeysTab — "API & Sedes": emite/lista/revoca claves API con scope por
 * organización y sede, y muestra el uso por sede (base de facturación B2B).
 * Consume el backend /api/organizations/:orgId/{api-keys,usage}. El scope viaja
 * por la org/sede activa (OrgContext + interceptor http.js).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Building2, MapPin, Plus, Copy, Trash2, Key, BarChart3, RefreshCw, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';
import http from '../../services/http';
import { useOrg } from '../../context/OrgContext';

export default function OrgApiKeysTab() {
  const { org, orgId, sites } = useOrg();
  const [keys, setKeys] = useState([]);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', sector: 'general', environment: 'development', siteId: '' });
  const [revealed, setRevealed] = useState(null); // clave en claro (se muestra 1 vez)

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [k, u] = await Promise.allSettled([
        http.get(`/api/organizations/${orgId}/api-keys`),
        http.get(`/api/organizations/${orgId}/usage`),
      ]);
      if (k.status === 'fulfilled') setKeys(k.value.data?.keys || []);
      if (u.status === 'fulfilled') setUsage(u.value.data || null);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const issue = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Ponle un nombre a la clave');
    try {
      const { data } = await http.post(`/api/organizations/${orgId}/api-keys`, {
        name: form.name, sector: form.sector, environment: form.environment,
        siteId: form.siteId || undefined,
      });
      setRevealed(data.apiKey);
      setForm({ name: '', sector: 'general', environment: 'development', siteId: '' });
      toast.success('Clave emitida — cópiala, no se vuelve a mostrar');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudo emitir la clave');
    }
  };

  const revoke = async (id) => {
    try {
      await http.delete(`/api/organizations/${orgId}/api-keys/${id}`);
      toast.success('Clave revocada');
      load();
    } catch {
      toast.error('No se pudo revocar');
    }
  };

  const siteName = (id) => sites.find((s) => s.id === id)?.name || '—';

  if (!orgId) {
    return (
      <div className="text-center py-16">
        <Building2 className="mx-auto text-gray-400 mb-3" size={40} />
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Selecciona una organización</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Elige tu organización en el selector del Header para emitir y gestionar claves API por sede.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Building2 size={20} className="text-cyan-500" /> {org?.name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Claves API por sede · API/SDK/Plugin WordPress</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      {/* Clave recién emitida (una sola vez) */}
      {revealed && (
        <div className="rounded-xl border border-emerald-400/40 bg-emerald-50 dark:bg-emerald-900/20 p-4">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-2">⚠️ Guarda esta clave: no se volverá a mostrar.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-sm text-gray-900 dark:text-white break-all bg-white dark:bg-gray-900 rounded-lg px-3 py-2 border border-emerald-300/40">{revealed}</code>
            <button onClick={() => { navigator.clipboard?.writeText(revealed); toast.success('Copiada'); }} className="p-2 rounded-lg bg-emerald-500 text-white"><Copy size={16} /></button>
            <button onClick={() => setRevealed(null)} className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"><Check size={16} /></button>
          </div>
        </div>
      )}

      {/* Emitir nueva clave */}
      <form onSubmit={issue} className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">Nombre de la clave</span>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ERP Sede Madrid" className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">Sede (opcional)</span>
          <select value={form.siteId} onChange={(e) => setForm({ ...form, siteId: e.target.value })} className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white">
            <option value="">Toda la organización</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">Entorno</span>
          <select value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })} className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white">
            <option value="development">Test</option>
            <option value="production">Producción</option>
          </select>
        </label>
        <button type="submit" className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold">
          <Plus size={16} /> Emitir clave
        </button>
      </form>

      {/* Listado de claves */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 flex items-center gap-2">
          <Key size={14} /> Claves activas
        </div>
        {keys.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">Aún no hay claves. Emite la primera arriba.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {keys.map((k) => (
              <li key={k.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{k.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${k.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-gray-200 text-gray-500 dark:bg-gray-700'}`}>{k.status}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">{k.environment}</span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5 flex items-center gap-2">
                    {k.masked} · <MapPin size={11} className="inline" /> {k.siteId ? siteName(k.siteId) : 'Toda la org'}
                  </div>
                </div>
                {k.status === 'active' && (
                  <button onClick={() => revoke(k.id)} className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Revocar"><Trash2 size={16} /></button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Uso por sede */}
      {usage && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
            <BarChart3 size={16} className="text-cyan-500" /> Uso de API ({usage.totalRequests?.toLocaleString?.() || 0} llamadas · {usage.since})
          </h4>
          {(!usage.bySite || usage.bySite.length === 0) ? (
            <p className="text-sm text-gray-400">Sin actividad registrada todavía.</p>
          ) : (
            <ul className="space-y-1.5">
              {usage.bySite.map((row, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-200 flex items-center gap-2"><MapPin size={13} className="text-gray-400" /> {row.siteId ? siteName(row.siteId) : 'Toda la org'}</span>
                  <span className="font-mono text-gray-900 dark:text-white">{row.requests.toLocaleString()} req {row.errorRate != null ? `· ${row.errorRate}% err` : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
