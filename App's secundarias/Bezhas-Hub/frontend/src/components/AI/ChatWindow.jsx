import { useState, useRef, useEffect } from 'react'
import { useAI } from '../../context/AIContext'
import MessageBubble from './MessageBubble'

export default function ChatWindow() {
    const { currentAgent, messages, isLoading, sendMessage, streamMessage, clearMessages } = useAI()
    const [input, setInput] = useState('')
    const [useStreaming, setUseStreaming] = useState(true)
    const messagesEndRef = useRef(null)

    // Auto-scroll al último mensaje
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!input.trim() || isLoading) return

        const messageText = input
        setInput('')

        if (useStreaming) {
            await streamMessage(messageText)
        } else {
            await sendMessage(messageText)
        }
    }

    if (!currentAgent) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-500 px-4">
                <div className="text-center">
                    <div className="text-4xl sm:text-6xl mb-4">🤖</div>
                    <p className="text-base sm:text-lg">Selecciona un agente para comenzar</p>
                    <p className="text-xs sm:text-sm mt-2 text-gray-600 md:hidden">
                        Toca el menú en la esquina superior izquierda
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col bg-gray-950">
            {/* Header */}
            <div className="bg-gray-900 border-b border-gray-800 p-3 sm:p-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 ml-14 md:ml-0">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-lg sm:text-xl">{currentAgent.avatar || '🤖'}</span>
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-sm sm:text-lg font-semibold text-white truncate">
                            {currentAgent.name}
                        </h2>
                        <p className="text-xs text-gray-400 truncate hidden sm:block">{currentAgent.personality}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                    {/* Toggle streaming - Hidden on mobile */}
                    <label className="hidden sm:flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={useStreaming}
                            onChange={(e) => setUseStreaming(e.target.checked)}
                            className="rounded"
                        />
                        <span className="hidden lg:inline">Streaming</span>
                    </label>

                    <button
                        onClick={clearMessages}
                        className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                    >
                        <span className="hidden sm:inline">Limpiar</span>
                        <span className="sm:hidden">🗑️</span>
                    </button>
                </div>
            </div>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
                {messages.length === 0 ? (
                    <div className="text-center text-gray-500 mt-4 sm:mt-8 px-4">
                        <p className="text-base sm:text-lg mb-2">¡Hola! Soy {currentAgent.name}</p>
                        <p className="text-xs sm:text-sm">{currentAgent.description}</p>
                        <p className="text-xs mt-4">Escribe un mensaje para comenzar...</p>
                    </div>
                ) : (
                    messages.map((message, index) => (
                        <MessageBubble key={index} message={message} />
                    ))
                )}

                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-gray-800 rounded-2xl px-4 py-2">
                            <div className="flex gap-1">
                                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-800 p-3 sm:p-4">
                <form onSubmit={handleSubmit} className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={`Pregunta a ${currentAgent.name}...`}
                        disabled={isLoading}
                        className="flex-1 bg-gray-900 text-white text-sm sm:text-base rounded-full px-4 sm:px-6 py-2 sm:py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm sm:text-base rounded-full font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                        <span className="hidden sm:inline">Enviar</span>
                        <span className="sm:hidden">📤</span>
                    </button>
                </form>

                {/* Info del modelo - Hidden on mobile */}
                <div className="mt-2 text-xs text-gray-500 text-center hidden sm:block">
                    Usando {currentAgent.model} • Max {currentAgent.maxTokens} tokens
                </div>
            </div>
        </div>
    )
}
