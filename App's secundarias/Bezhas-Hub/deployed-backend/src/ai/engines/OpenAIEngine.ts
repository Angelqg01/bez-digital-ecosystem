import OpenAI from 'openai'
import { BaseEngine } from './BaseEngine'
import { AIRequest, AIResponse, Message } from '../core/types'

export class OpenAIEngine extends BaseEngine {
    private client: OpenAI

    constructor(apiKey: string) {
        super(apiKey)
        this.client = new OpenAI({ apiKey })
    }

    getDefaultBaseURL(): string {
        return 'https://api.openai.com/v1'
    }

    async chat(request: AIRequest): Promise<AIResponse> {
        const response = await this.client.chat.completions.create({
            model: request.model,
            messages: request.messages as any,
            temperature: request.temperature,
            max_tokens: request.maxTokens,
            top_p: request.topP,
            functions: request.functions as any,
            tools: request.tools as any,
            stream: false,
            user: request.user
        })

        const usage = response.usage!
        const costUsd = this.calculateCost(usage.prompt_tokens, usage.completion_tokens, request.model)
        const costBez = this.calculateBezCost(costUsd, request.model)

        return {
            id: response.id,
            model: response.model,
            choices: response.choices.map(c => ({
                index: c.index,
                message: c.message as Message,
                finish_reason: c.finish_reason as any
            })),
            usage: {
                prompt_tokens: usage.prompt_tokens,
                completion_tokens: usage.completion_tokens,
                total_tokens: usage.total_tokens,
                cost_usd: costUsd,
                cost_bez: costBez
            }
        }
    }

    async *streamChat(request: AIRequest): AsyncGenerator<string> {
        const stream = await this.client.chat.completions.create({
            model: request.model,
            messages: request.messages as any,
            temperature: request.temperature,
            max_tokens: request.maxTokens,
            stream: true,
            user: request.user
        })

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content
            if (content) yield content
        }
    }
}
