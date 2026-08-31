import { AIRequest, Message } from '../core/types'
import { getModel } from '../core/models'
import { EngineFactory } from '../engines/EngineFactory'
import { ToolRegistry } from '../tools/registry'
import { AgentService } from './AgentService'

export class ChatService {
    static async chat(params: {
        agentId: string
        messages: Message[]
        userAddress?: string
        stream?: boolean
    }) {
        const agent = await AgentService.getAgent(params.agentId)
        if (!agent) {
            throw new Error(`Agent ${params.agentId} not found`)
        }

        const model = getModel(agent.model)
        if (!model) {
            throw new Error(`Model ${agent.model} not found`)
        }

        // Preparar mensajes con system prompt
        const systemMessage: Message = {
            role: 'system',
            content: agent.systemPrompt
        }

        const allMessages = [systemMessage, ...params.messages]

        // Preparar herramientas
        const tools = ToolRegistry.getDefinitions(agent.functions)

        const request: AIRequest = {
            model: agent.model,
            messages: allMessages,
            temperature: agent.temperature,
            maxTokens: agent.maxTokens,
            tools: tools.length > 0 ? tools : undefined,
            stream: params.stream || false,
            user: params.userAddress
        }

        // Llamar al engine apropiado
        const response = await EngineFactory.chat(model.provider, request)

        // Si hay tool_calls, ejecutarlos
        if (response.choices[0]?.message?.tool_calls) {
            const toolResults = await this.executeTools(
                response.choices[0].message.tool_calls,
                {
                    userAddress: params.userAddress,
                    agentId: params.agentId
                }
            )

            // Reenviar con resultados de herramientas
            const followUpMessages: Message[] = [
                ...allMessages,
                response.choices[0].message,
                ...toolResults
            ]

            const followUpRequest: AIRequest = {
                ...request,
                messages: followUpMessages
            }

            return await EngineFactory.chat(model.provider, followUpRequest)
        }

        return response
    }

    static async *streamChat(params: {
        agentId: string
        messages: Message[]
        userAddress?: string
    }): AsyncGenerator<string> {
        const agent = await AgentService.getAgent(params.agentId)
        if (!agent) {
            throw new Error(`Agent ${params.agentId} not found`)
        }

        const model = getModel(agent.model)
        if (!model) {
            throw new Error(`Model ${agent.model} not found`)
        }

        const systemMessage: Message = {
            role: 'system',
            content: agent.systemPrompt
        }

        const request: AIRequest = {
            model: agent.model,
            messages: [systemMessage, ...params.messages],
            temperature: agent.temperature,
            maxTokens: agent.maxTokens,
            stream: true,
            user: params.userAddress
        }

        yield* EngineFactory.streamChat(model.provider, request)
    }

    private static async executeTools(
        toolCalls: any[],
        context: { userAddress?: string; agentId?: string }
    ): Promise<Message[]> {
        const results: Message[] = []

        for (const call of toolCalls) {
            try {
                const args = JSON.parse(call.function.arguments)
                const result = await ToolRegistry.execute(
                    call.function.name,
                    args,
                    context
                )

                results.push({
                    role: 'tool',
                    content: JSON.stringify(result),
                    name: call.function.name
                })
            } catch (error: any) {
                results.push({
                    role: 'tool',
                    content: JSON.stringify({ error: error.message }),
                    name: call.function.name
                })
            }
        }

        return results
    }
}
