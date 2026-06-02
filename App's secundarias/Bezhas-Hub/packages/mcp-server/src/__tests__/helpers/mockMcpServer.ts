/**
 * Mock MCP Server helper for unit tests.
 * Captures tool registration handlers so they can be invoked directly.
 */
import { vi } from 'vitest';

export interface MockMcpServer {
    tool: ReturnType<typeof vi.fn>;
}

export interface MockServerResult {
    server: MockMcpServer;
    getHandler: (name: string) => ((...args: unknown[]) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>) | undefined;
    getSchema: (name: string) => Record<string, unknown> | undefined;
    getToolNames: () => string[];
}

export function createMockMcpServer(): MockServerResult {
    const handlers = new Map<string, Function>();
    const schemas = new Map<string, Record<string, unknown>>();

    const server: MockMcpServer = {
        tool: vi.fn((name: string, _description: string, schema: Record<string, unknown>, handler: Function) => {
            handlers.set(name, handler);
            schemas.set(name, schema);
        }),
    };

    return {
        server,
        getHandler: (name: string) => handlers.get(name) as ReturnType<MockServerResult['getHandler']>,
        getSchema: (name: string) => schemas.get(name),
        getToolNames: () => Array.from(handlers.keys()),
    };
}

/**
 * Parse the JSON result from a tool handler response.
 */
export function parseToolResult<T = Record<string, unknown>>(
    response: { content: Array<{ type: string; text: string }>; isError?: boolean }
): T {
    const text = response.content[0]?.text;
    if (!text) throw new Error('No content in tool response');
    return JSON.parse(text) as T;
}

/**
 * Create a mock fetch response.
 */
export function mockFetchResponse(data: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? 'OK' : 'Error',
        json: async () => data,
        text: async () => JSON.stringify(data),
        headers: new Headers(),
    } as unknown as Response;
}
