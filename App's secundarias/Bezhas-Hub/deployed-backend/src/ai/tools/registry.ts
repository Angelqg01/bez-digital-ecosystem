import { FunctionDefinition, ToolDefinition } from '../core/types'

export type ToolExecutor = (args: any, context: ToolContext) => Promise<any>

export type ToolContext = {
    userAddress?: string
    agentId?: string
    conversationId?: string
}

export class ToolRegistry {
    private static tools: Map<string, { definition: FunctionDefinition, executor: ToolExecutor }> = new Map()

    static register(name: string, definition: FunctionDefinition, executor: ToolExecutor) {
        this.tools.set(name, { definition, executor })
    }

    static getDefinition(name: string): FunctionDefinition | undefined {
        return this.tools.get(name)?.definition
    }

    static getDefinitions(names?: string[]): ToolDefinition[] {
        const tools = names
            ? names.map(n => this.tools.get(n)).filter(Boolean)
            : Array.from(this.tools.values())

        return tools.map(t => ({
            type: 'function',
            function: t!.definition
        }))
    }

    static async execute(name: string, args: any, context: ToolContext): Promise<any> {
        const tool = this.tools.get(name)
        if (!tool) throw new Error(`Tool ${name} not found`)

        try {
            return await tool.executor(args, context)
        } catch (error: any) {
            return { error: error.message }
        }
    }

    static listAll(): string[] {
        return Array.from(this.tools.keys())
    }
}
