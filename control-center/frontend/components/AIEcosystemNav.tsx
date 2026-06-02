'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, Users, BrainCircuit, FileText } from 'lucide-react';

const AI_PAGES = [
    { href: '/dashboard/aegis', label: 'Aegis Control', icon: Shield, description: 'Motor IA & ML' },
    { href: '/dashboard/agents', label: 'Agentes', icon: Users, description: 'Registro & MCP' },
    { href: '/dashboard/ai-agent', label: 'AI Agent Config', icon: BrainCircuit, description: 'Canales & Chat' },
    { href: '/dashboard/ai-logs', label: 'AI Logs', icon: FileText, description: 'Auditoría MCP' },
] as const;

export default function AIEcosystemNav() {
    const pathname = usePathname();

    return (
        <nav className="flex gap-2 p-1 bg-gray-50 rounded-xl border border-gray-100 mb-6">
            {AI_PAGES.map(({ href, label, icon: Icon, description }) => {
                const active = pathname === href;
                return (
                    <Link
                        key={href}
                        href={href}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${active
                                ? 'bg-white shadow-sm text-gray-900 border border-gray-200'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                            }`}
                    >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="hidden md:inline">{label}</span>
                        <span className="hidden lg:inline text-[10px] text-gray-400 font-normal">
                            {description}
                        </span>
                    </Link>
                );
            })}
        </nav>
    );
}
