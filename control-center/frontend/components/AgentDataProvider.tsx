'use client';

import { createContext, useContext, useMemo } from 'react';
import {
    useAgentRegistry,
    useAgentAnalytics,
    useBEZToken,
    useMCPTools,
    useMCPInvoke,
    useAgentSSE,
} from '@/lib/agent-hooks';
import type { AgentDataBridge, MCPInvokeResponse } from '@/lib/agent-types';

const AgentDataContext = createContext<AgentDataBridge | null>(null);

/**
 * Provides real-time agent data from the backend to all child components.
 * Wraps the JSX agent modules so they can access live data instead of mocks.
 */
export function AgentDataProvider({ children }: { children: React.ReactNode }) {
    const { data: registryRes, isLoading: regLoading } = useAgentRegistry();
    const { data: analyticsRes } = useAgentAnalytics();
    const { data: tokenRes } = useBEZToken();
    const { data: mcpRes } = useMCPTools();
    const { invoke } = useMCPInvoke();
    const { events: liveEvents } = useAgentSSE();

    const value = useMemo<AgentDataBridge>(() => ({
        registry: registryRes?.data ?? null,
        analytics: analyticsRes?.data ?? null,
        tokenData: tokenRes?.data ?? null,
        mcpTools: mcpRes?.data?.tools ?? [],
        liveEvents,
        isLoading: regLoading,
        invokeTool: async (tool: string, params: Record<string, unknown>) => {
            return invoke(tool, params) as Promise<MCPInvokeResponse>;
        },
    }), [registryRes, analyticsRes, tokenRes, mcpRes, liveEvents, regLoading, invoke]);

    return (
        <AgentDataContext.Provider value={value}>
            {children}
        </AgentDataContext.Provider>
    );
}

/**
 * Hook for JSX/TSX components to access live agent data.
 * Falls back to null if used outside the provider (backward-compatible with mock data).
 */
export function useAgentData(): AgentDataBridge | null {
    return useContext(AgentDataContext);
}

export default AgentDataProvider;
