import { AIProvider, AIRequest } from '../core/types'
import { BaseEngine } from './BaseEngine'
import { OpenAIEngine } from './OpenAIEngine'

export class EngineFactory {
    private static engines: Map<AIProvider, BaseEngine> = new Map()

    static getEngine(provider: AIProvider): BaseEngine {
        if (this.engines.has(provider)) {
            return this.engines.get(provider)!
        }

        let engine: BaseEngine
        switch (provider) {
            case 'openai':
                const openaiKey = process.env.OPENAI_API_KEY
                if (!openaiKey) throw new Error('OPENAI_API_KEY not configured')
                engine = new OpenAIEngine(openaiKey)
                break

            // case 'anthropic':
            //   engine = new AnthropicEngine(process.env.ANTHROPIC_API_KEY!)
            //   break

            // case 'google':
            //   engine = new GoogleEngine(process.env.GOOGLE_API_KEY!)
            //   break

            default:
                throw new Error(`Provider ${provider} not supported yet`)
        }

        this.engines.set(provider, engine)
        return engine
    }

    static async chat(provider: AIProvider, request: AIRequest) {
        const engine = this.getEngine(provider)
        return engine.chat(request)
    }

    static streamChat(provider: AIProvider, request: AIRequest) {
        const engine = this.getEngine(provider)
        return engine.streamChat(request)
    }
}
