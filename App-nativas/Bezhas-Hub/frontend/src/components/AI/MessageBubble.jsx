import ReactMarkdown from 'react-markdown'

export default function MessageBubble({ message }) {
    const isUser = message.role === 'user'

    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`max-w-[90%] sm:max-w-[85%] md:max-w-[80%] rounded-2xl px-3 sm:px-4 py-2 ${isUser
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                    : 'bg-gray-800 text-gray-100'
                    }`}
            >
                {/* Mensaje de función */}
                {message.role === 'tool' && (
                    <div className="text-xs text-yellow-400 mb-1">
                        🔧 Function: {message.name}
                    </div>
                )}

                {/* Contenido */}
                <div className="prose prose-invert prose-sm max-w-none text-sm sm:text-base">
                    <ReactMarkdown
                        components={{
                            code({ node, inline, className, children, ...props }) {
                                return !inline ? (
                                    <pre className="bg-gray-950 rounded-lg p-2 sm:p-3 overflow-x-auto text-xs sm:text-sm">
                                        <code className={`${className}`} {...props}>
                                            {children}
                                        </code>
                                    </pre>
                                ) : (
                                    <code className="bg-gray-700 px-1 sm:px-1.5 py-0.5 rounded text-xs sm:text-sm" {...props}>
                                        {children}
                                    </code>
                                )
                            }
                        }}
                    >
                        {message.content}
                    </ReactMarkdown>
                </div>

                {/* Tool calls */}
                {message.tool_calls && message.tool_calls.length > 0 && (
                    <div className="mt-2 space-y-1">
                        {message.tool_calls.map((call, idx) => (
                            <div
                                key={idx}
                                className="text-xs bg-gray-900/50 rounded px-2 py-1"
                            >
                                🔧 {call.function.name}(
                                {JSON.stringify(JSON.parse(call.function.arguments)).slice(0, 50)}
                                ...)
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
