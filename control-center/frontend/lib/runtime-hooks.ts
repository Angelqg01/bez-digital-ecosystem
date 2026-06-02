'use client';

import useSWR from 'swr';
import { useState, useEffect, useCallback, useRef } from 'react';
import { fetcher } from '@/lib/api';
import api from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────

interface RuntimeHealth {
    status: string;
    version: string;
    tools_registered: number;
    commands_registered: number;
    plugins_loaded: number;
    sessions_active: number;
    circuits?: Record<string, { state: string; failures: number }>;
}

interface RuntimeTool {
    name: string;
    description: string;
    permissions: string[];
    sector: string | null;
    timeoutMs: number;
}

interface RuntimeCommand {
    name: string;
    description: string;
    aliases: string[];
    usage?: string;
}

interface RuntimePlugin {
    name: string;
    version: string;
    sector: string;
    tools: number;
    commands: number;
}

interface ParityReport {
    passed: boolean;
    timestamp: number;
    summary: { total: number; pass: number; warn: number; fail: number };
    checks: Array<{
        category: string;
        name: string;
        status: 'pass' | 'warn' | 'fail';
        message: string;
    }>;
}

interface InvokeResult {
    status: string;
    data: unknown;
    meta?: { tool: string; timestamp: number };
}

interface RuntimeEvent {
    id: number;
    type: string;
    ts: number;
    [key: string]: unknown;
}

// ── Hooks ──────────────────────────────────────────────────────

export function useRuntimeHealth() {
    return useSWR<RuntimeHealth>('/runtime/health', fetcher, {
        refreshInterval: 10_000,
        errorRetryInterval: 5000,
    });
}

export function useRuntimeTools() {
    return useSWR<{ status: string; data: { tools: RuntimeTool[]; total: number } }>(
        '/runtime/tools', fetcher, { refreshInterval: 30_000 }
    );
}

export function useRuntimeCommands() {
    return useSWR<{ status: string; data: { commands: RuntimeCommand[]; total: number } }>(
        '/runtime/commands', fetcher, { refreshInterval: 60_000 }
    );
}

export function useRuntimePlugins() {
    return useSWR<{ status: string; data: { plugins: RuntimePlugin[]; total: number } }>(
        '/runtime/plugins', fetcher, { refreshInterval: 60_000 }
    );
}

export function useParityReport() {
    const [report, setReport] = useState<ParityReport | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const runAudit = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get<{ status: string; data: ParityReport }>('/runtime/parity');
            setReport(res.data);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Audit failed');
        } finally {
            setLoading(false);
        }
    }, []);

    return { report, loading, error, runAudit };
}

export function useRuntimeInvoke() {
    const [isInvoking, setIsInvoking] = useState(false);
    const [lastResult, setLastResult] = useState<InvokeResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const invoke = useCallback(async (tool: string, params: Record<string, unknown> = {}) => {
        setIsInvoking(true);
        setError(null);
        try {
            const res = await api.post<InvokeResult>('/runtime/invoke', { tool, params });
            setLastResult(res);
            return res;
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Invocation failed';
            setError(msg);
            return null;
        } finally {
            setIsInvoking(false);
        }
    }, []);

    return { invoke, isInvoking, lastResult, error };
}

export function useRuntimeSSE() {
    const [events, setEvents] = useState<RuntimeEvent[]>([]);
    const [connected, setConnected] = useState(false);
    const esRef = useRef<EventSource | null>(null);

    useEffect(() => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('bezhas_token') : null;
        const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/runtime/stream${token ? `?token=${token}` : ''}`;

        const es = new EventSource(url);
        esRef.current = es;

        es.onopen = () => setConnected(true);
        es.onmessage = (e) => {
            try {
                const event = JSON.parse(e.data) as RuntimeEvent;
                setEvents(prev => [...prev.slice(-99), event]); // keep last 100
            } catch { /* ignore parse errors */ }
        };
        es.onerror = () => {
            setConnected(false);
        };

        return () => {
            es.close();
            esRef.current = null;
        };
    }, []);

    const clear = useCallback(() => setEvents([]), []);

    return { events, connected, clear };
}

export type {
    RuntimeHealth, RuntimeTool, RuntimeCommand,
    RuntimePlugin, ParityReport, InvokeResult, RuntimeEvent,
};
