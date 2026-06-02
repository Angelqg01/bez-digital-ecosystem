'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import useSWR, { mutate } from 'swr';
import { fetcher, api } from './api';
import type {
    AgentRegistry, AgentMetrics, AgentAnalytics,
    BEZTokenData, MCPTool, MCPInvokeResponse,
    AgentSSEEvent,
} from './agent-types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const opts = {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
    onErrorRetry: (
        error: { status?: number },
        _key: string,
        _config: unknown,
        revalidate: (opts: { retryCount: number }) => void,
        { retryCount }: { retryCount: number },
    ) => {
        if (error?.status === 0) return;
        if (retryCount >= 3) return;
        setTimeout(() => revalidate({ retryCount }), 5000 * (retryCount + 1));
    },
};

// ── Agent Registry (all agents + Aegis status + MCP count) ──
export function useAgentRegistry() {
    return useSWR<{ status: string; data: AgentRegistry }>(
        '/agents',
        fetcher,
        { ...opts, refreshInterval: 30000 },
    );
}

// ── Agent Metrics (per-agent detail) ──
export function useAgentMetrics(agentId: string | null, days = 7) {
    return useSWR<{ status: string; data: AgentMetrics }>(
        agentId ? `/agents/${agentId}/metrics?days=${days}` : null,
        fetcher,
        opts,
    );
}

// ── Platform Analytics (all agents 24h summary) ──
export function useAgentAnalytics() {
    return useSWR<{ status: string; data: AgentAnalytics }>(
        '/agents/analytics',
        fetcher,
        { ...opts, refreshInterval: 20000 },
    );
}

// ── BEZ Token Data (price, burn, supply) ──
export function useBEZToken() {
    return useSWR<{ status: string; data: BEZTokenData }>(
        '/agents/token',
        fetcher,
        { ...opts, refreshInterval: 15000 },
    );
}

// ── MCP Tools List ──
export function useMCPTools() {
    return useSWR<{ status: string; data: { tools: MCPTool[]; total: number } }>(
        '/agents/mcp/tools',
        fetcher,
        { ...opts, refreshInterval: 60000 },
    );
}

// ── MCP Tool Invocation (mutation) ──
export function useMCPInvoke() {
    const [isInvoking, setIsInvoking] = useState(false);
    const [lastResult, setLastResult] = useState<MCPInvokeResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const invoke = useCallback(async (tool: string, parameters: Record<string, unknown>) => {
        setIsInvoking(true);
        setError(null);
        try {
            const result = await api.post<MCPInvokeResponse>('/agents/mcp/invoke', { tool, parameters });
            setLastResult(result);
            // Revalidate analytics after invocation
            mutate('/agents/analytics');
            return result;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'MCP invocation failed';
            setError(message);
            throw err;
        } finally {
            setIsInvoking(false);
        }
    }, []);

    return { invoke, isInvoking, lastResult, error };
}

// ── SSE Live Agent Events Stream ──
export function useAgentSSE() {
    const [events, setEvents] = useState<AgentSSEEvent[]>([]);
    const [connected, setConnected] = useState(false);
    const esRef = useRef<EventSource | null>(null);

    useEffect(() => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('bezhas_token') : null;
        const params = token ? `?token=${encodeURIComponent(token)}` : '';
        const es = new EventSource(`${API_BASE}/agents/stream${params}`);
        esRef.current = es;

        es.onopen = () => setConnected(true);

        es.addEventListener('agent_event', (e) => {
            try {
                const data: AgentSSEEvent = JSON.parse(e.data);
                setEvents(prev => [data, ...prev].slice(0, 100));
            } catch { /* malformed event */ }
        });

        es.onerror = () => {
            setConnected(false);
            // EventSource auto-reconnects
        };

        return () => {
            es.close();
            esRef.current = null;
        };
    }, []);

    return { events, connected };
}

// ── Agent Contract Deployments ──
export interface AgentContractInfo {
    name: string;
    address: string | null;
    deployed: boolean;
}

export function useAgentContracts(agentId: string | null) {
    return useSWR<{ status: string; data: { agent_id: string; contracts: AgentContractInfo[]; total_deployed: number } }>(
        agentId ? `/contracts/agent/${agentId}` : null,
        fetcher,
        { ...opts, refreshInterval: 120000 },
    );
}

// ── All Deployed Contracts ──
export function useDeployments() {
    return useSWR<{ status: string; data: { chainId: number; core: Record<string, string>; sectors: Record<string, Record<string, string>>; total: number } }>(
        '/contracts/deployments',
        fetcher,
        { ...opts, refreshInterval: 300000 },
    );
}
