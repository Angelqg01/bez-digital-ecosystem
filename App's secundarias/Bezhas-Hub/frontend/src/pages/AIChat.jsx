import { useState } from 'react'
import { AIProvider } from '../context/AIContext'
import AgentList from '../components/AI/AgentList'
import ChatWindow from '../components/AI/ChatWindow'

export default function AIChat() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    return (
        <AIProvider>
            <div className="h-screen flex overflow-hidden bg-gray-950">
                {/* Mobile Menu Button */}
                <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="md:hidden fixed top-4 left-4 z-40 p-2 bg-gray-900 rounded-lg text-white hover:bg-gray-800 transition-colors"
                    aria-label="Abrir menú"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>

                {/* Mobile Backdrop */}
                {isMobileMenuOpen && (
                    <div
                        className="md:hidden fixed inset-0 bg-black/50 z-40"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                )}

                {/* Agent List - Responsive Sidebar */}
                <div className={`
                    fixed md:static inset-y-0 left-0 z-50
                    transform transition-transform duration-300 ease-in-out
                    ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
                    md:translate-x-0
                `}>
                    <AgentList onClose={() => setIsMobileMenuOpen(false)} />
                </div>

                {/* Chat Window */}
                <ChatWindow />
            </div>
        </AIProvider>
    )
}
