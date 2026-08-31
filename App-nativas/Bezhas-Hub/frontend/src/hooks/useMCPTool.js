import { useCallback, useState } from 'react';

const MCP_URL = import.meta.env.VITE_MCP_URL || 'http://localhost:3001';

export function useMCPTool(toolName) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const execute = useCallback(async (input) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${MCP_URL}/api/mcp/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: toolName, input })
      });

      if (!response.ok) {
        throw new Error(`MCP ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      const message = err?.message || 'No se pudo ejecutar el agente MCP';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toolName]);

  return { execute, loading, error };
}
