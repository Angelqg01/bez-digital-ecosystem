import { useState, useCallback, useRef } from 'react';
import { useBezhasAuth } from '../auth/useBezhasAuth';
import { MCPClient } from './mcpClient';
import type { MCPToolName } from './tools';

export interface MCPToolResult<T = any> {
  data: T;
  toolName: string;
  executionTime: number;
  requestId: number;
}

/**
 * useMCPTool — React hook to invoke any of the 12 BeZhas MCP tools.
 * 
 * Usage:
 * ```tsx
 * const { invoke, isLoading } = useMCPTool();
 * const result = await invoke('score-supplier', {
 *   supplier_did: 'did:bezhas:0x...',
 *   sector: 'logistics'
 * });
 * ```
 */
export function useMCPTool() {
  const { jwt } = useBezhasAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<MCPClient | null>(null);

  // Lazy initialization of client
  const getClient = useCallback(() => {
    if (!clientRef.current) {
      clientRef.current = new MCPClient();
    }
    if (jwt) {
      clientRef.current.setJWT(jwt);
    }
    return clientRef.current;
  }, [jwt]);

  /**
   * Invoke an MCP tool by name with typed arguments.
   */
  const invoke = useCallback(async <T = any>(
    toolName: MCPToolName | string,
    args: Record<string, any>
  ): Promise<MCPToolResult<T>> => {
    setIsLoading(true);
    setError(null);
    const start = Date.now();

    try {
      const client = getClient();
      const data = await client.callTool<T>(toolName, args);

      return {
        data,
        toolName,
        executionTime: Date.now() - start,
        requestId: Date.now(),
      };
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [getClient]);

  /**
   * List all available tools from the MCP Server.
   */
  const listAvailableTools = useCallback(async () => {
    const client = getClient();
    return client.listTools();
  }, [getClient]);

  return { invoke, listAvailableTools, isLoading, error };
}

export default useMCPTool;
