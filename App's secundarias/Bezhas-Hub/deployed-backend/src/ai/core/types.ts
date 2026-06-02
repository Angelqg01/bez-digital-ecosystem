export type AIProvider = 'openai' | 'anthropic' | 'google' | 'mistral' | 'openrouter' | 'replicate' | 'perplexity'

export type AIModel = {
    id: string
    provider: AIProvider
    name: string
    contextWindow: number
    maxTokens: number
    supportsVision: boolean
    supportsFunctions: boolean
    supportsStreaming: boolean
    costPer1kInput: number
    costPer1kOutput: number
    bzCostMultiplier?: number
}

export type Message = {
    role: 'system' | 'user' | 'assistant' | 'function' | 'tool'
    content: string
    name?: string
    function_call?: FunctionCall
    tool_calls?: ToolCall[]
}

export type FunctionCall = {
    name: string
    arguments: string
}

export type ToolCall = {
    id: string
    type: 'function'
    function: FunctionCall
}

export type AIRequest = {
    model: string
    messages: Message[]
    temperature?: number
    maxTokens?: number
    topP?: number
    functions?: FunctionDefinition[]
    tools?: ToolDefinition[]
    stream?: boolean
    user?: string
}

export type AIResponse = {
    id: string
    model: string
    choices: {
        index: number
        message: Message
        finish_reason: 'stop' | 'length' | 'function_call' | 'tool_calls' | 'content_filter'
    }[]
    usage: {
        prompt_tokens: number
        completion_tokens: number
        total_tokens: number
        cost_usd: number
        cost_bez?: number
    }
}

export type FunctionDefinition = {
    name: string
    description: string
    parameters: {
        type: 'object'
        properties: Record<string, any>
        required?: string[]
    }
}

export type ToolDefinition = {
    type: 'function'
    function: FunctionDefinition
}

export type Agent = {
    id: string
    name: string
    description: string
    systemPrompt: string
    model: string
    temperature: number
    maxTokens: number
    functions: string[]
    visibility: 'public' | 'vip' | 'admin'
    avatar?: string
    personality: string
    createdAt: Date
    updatedAt: Date
}

export type Conversation = {
    id: string
    userId: string
    agentId: string
    messages: Message[]
    createdAt: Date
    updatedAt: Date
}
