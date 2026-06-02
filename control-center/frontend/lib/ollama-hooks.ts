'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { fetcher, api } from './api';

/**
 * BeZhas Ollama Hooks — Frontend integration with OllamaGateway.
 * ──────────────────────────────────────────────────────────────
 * Provides hooks for health, models, chat, stats, and quota
 * monitoring of the local Ollama LLM gateway.
 */

// ─── Types ─────────────────────────────────────────────────

export interface OllamaModel {
    name: string;
    size: number;
    modified: string;
    digest: string;
}

export interface OllamaHealth {
    healthy: boolean;
    models: OllamaModel[];
    defaultModel: string | null;
    error?: string;
}

export interface OllamaStats {
    totalRequests: number;
    localRequests: number;
    cloudRequests: number;
    fallbacksTriggered: number;
    tokensProcessed: number;
    avgLatencyMs: number;
    errors: number;
    healthy: boolean;
    modelsAvailable: number;
    defaultModel: string | null;
    quotas: {
        anthropic: { used: number; limit: number; exhausted: boolean };
        gemini: { used: number; limit: number; exhausted: boolean };
    };
}

export interface OllamaChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface OllamaChatResult {
    content: string;
    model: string;
    provider: string;
    latencyMs: number;
    evalCount: number;
}

// ═══════════════════════════════════════════════════════════════
//  HOOK: Ollama Health (polls every 15s)
// ═══════════════════════════════════════════════════════════════

export function useOllamaHealth() {
    return useSWR<OllamaHealth>('/ollama/health', fetcher, {
        refreshInterval: 15_000,
        errorRetryInterval: 10_000,
        revalidateOnFocus: false,
    });
}

// ═══════════════════════════════════════════════════════════════
//  HOOK: Ollama Models
// ═══════════════════════════════════════════════════════════════

export function useOllamaModels() {
    return useSWR<{ models: OllamaModel[] }>('/ollama/models', fetcher, {
        refreshInterval: 30_000,
    });
}

// ═══════════════════════════════════════════════════════════════
//  HOOK: Ollama Stats
// ═══════════════════════════════════════════════════════════════

export function useOllamaStats() {
    return useSWR<OllamaStats>('/ollama/stats', fetcher, {
        refreshInterval: 10_000,
    });
}

// ═══════════════════════════════════════════════════════════════
//  HOOK: Ollama Chat (non-streaming)
// ═══════════════════════════════════════════════════════════════

export function useOllamaChat() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<OllamaChatResult | null>(null);

    const chat = useCallback(async (
        messages: OllamaChatMessage[],
        model?: string,
    ): Promise<OllamaChatResult | null> => {
        setLoading(true);
        setError(null);

        try {
            const res = await api.post<OllamaChatResult>('/ollama/chat', {
                messages,
                model,
            });
            setResult(res);
            return res;
        } catch (err: any) {
            const msg = err?.message || 'Error in Ollama chat';
            setError(msg);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    return { chat, loading, error, result };
}

// ═══════════════════════════════════════════════════════════════
//  HOOK: Ollama Streaming Chat (SSE)
// ═══════════════════════════════════════════════════════════════

export function useOllamaStream() {
    const [streaming, setStreaming] = useState(false);
    const [chunks, setChunks] = useState<string[]>([]);
    const [fullText, setFullText] = useState('');
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const stream = useCallback(async (
        messages: OllamaChatMessage[],
        model?: string,
        onChunk?: (text: string) => void,
    ) => {
        setStreaming(true);
        setError(null);
        setChunks([]);
        setFullText('');

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
            const token = localStorage.getItem('bezhas_token');
            const res = await fetch(`${baseUrl}/ollama/chat/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ messages, model }),
                signal: controller.signal,
            });

            if (!res.ok) throw new Error(`Stream error: ${res.status}`);
            if (!res.body) throw new Error('No response body');

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let accumulated = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value, { stream: true });
                const lines = text.split('\n').filter(l => l.startsWith('data: '));

                for (const line of lines) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.content) {
                            accumulated += parsed.content;
                            setChunks(prev => [...prev, parsed.content]);
                            setFullText(accumulated);
                            onChunk?.(parsed.content);
                        }
                    } catch { /* skip */ }
                }
            }

            return accumulated;
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                setError(err?.message || 'Stream error');
            }
            return null;
        } finally {
            setStreaming(false);
            abortRef.current = null;
        }
    }, []);

    const abort = useCallback(() => {
        abortRef.current?.abort();
    }, []);

    return { stream, abort, streaming, chunks, fullText, error };
}

// ═══════════════════════════════════════════════════════════════
//  HOOK: Model Pull
// ═══════════════════════════════════════════════════════════════

export function useOllamaPull() {
    const [pulling, setPulling] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const pull = useCallback(async (modelName: string): Promise<boolean> => {
        setPulling(true);
        setError(null);
        try {
            await api.post('/ollama/pull', { model: modelName });
            return true;
        } catch (err: any) {
            setError(err?.message || 'Pull failed');
            return false;
        } finally {
            setPulling(false);
        }
    }, []);

    return { pull, pulling, error };
}
