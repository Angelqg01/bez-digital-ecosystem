import { AIRequest, AIResponse } from '../core/types'
import { AI_MODELS } from '../core/models'

export abstract class BaseEngine {
    protected apiKey: string
    protected baseURL: string

    constructor(apiKey: string, baseURL?: string) {
        this.apiKey = apiKey
        this.baseURL = baseURL || this.getDefaultBaseURL()
    }

    abstract getDefaultBaseURL(): string
    abstract chat(request: AIRequest): Promise<AIResponse>
    abstract streamChat(request: AIRequest): AsyncGenerator<string>

    protected calculateCost(inputTokens: number, outputTokens: number, modelId: string): number {
        const model = AI_MODELS[modelId]
        if (!model) return 0
        return (inputTokens / 1000 * model.costPer1kInput) +
            (outputTokens / 1000 * model.costPer1kOutput)
    }

    protected calculateBezCost(usdCost: number, modelId: string): number {
        const model = AI_MODELS[modelId]
        const multiplier = model?.bzCostMultiplier || 1.0
        // TODO: Consultar precio BEZ/USD en tiempo real desde oracle
        const bezUsdRate = parseFloat(process.env.BEZ_USD_RATE || '0.1')
        return (usdCost / bezUsdRate) * multiplier
    }
}
