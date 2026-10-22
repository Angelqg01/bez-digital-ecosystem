'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '../../lib/hubApi';
import { useUserStore } from '../../stores/userStore';

export type Account = {
  bezhasId: string | null;
  email: string | null;
  username: string | null;
  emailVerified: boolean;
  plan: { id: string; name: string; status: string; renewsAt: string | null } | null;
};

/** Estado de la cuenta con la sesión del Hub: BeZhas ID, email confirmado y plan vigente. */
export function useAccount() {
  const token = useUserStore((s) => s.token);
  const [hydrated, setHydrated] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => setHydrated(true), []);

  const refresh = useCallback(async () => {
    if (!token) { setAccount(null); setLoading(false); return null; }
    try {
      const r = await api<{ account: Account }>('/api/billing/account', { token });
      setAccount(r.account);
      return r.account;
    } catch (e) {
      // Sesión caducada o inválida: se descarta para que la interfaz pida entrar en vez de ofrecer «crear cuenta» con un token muerto.
      if (e instanceof ApiError && e.status === 401) useUserStore.getState().logout();
      setAccount(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { if (hydrated) void refresh(); }, [hydrated, refresh]);

  return { hydrated, token, account, loading: !hydrated || loading, refresh };
}
