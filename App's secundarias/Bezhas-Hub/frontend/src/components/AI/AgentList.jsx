import { useAI } from '../../context/AIContext'

export default function AgentList({ onClose }) {
    const { agents, currentAgent, selectAgent } = useAI()

    const handleAgentSelect = (agentId) => {
        selectAgent(agentId)
        if (onClose) onClose() // Cerrar menú móvil después de seleccionar
    }

    return (
        <div className="bg-gray-900 border-r border-gray-800 w-64 sm:w-72 md:w-64 lg:w-80 h-full flex flex-col">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-white">AI Agents</h2>
                    <p className="text-xs text-gray-400 mt-1">Selecciona un asistente</p>
                </div>
                {/* Close button for mobile */}
                <button
                    onClick={onClose}
                    className="md:hidden p-1 text-gray-400 hover:text-white transition-colors"
                    aria-label="Cerrar menú"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto">
                {agents.map((agent) => (
                    <button
                        key={agent.id}
                        onClick={() => handleAgentSelect(agent.id)}
                        className={`w-full p-3 sm:p-4 text-left transition-colors border-b border-gray-800 hover:bg-gray-800 ${currentAgent?.id === agent.id
                            ? 'bg-purple-600/20 border-l-4 border-purple-500'
                            : ''
                            }`}
                    >
                        <div className="flex items-start gap-2 sm:gap-3">
                            {/* Avatar */}
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                                <span className="text-base sm:text-lg">{agent.avatar || '🤖'}</span>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm sm:text-base font-medium text-white truncate">
                                        {agent.name}
                                    </h3>
                                    {agent.visibility === 'vip' && (
                                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded flex-shrink-0">
                                            VIP
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                                    {agent.description}
                                </p>
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {/* Footer con info */}
            <div className="p-3 border-t border-gray-800 text-xs text-gray-500">
                <p>{agents.length} agentes disponibles</p>
            </div>
        </div>
    )
}
