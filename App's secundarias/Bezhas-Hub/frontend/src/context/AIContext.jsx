import { createContext, useContext, useState, useEffect } from 'react'
import { useAccount } from 'wagmi'

const AIContext = createContext()

export const useAI = () => {
    const context = useContext(AIContext)
    if (!context) {
        throw new Error('useAI must be used within AIProvider')
    }
    return context
}

export const AIProvider = ({ children }) => {
    const { address } = useAccount()
    const [agents, setAgents] = useState([])
    const [currentAgent, setCurrentAgent] = useState(null)
    const [messages, setMessages] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState(null)

    // Cargar agentes disponibles
    useEffect(() => {
        loadAgents()
    }, [address])

    const loadAgents = async () => {
        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const response = await fetch(`${API_URL}/api/ai/agents`)
            const data = await response.json()

            // Filtrar agentes según si el usuario es VIP
            const isVip = false // TODO: Verificar si el usuario es VIP
            const availableAgents = data.filter(
                agent => agent.visibility === 'public' || (isVip && agent.visibility === 'vip')
            )

            setAgents(availableAgents)

            // Seleccionar primer agente por defecto
            if (availableAgents.length > 0 && !currentAgent) {
                setCurrentAgent(availableAgents[0])
            }
        } catch (err) {
            setError('Failed to load agents')
            console.error(err)
        }
    }

    const selectAgent = (agentId) => {
        const agent = agents.find(a => a.id === agentId)
        if (agent) {
            setCurrentAgent(agent)
            setMessages([]) // Limpiar mensajes al cambiar de agente
        }
    }

    const sendMessage = async (content) => {
        if (!currentAgent || !content.trim()) return

        const userMessage = {
            role: 'user',
            content: content.trim()
        }

        // Agregar mensaje del usuario
        setMessages(prev => [...prev, userMessage])
        setIsLoading(true)
        setError(null)

        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            const token = localStorage.getItem('token');

            const response = await fetch(`${API_URL}/api/chat/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({
                    message: content.trim(),
                    conversationId: currentAgent?.id || 'default',
                    model: currentAgent?.model || 'gemini'
                })
            })

            if (!response.ok) {
                throw new Error('Failed to send message')
            }

            const data = await response.json()

            if (data.success && data.data?.message) {
                const assistantMessage = {
                    role: 'assistant',
                    content: data.data.message
                }
                setMessages(prev => [...prev, assistantMessage])
            }
        } catch (err) {
            setError('Failed to send message')
            console.error(err)

            // Agregar mensaje de error
            const errorMessage = {
                role: 'assistant',
                content: 'Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo.'
            }
            setMessages(prev => [...prev, errorMessage])
        } finally {
            setIsLoading(false)
        }
    }

    const streamMessage = async (content) => {
        if (!currentAgent || !content.trim()) return

        const userMessage = {
            role: 'user',
            content: content.trim()
        }

        setMessages(prev => [...prev, userMessage])
        setIsLoading(true)
        setError(null)

        // Crear mensaje temporal para el streaming
        const tempMessage = {
            role: 'assistant',
            content: ''
        }
        setMessages(prev => [...prev, tempMessage])

        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            const response = await fetch(`${API_URL}/api/ai/chat/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    agentId: currentAgent.id,
                    messages: [...messages, userMessage],
                    userAddress: address
                })
            })

            if (!response.ok) {
                throw new Error('Failed to stream message')
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let accumulatedContent = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value)
                const lines = chunk.split('\n')

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6)
                        if (data === '[DONE]') break

                        try {
                            const parsed = JSON.parse(data)
                            if (parsed.content) {
                                accumulatedContent += parsed.content

                                // Actualizar el mensaje temporal
                                setMessages(prev => {
                                    const newMessages = [...prev]
                                    newMessages[newMessages.length - 1] = {
                                        role: 'assistant',
                                        content: accumulatedContent
                                    }
                                    return newMessages
                                })
                            }
                        } catch (e) {
                            // Ignorar errores de parsing
                        }
                    }
                }
            }
        } catch (err) {
            setError('Failed to stream message')
            console.error(err)
            // Remover mensaje temporal en caso de error
            setMessages(prev => prev.slice(0, -1))
        } finally {
            setIsLoading(false)
        }
    }

    const clearMessages = () => {
        setMessages([])
    }

    const value = {
        agents,
        currentAgent,
        messages,
        isLoading,
        error,
        selectAgent,
        sendMessage,
        streamMessage,
        clearMessages,
        loadAgents
    }

    return <AIContext.Provider value={value}>{children}</AIContext.Provider>
}
