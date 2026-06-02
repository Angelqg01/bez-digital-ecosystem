'use client';

import { useState } from 'react';
import { useRuntimeTools, useRuntimeInvoke, type RuntimeTool } from '@/lib/runtime-hooks';
import { Wrench, Play, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ToolInvokerProps {
    tools?: { name: string; description: string; permissions: string[]; sector: string | null }[];
}

export default function ToolInvoker({ tools: externalTools }: ToolInvokerProps) {
    const { data: toolsData } = useRuntimeTools();
    const { invoke, isInvoking, lastResult, error } = useRuntimeInvoke();

    const [selectedTool, setSelectedTool] = useState<string>('');
    const [paramsJson, setParamsJson] = useState('{}');
    const [jsonError, setJsonError] = useState<string | null>(null);

    const tools = (externalTools as RuntimeTool[]) || toolsData?.data?.tools || [];

    const handleInvoke = async () => {
        if (!selectedTool) return;
        setJsonError(null);
        let params = {};
        try {
            params = JSON.parse(paramsJson);
        } catch {
            setJsonError('Invalid JSON parameters');
            return;
        }
        await invoke(selectedTool, params);
    };

    return (
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
                <Wrench className="w-5 h-5 text-bezhas-accent" />
                <h3 className="font-semibold text-gray-900">Tool Invoker</h3>
            </div>

            {/* Tool selector */}
            <div className="space-y-3">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Tool</label>
                    <select
                        value={selectedTool}
                        onChange={(e) => setSelectedTool(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-bezhas-accent/20 focus:border-bezhas-accent"
                    >
                        <option value="">Select a tool...</option>
                        {tools.map(t => (
                            <option key={t.name} value={t.name}>
                                {t.name} {t.sector ? `(${t.sector})` : ''}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Params input */}
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Parameters (JSON)</label>
                    <textarea
                        value={paramsJson}
                        onChange={(e) => setParamsJson(e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono resize-none focus:ring-2 focus:ring-bezhas-accent/20 focus:border-bezhas-accent"
                        placeholder='{"key": "value"}'
                    />
                    {jsonError && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {jsonError}
                        </p>
                    )}
                </div>

                {/* Invoke button */}
                <button
                    onClick={handleInvoke}
                    disabled={!selectedTool || isInvoking}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-bezhas-accent text-white px-4 py-2.5 text-sm font-medium hover:bg-bezhas-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {isInvoking ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Invoking...</>
                    ) : (
                        <><Play className="w-4 h-4" /> Invoke</>
                    )}
                </button>
            </div>

            {/* Result display */}
            {(lastResult || error) && (
                <div className="mt-4 border-t pt-3">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Result</label>
                    {error ? (
                        <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    ) : (
                        <div className="bg-green-50 rounded-lg p-3">
                            <div className="flex items-center gap-1 text-green-700 text-xs mb-1">
                                <CheckCircle2 className="w-3 h-3" /> Success
                            </div>
                            <pre className="text-xs text-gray-700 overflow-x-auto max-h-40">
                                {JSON.stringify(lastResult?.data, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
