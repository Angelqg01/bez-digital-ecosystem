/**
 * useMe — resolves the authenticated user's real backend role once on mount
 * and refreshes it whenever the wallet session changes. Drives UI gating:
 *   - is_operator → SCADA dispatch controls
 *   - is_admin    → OPERARIOS (operator management) section
 */
import { useEffect, useState, useCallback } from 'react';
import { getMe } from '../api';
import { onWalletEvent } from '../shared/bezhas-wallet-auth.js';

const ANON = { role: 'anonymous', is_operator: false, is_admin: false, persisted: false };

export default function useMe() {
  const [me, setMe] = useState(ANON);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setMe(await getMe());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Re-resolve role on in-app login/logout and on wallet account/chain changes.
    const onAuth = () => refresh();
    if (typeof window !== 'undefined') window.addEventListener('bezhas-auth-change', onAuth);
    const off = onWalletEvent(() => refresh());
    return () => {
      if (typeof window !== 'undefined') window.removeEventListener('bezhas-auth-change', onAuth);
      if (typeof off === 'function') off();
    };
  }, [refresh]);

  return { me, loading, refresh };
}
