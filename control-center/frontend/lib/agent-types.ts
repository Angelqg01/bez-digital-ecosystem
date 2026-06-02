// ── Agent-specific TypeScript types for the Agents Dashboard ──

// ── MCP Tool Definition ──
export interface MCPTool {
    name: string;
    description?: string;
    endpoint?: string;
    parameters?: Record<string, { type: string; description?: string; required?: boolean }>;
}

// ── Agent Activity (from ai_logs aggregation) ──
export interface AgentActivity {
    actions_24h: number;
    alerts_24h: number;
    last_action: string | null;
}

// ── Individual Agent in Registry ──
export interface AgentEntry {
    id: string;
    group: string;
    activity: AgentActivity;
}

// ── Agent Group ──
export interface AgentGroup {
    id: string;
    name: string;
    agents: AgentEntry[];
}

// ── Full Agent Registry Response ──
export interface AgentRegistry {
    total_agents: number;
    total_groups: number;
    mcp_tools: number;
    aegis_status: string;
    aegis_mode: string;
    aegis_models: Record<string, boolean>;
    groups: AgentGroup[];
}

// ── Agent Metrics (per-agent detail) ──
export interface AgentMetricsStats {
    total_actions: number;
    critical_alerts: number;
    warnings: number;
    avg_confidence: string | null;
    on_chain_txs: number;
    total_gas_used: string;
}

export interface AgentTimeseriesPoint {
    date: string;
    actions: number;
    alerts: number;
}

export interface AgentMetrics {
    agent_id: string;
    period_days: number;
    stats: AgentMetricsStats;
    timeseries: AgentTimeseriesPoint[];
    recent_logs: Array<{
        id: number;
        action: string;
        severity: string;
        confidence: number | null;
        created_at: string;
        tx_hash: string | null;
        gas_used: string | null;
    }>;
}

// ── Agent Analytics (platform-wide 24h) ──
export interface AgentAnalytics {
    agents_active: number;
    total_actions_24h: number;
    critical_alerts_24h: number;
    bez_burned_24h: string;
    per_agent: Array<{
        module: string;
        actions: number;
        critical: number;
        warnings: number;
        avg_confidence: string | null;
        last_activity: string;
    }>;
}

// ── BEZ Token Data ──
export interface BEZTokenData {
    price: number;
    total_burned: number;
    circulating_supply: number | null;
    last_updated: string;
}

// ── MCP Tool Invocation ──
export interface MCPInvokeRequest {
    tool: string;
    parameters: Record<string, unknown>;
}

export interface MCPInvokeResponse {
    status: string;
    data: {
        success: boolean;
        result: Record<string, unknown>;
    };
}

// ── SSE Agent Event ──
export interface AgentSSEEvent {
    id: number;
    module: string;
    action: string;
    severity: 'info' | 'warning' | 'critical';
    confidence: number | null;
    tx_hash: string | null;
    timestamp: string;
}

// ── Props for agent JSX components (bridge between React/TS and JSX) ──
export interface AgentDataBridge {
    registry: AgentRegistry | null;
    analytics: AgentAnalytics | null;
    tokenData: BEZTokenData | null;
    mcpTools: MCPTool[];
    liveEvents: AgentSSEEvent[];
    isLoading: boolean;
    invokeTool: (tool: string, params: Record<string, unknown>) => Promise<MCPInvokeResponse>;
}
