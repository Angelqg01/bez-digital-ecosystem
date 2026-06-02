'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRightLeft, MessageSquare, FileCode2, Fuel, Blocks } from 'lucide-react';

const INFRA_PAGES = [
    { href: '/dashboard/bridge', label: 'Bridge', icon: ArrowRightLeft, description: 'Cross-chain' },
    { href: '/dashboard/contracts', label: 'Contratos', icon: FileCode2, description: 'Smart Contracts' },
    { href: '/dashboard/channels', label: 'Canales', icon: MessageSquare, description: 'Comunicación' },
    { href: '/dashboard/blockchain', label: 'Blockchain', icon: Blocks, description: 'Red & Nodos' },
    { href: '/dashboard/analytics', label: 'Analytics', icon: Fuel, description: 'Métricas' },
] as const;

export default function InfraEcosystemNav() {
    const pathname = usePathname();

    return (
        <nav className="flex gap-2 p-1 bg-gray-50 rounded-xl border border-gray-100 mb-6 overflow-x-auto">
            {INFRA_PAGES.map(({ href, label, icon: Icon, description }) => {
                const active = pathname === href;
                return (
                    <Link
                        key={href}
                        href={href}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center whitespace-nowrap ${active
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
