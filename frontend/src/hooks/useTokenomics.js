/**
 * BeZhas-Hub — useTokenomics
 * Hook React unificado para todo el ecosistema tokenómico BEZ.
 * Conecta con: api.bez.digital:3001 (REST) + ws.bez.digital:3002 (WS)
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const API  = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const WS   = import.meta.env.VITE_WS_URL  || 'ws://localhost:3002';

export function useTokenomics(userAddress = null) {
  const [snapshot,    setSnapshot]    = useState(null);
  const [userStake,   setUserStake]   = useState(null);
  const [userFarms,   setUserFarms]   = useState([]);
  const [bridgeRoutes,setBridgeRoutes]= useState([]);
  const [events,      setEvents]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [wsLive,      setWsLive]      = useState(false);
  const wsRef = useRef(null);

  const fetchAll = useCallback(async () => {
    try {
      const urls = [
        `${API}/api/tokenomics/snapshot`,
        `${API}/api/tokenomics/bridge/routes`,
        `${API}/api/tokenomics/events?limit=30`,
        userAddress ? `${API}/api/tokenomics/user/${userAddress}` : null,
      ].filter(Boolean);

      const results = await Promise.allSettled(urls.map(u => fetch(u).then(r => r.json())));

      if (results[0]?.status === 'fulfilled') setSnapshot(results[0].value);
      if (results[1]?.status === 'fulfilled') setBridgeRoutes(results[1].value?.routes || []);
      if (results[2]?.status === 'fulfilled') setEvents(results[2].value?.events || []);
      if (userAddress && results[3]?.status === 'fulfilled') {
        const ud = results[3].value;
        setUserStake(ud?.staking || null);
        setUserFarms(ud?.farming || []);
      }
      setLoading(false);
    } catch { setLoading(false); }
  }, [userAddress]);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 30_000);

    const ws = new WebSocket(`${WS}/tokenomics`);
    wsRef.current = ws;
    ws.onopen  = () => setWsLive(true);
    ws.onclose = () => { setWsLive(false); setTimeout(fetchAll, 3000); };
    ws.onmessage = (e) => {
      try {
        const { type, data } = JSON.parse(e.data);
        if (type === 'tokenomics:snapshot') setSnapshot(data);
        if (type === 'tokenomics:event')    setEvents(prev => [data, ...prev].slice(0, 100));
        if (type === 'tokenomics:user' && data.address === userAddress) {
          setUserStake(data.staking);
          setUserFarms(data.farming);
        }
      } catch { /* ignore */ }
    };

    return () => { clearInterval(iv); ws.close(); };
  }, [fetchAll, userAddress]);

  // ── Acciones ────────────────────────────────────────────────────────────

  const stake = useCallback(async (amount) => {
    const r = await fetch(`${API}/api/tokenomics/staking/stake`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, userAddress }),
    });
    return r.json();
  }, [userAddress]);

  const unstake = useCallback(async (amount) => {
    const r = await fetch(`${API}/api/tokenomics/staking/unstake`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, userAddress }),
    });
    return r.json();
  }, [userAddress]);

  const claimRewards = useCallback(async () => {
    const r = await fetch(`${API}/api/tokenomics/staking/claim`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAddress }),
    });
    return r.json();
  }, [userAddress]);

  const farmDeposit = useCallback(async (poolId, amount) => {
    const r = await fetch(`${API}/api/tokenomics/farming/deposit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poolId, amount, userAddress }),
    });
    return r.json();
  }, [userAddress]);

  const farmHarvest = useCallback(async (poolId) => {
    const r = await fetch(`${API}/api/tokenomics/farming/harvest`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poolId, userAddress }),
    });
    return r.json();
  }, [userAddress]);

  const bridgeDeposit = useCallback(async (routeId, amount, recipient) => {
    const r = await fetch(`${API}/api/tokenomics/bridge/deposit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routeId, amount, recipient }),
    });
    return r.json();
  }, []);

  return {
    snapshot, userStake, userFarms, bridgeRoutes, events,
    loading, wsLive,
    stake, unstake, claimRewards,
    farmDeposit, farmHarvest,
    bridgeDeposit,
    refresh: fetchAll,
  };
}
