import { AIModel } from './types'

export const AI_MODELS: Record<string, AIModel> = {
    // OpenAI Models
    'gpt-4o': {
        id: 'gpt-4o',
        provider: 'openai',
        name: 'GPT-4o',
        contextWindow: 128000,
        maxTokens: 16384,
        supportsVision: true,
        supportsFunctions: true,
        supportsStreaming: true,
        costPer1kInput: 0.005,
        costPer1kOutput: 0.015,
        bzCostMultiplier: 1.2
    },
    'gpt-4o-mini': {
        id: 'gpt-4o-mini',
        provider: 'openai',
        name: 'GPT-4o Mini',
        contextWindow: 128000,
        maxTokens: 16384,
        supportsVision: true,
        supportsFunctions: true,
        supportsStreaming: true,
        costPer1kInput: 0.00015,
        costPer1kOutput: 0.0006,
        bzCostMultiplier: 1.0
    },
    'gpt-4-turbo': {
        id: 'gpt-4-turbo',
        provider: 'openai',
        name: 'GPT-4 Turbo',
        contextWindow: 128000,
        maxTokens: 4096,
        supportsVision: true,
        supportsFunctions: true,
        supportsStreaming: true,
        costPer1kInput: 0.01,
        costPer1kOutput: 0.03,
        bzCostMultiplier: 1.5
    },
    'gpt-3.5-turbo': {
        id: 'gpt-3.5-turbo',
        provider: 'openai',
        name: 'GPT-3.5 Turbo',
        contextWindow: 16385,
        maxTokens: 4096,
        supportsVision: false,
        supportsFunctions: true,
        supportsStreaming: true,
        costPer1kInput: 0.0005,
        costPer1kOutput: 0.0015,
        bzCostMultiplier: 0.8
    },

    // Anthropic Models
    'claude-3-5-sonnet': {
        id: 'claude-3-5-sonnet-20241022',
        provider: 'anthropic',
        name: 'Claude 3.5 Sonnet',
        contextWindow: 200000,
        maxTokens: 8192,
        supportsVision: true,
        supportsFunctions: true,
        supportsStreaming: true,
        costPer1kInput: 0.003,
        costPer1kOutput: 0.015,
        bzCostMultiplier: 1.3
    },
    'claude-3-opus': {
        id: 'claude-3-opus-20240229',
        provider: 'anthropic',
        name: 'Claude 3 Opus',
        contextWindow: 200000,
        maxTokens: 4096,
        supportsVision: true,
        supportsFunctions: true,
        supportsStreaming: true,
        costPer1kInput: 0.015,
        costPer1kOutput: 0.075,
        bzCostMultiplier: 2.0
    },
    'claude-3-sonnet': {
        id: 'claude-3-sonnet-20240229',
        provider: 'anthropic',
        name: 'Claude 3 Sonnet',
        contextWindow: 200000,
        maxTokens: 4096,
        supportsVision: true,
        supportsFunctions: true,
        supportsStreaming: true,
        costPer1kInput: 0.003,
        costPer1kOutput: 0.015,
        bzCostMultiplier: 1.1
    },

    // Google Models
    'gemini-1.5-pro': {
        id: 'gemini-1.5-pro',
        provider: 'google',
        name: 'Gemini 1.5 Pro',
        contextWindow: 1000000,
        maxTokens: 8192,
        supportsVision: true,
        supportsFunctions: true,
        supportsStreaming: true,
        costPer1kInput: 0.00125,
        costPer1kOutput: 0.005,
        bzCostMultiplier: 1.1
    },
    'gemini-1.5-flash': {
        id: 'gemini-1.5-flash',
        provider: 'google',
        name: 'Gemini 1.5 Flash',
        contextWindow: 1000000,
        maxTokens: 8192,
        supportsVision: true,
        supportsFunctions: true,
        supportsStreaming: true,
        costPer1kInput: 0.000075,
        costPer1kOutput: 0.0003,
        bzCostMultiplier: 0.7
    },

    // Mistral Models
    'mistral-large': {
        id: 'mistral-large-latest',
        provider: 'mistral',
        name: 'Mistral Large',
        contextWindow: 128000,
        maxTokens: 8192,
        supportsVision: false,
        supportsFunctions: true,
        supportsStreaming: true,
        costPer1kInput: 0.002,
        costPer1kOutput: 0.006,
        bzCostMultiplier: 0.9
    },
    'mistral-medium': {
        id: 'mistral-medium-latest',
        provider: 'mistral',
        name: 'Mistral Medium',
        contextWindow: 32000,
        maxTokens: 8192,
        supportsVision: false,
        supportsFunctions: true,
        supportsStreaming: true,
        costPer1kInput: 0.0027,
        costPer1kOutput: 0.0081,
        bzCostMultiplier: 0.8
    }
}

export function getModel(modelId: string): AIModel | undefined {
    return AI_MODELS[modelId]
}

export function getModelsByProvider(provider: string): AIModel[] {
    return Object.values(AI_MODELS).filter(m => m.provider === provider)
}

export function getAllModels(): AIModel[] {
    return Object.values(AI_MODELS)
}
