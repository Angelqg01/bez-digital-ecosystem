import type { MCPToolName } from './tools';

const MCP_URL = typeof window !== 'undefined'
  ? (window as any).__BEZHAS_MCP_URL__ || 'http://localhost:3002'
  : process.env.NEXT_PUBLIC_MCP_URL || 'http://localhost:3002';

export interface MCPMessage {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, any>;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

/**
 * MCPClient — Low-level Model Context Protocol client.
 * 
 * Connects to the BeZhas MCP Server and invokes tools
 * following the MCP specification (JSON-RPC 2.0 over HTTP + SSE).
 */
export class MCPClient {
  private baseUrl: string;
  private jwt: string | null;
  private requestId: number = 0;

  constructor(options?: { url?: string; jwt?: string }) {
    this.baseUrl = options?.url || MCP_URL;
    this.jwt = options?.jwt || null;
  }

  setJWT(jwt: string) {
    this.jwt = jwt;
  }

  /**
   * List all available tools from the MCP Server.
   */
  async listTools(): Promise<any[]> {
    const res = await this.send('tools/list', {});
    return res.result?.tools || [];
  }

  /**
   * Invoke a specific tool with arguments.
   */
  async callTool<T = any>(
    toolName: MCPToolName | string,
    args: Record<string, any>
  ): Promise<T> {
    const res = await this.send('tools/call', {
      name: toolName,
      arguments: args,
    });

    if (res.error) {
      throw new Error(`MCP Tool Error [${res.error.code}]: ${res.error.message}`);
    }

    return res.result as T;
  }

  /**
   * Send a raw MCP JSON-RPC message.
   */
  private async send(method: string, params: Record<string, any>): Promise<MCPResponse> {
    const message: MCPMessage = {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method,
      params,
    };

    const res = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.jwt ? { Authorization: `Bearer ${this.jwt}` } : {}),
      },
      body: JSON.stringify(message),
    });

    if (!res.ok) {
      throw new Error(`MCP request failed: ${res.status} ${res.statusText}`);
    }

    return await res.json();
  }

  /**
   * Subscribe to Server-Sent Events for async tool results.
   */
  subscribeToEvents(onEvent: (event: any) => void): EventSource | null {
    if (typeof EventSource === 'undefined') return null;

    const url = new URL(`${this.baseUrl}/mcp/events`);
    if (this.jwt) url.searchParams.set('token', this.jwt);

    const source = new EventSource(url.toString());
    source.onmessage = (e) => {
      try {
        onEvent(JSON.parse(e.data));
      } catch { /* Invalid JSON, skip */ }
    };

    return source;
  }
}

export default MCPClient;
