/**
 * BeZhas-Hub — useAgentRuntime
 * Hook React para consumir el Agent Runtime desde el frontend.
 * Conecta con: api.bez.digital:3001 (REST) + ws.bez.digital:3002 (WebSocket)
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const WS_BASE  = import.meta.env.VITE_WS_URL  || 'ws://localhost:3002';

export function useAgentRuntime() {
  const [agents,       setAgents]       = useState([]);
  const [tasks,        setTasks]        = useState([]);
  const [hitlQueue,    setHitlQueue]    = useState([]);
  const [aegisAlerts,  setAegisAlerts]  = useState([]);
  const [connected,    setConnected]    = useState(false);
  const [loading,      setLoading]      = useState(true);
  const wsRef = useRef(null);

  // ─── REST: fetch estado inicial ───────────────────────────

  const fetchStatus = useCallback(async () => {
    try {
      const [agentsRes, tasksRes, hitlRes, aegisRes] = await Promise.allSettled([
        fetch(`${API_BASE}/api/agents`).then(r => r.json()),
        fetch(`${API_BASE}/api/tasks?limit=20`).then(r => r.json()),
        fetch(`${API_BASE}/api/hitl/pending`).then(r => r.json()),
        fetch(`${API_BASE}/api/aegis/alerts?limit=10`).then(r => r.json()),
      ]);

      if (agentsRes.status === 'fulfilled') setAgents(agentsRes.value?.agents || []);
      if (tasksRes.status === 'fulfilled')  setTasks(tasksRes.value?.tasks || []);
      if (hitlRes.status === 'fulfilled')   setHitlQueue(hitlRes.value?.pending || []);
      if (aegisRes.status === 'fulfilled')  setAegisAlerts(aegisRes.value?.alerts || []);

      setLoading(false);
    } catch (err) {
      console.error('[useAgentRuntime] Fetch error:', err);
      setLoading(false);
    }
  }, []);

  // ─── WebSocket: actualizaciones en tiempo real ────────────

  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${WS_BASE}/agent-runtime`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      console.log('[useAgentRuntime] WebSocket conectado');
    };

    ws.onmessage = (e) => {
      try {
        const { type, data } = JSON.parse(e.data);
        switch (type) {
          case 'agent:updated':
            setAgents(prev => prev.map(a => a.id === data.id ? { ...a, ...data } : a));
            break;
          case 'task:queued':
            setTasks(prev => [data, ...prev].slice(0, 50));
            break;
          case 'task:completed':
          case 'task:failed':
            setTasks(prev => prev.map(t => t.id === data.id ? { ...t, ...data } : t));
            break;
          case 'hitl:new':
            setHitlQueue(prev => [data, ...prev]);
            break;
          case 'hitl:resolved':
            setHitlQueue(prev => prev.filter(h => h.taskId !== data.taskId));
            break;
          case 'aegis:alert':
            setAegisAlerts(prev => [data, ...prev].slice(0, 100));
            break;
          default:
            break;
        }
      } catch { /* ignore malformed */ }
    };

    ws.onclose = () => {
      setConnected(false);
      console.log('[useAgentRuntime] WebSocket cerrado. Reconectando en 3s...');
      setTimeout(connectWS, 3000);
    };

    ws.onerror = (e) => console.error('[useAgentRuntime] WS error:', e);
  }, []);

  useEffect(() => {
    fetchStatus();
    connectWS();
    const interval = setInterval(fetchStatus, 30_000); // refresh cada 30s

    return () => {
      clearInterval(interval);
      wsRef.current?.close();
    };
  }, [fetchStatus, connectWS]);

  // ─── Acciones ────────────────────────────────────────────

  const dispatchTask = useCallback(async (taskPayload) => {
    const res = await fetch(`${API_BASE}/api/tasks`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(taskPayload),
    });
    return res.json();
  }, []);

  const resolveHITL = useCallback(async (taskId, approved) => {
    const endpoint = approved ? 'approve' : 'reject';
    const res = await fetch(`${API_BASE}/api/hitl/${endpoint}/${taskId}`, { method: 'POST' });
    const result = await res.json();
    if (result.ok) {
      setHitlQueue(prev => prev.filter(h => h.taskId !== taskId));
    }
    return result;
  }, []);

  return {
    agents, tasks, hitlQueue, aegisAlerts,
    connected, loading,
    dispatchTask, resolveHITL, refresh: fetchStatus,
  };
}
