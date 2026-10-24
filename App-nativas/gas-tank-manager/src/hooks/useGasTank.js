import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthProvider';

/**
 * Estado del Gas Tank de la organización activa (saldo, movimientos, paquetes) contra
 * /api/organizations/:orgId/gas-tank/*. Sin sesión u organización devuelve `reason` para que
 * la página explique qué falta en lugar de mostrar cifras.
 */
export function useGasTank({ withActivity = false, withPackages = false } = {}) {
  const { token, apiBase, authHeaders, activeOrganization } = useAuth();
  const orgId = activeOrganization?.id || null;
  const [state, setState] = useState({ loading: false, error: null, balance: null, activity: [], packages: null });

  const call = useCallback(async (path, opts = {}) => {
    const res = await fetch(`${apiBase}/api/organizations/${orgId}/gas-tank/${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(opts.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.errors?.[0]?.msg || `Error ${res.status}`);
    return data;
  }, [apiBase, authHeaders, orgId]);

  const refresh = useCallback(async () => {
    if (!token || !orgId) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [balance, activity, packages] = await Promise.all([
        call('balance'),
        withActivity ? call('activity?limit=50') : null,
        withPackages ? call('packages') : null,
      ]);
      setState({ loading: false, error: null, balance, activity: activity?.items || [], packages });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, [call, token, orgId, withActivity, withPackages]);

  useEffect(() => { refresh(); }, [refresh]);

  const checkout = useCallback(async (body) => {
    const data = await call('recharge/checkout', { method: 'POST', body: JSON.stringify(body) });
    if (!data.url) throw new Error('El servidor no devolvió el enlace de pago');
    window.location.assign(data.url);
  }, [call]);

  const saveSettings = useCallback(async (body) => {
    const data = await call('settings', { method: 'PATCH', body: JSON.stringify(body) });
    setState((st) => ({ ...st, balance: { ...(st.balance || {}), ...data } }));
    return data;
  }, [call]);

  const reason = !token ? 'login' : !orgId ? 'organization' : null;
  const canRecharge = ['owner', 'admin', 'financial'].includes(activeOrganization?.my_role);
  return { ...state, reason, orgName: activeOrganization?.name, canRecharge, refresh, checkout, saveSettings };
}

export const eur = (n) => `${(Number(n) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
export const num = (n) => (Number(n) || 0).toLocaleString('es-ES');
