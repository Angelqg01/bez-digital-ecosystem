'use client';

import { useCallback, useState } from 'react';
import api from '@/lib/api';

type ToolState<T> = {
  data: T | null;
  error: string | null;
  isLoading: boolean;
};

export function useMCPTool<TResponse = unknown>(tool: string) {
  const [state, setState] = useState<ToolState<TResponse>>({
    data: null,
    error: null,
    isLoading: false,
  });

  const execute = useCallback(
    async (params: Record<string, unknown>) => {
      setState({ data: null, error: null, isLoading: true });
      try {
        const response = await api.post('/api/mcp/execute', { tool, params });
        const result = response.data?.result as TResponse;
        setState({ data: result, error: null, isLoading: false });
        return result;
      } catch (error: any) {
        const message = error?.response?.data?.error || error?.message || 'No se pudo ejecutar la herramienta MCP.';
        setState({ data: null, error: message, isLoading: false });
        throw new Error(message);
      }
    },
    [tool]
  );

  return { ...state, execute };
}

