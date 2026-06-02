/**
 * useAgentBridge.js — Universal hook for individual agent JSX files.
 * 
 * Replaces the MOCK → useState → setInterval pattern with real API data.
 * Each agent keeps its own visual/canvas/tabs; but metrics, logs, contracts,
 * and MCP invocation now come from the backend.
 *
 * Usage in any agent file:
 *   import { useAgentBridge } from './use-agent-bridge';
 *   function ShipTrackAgent() {
 *     const bridge = useAgentBridge('shiptrack');
 *     // bridge.stats — { total_actions, critical_alerts, avg_confidence, on_chain_txs }
 *     // bridge.timeseries — daily action data for sparklines
 *     // bridge.logs — recent AI logs for this agent
 *     // bridge.contracts — deployed contracts relevant to this agent
 *     // bridge.invoke(toolName, params) — call MCP tool
 *     // bridge.loading / bridge.error
 *     // bridge.bezPrice — current BEZ price
 *     return <div>...</div>;
 *   }
 */
import { useState, useEffect, useCallback, useRef } from "react";

const API_BASE = typeof window !== 'undefined'
    ? (window.__BEZHAS_API_URL || 'http://localhost:3001/api')
    : 'http://localhost:3001/api';

function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('bezhas_token');
        if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

async function apiFetch(path) {
    const res = await fetch(`${API_BASE}${path}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.data || json;
}

async function apiPost(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.data || json;
}

export function useAgentBridge(agentId, options = {}) {
    const { refreshMs = 30000 } = options;
    const [metrics, setMetrics] = useState(null);
    const [contracts, setContracts] = useState([]);
    const [bezPrice, setBezPrice] = useState(null);
    const [source, setSource] = useState({
        metrics: 'loading',
        contracts: 'loading',
        token: 'loading',
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const load = useCallback(async () => {
        if (!agentId) return;
        try {
            const [metricsRes, contractsRes, tokenRes] = await Promise.allSettled([
                apiFetch(`/agents/${agentId}/metrics?days=7`),
                apiFetch(`/contracts/agent/${agentId}`),
                apiFetch('/agents/token'),
            ]);
            if (!mountedRef.current) return;
            const nextSource = {};
            if (metricsRes.status === 'fulfilled') {
                setMetrics(metricsRes.value);
                nextSource.metrics = metricsRes.value?.source || 'core-db';
            } else {
                setMetrics({
                    source: 'unavailable',
                    stats: null,
                    timeseries: [],
                    recent_logs: [],
                    error: metricsRes.reason?.message || 'metrics unavailable',
                });
                nextSource.metrics = 'unavailable';
            }
            if (contractsRes.status === 'fulfilled') {
                setContracts(contractsRes.value?.contracts || []);
                nextSource.contracts = 'deployments';
            } else {
                setContracts([]);
                nextSource.contracts = 'unavailable';
            }
            if (tokenRes.status === 'fulfilled') {
                setBezPrice(tokenRes.value?.price ?? null);
                nextSource.token = tokenRes.value?.source || (tokenRes.value?.price == null ? 'unavailable' : 'core');
            } else {
                setBezPrice(null);
                nextSource.token = 'unavailable';
            }
            setSource(nextSource);
            const failures = [metricsRes, contractsRes, tokenRes].filter(r => r.status === 'rejected');
            setError(failures.length === 3 ? 'Core agent bridge unavailable' : null);
        } catch (err) {
            if (mountedRef.current) setError(err.message);
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, [agentId]);

    useEffect(() => {
        load();
        if (refreshMs > 0) {
            const interval = setInterval(load, refreshMs);
            return () => clearInterval(interval);
        }
    }, [load, refreshMs]);

    const invoke = useCallback(async (toolName, params = {}) => {
        const clean = String(toolName).replace(/[^\w_-]/g, '');
        return apiPost('/agents/mcp/invoke', { tool: clean, parameters: params });
    }, []);

    return {
        // Metrics
        stats: metrics?.stats || null,
        timeseries: metrics?.timeseries || [],
        logs: metrics?.recent_logs || [],
        // Contracts
        contracts,
        deployedContracts: contracts.filter(c => c.deployed),
        contractCoverage: contracts.length ? contracts.filter(c => c.deployed).length / contracts.length : 0,
        // Token
        bezPrice,
        source,
        isLive: source.metrics !== 'unavailable' || source.contracts !== 'unavailable' || source.token !== 'unavailable',
        // MCP
        invoke,
        // State
        loading,
        error,
        reload: load,
    };
}

export default useAgentBridge;
