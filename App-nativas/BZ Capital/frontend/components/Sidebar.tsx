'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Coins, TrendingUp, Vote, ArrowLeftRight,
    Wallet, PieChart, LayoutDashboard, ExternalLink,
    Repeat2, CreditCard,
} from 'lucide-react';

export const navItems = [
    { href: '/', label: 'DeFi Home', icon: LayoutDashboard },
    { href: '/staking', label: 'Staking', icon: Coins },
    { href: '/farming', label: 'Farming', icon: TrendingUp },
    { href: '/trading', label: 'Trading', icon: Repeat2 },
    { href: '/governance', label: 'Governance', icon: Vote },
    { href: '/bridge', label: 'Bridge', icon: ArrowLeftRight },
    { href: '/wallet', label: 'Wallet', icon: Wallet },
    { href: '/treasury', label: 'Treasury', icon: PieChart },
    { href: '/payments', label: 'Payments', icon: CreditCard },
];

const crossAppLinks = [
    { href: process.env.NEXT_PUBLIC_BEZHAS_HOME_URL || 'https://www.bezhas.com', label: 'Home principal', icon: ExternalLink },
    { href: process.env.NEXT_PUBLIC_BEZHAS_HUB_URL || 'https://hub.bezhas.com', label: 'BeZhas Hub', icon: ExternalLink },
];

export function isActive(pathname: string | null, href: string) {
    return pathname === href || (href !== '/' && !!pathname?.startsWith(href));
}

/**
 * Escritorio: ancho completo (w-64) o sólo iconos (w-[72px]).
 * Móvil: oculto; `mobileOpen` lo muestra como cajón sobre el contenido.
 */
export function Sidebar({ collapsed, mobileOpen, onNavigate }: {
    collapsed: boolean;
    mobileOpen: boolean;
    onNavigate: () => void;
}) {
    const pathname = usePathname();
    const compact = collapsed && !mobileOpen;

    return (
        <aside
            id="defi-sidebar"
            className={`fixed left-0 top-0 h-full bg-slate-900 border-r border-bez-border flex flex-col z-50 transition-[width,transform] duration-200
                ${compact ? 'md:w-[72px]' : 'md:w-64'} w-64
                ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'} md:translate-x-0`}
        >
            {/* Logo */}
            <div className={`border-b border-bez-border ${compact ? 'p-4 text-center' : 'p-6'}`}>
                {compact ? (
                    <span className="text-lg font-bold text-bez-primary" title="BeZhas DeFi">Bz</span>
                ) : (
                    <>
                        <h1 className="text-xl font-bold text-white">
                            <span className="text-bez-primary">BeZhas</span> DeFi
                        </h1>
                        <p className="text-xs text-slate-500 mt-1">Staking · Farming · DAO</p>
                    </>
                )}
            </div>

            {/* Nav */}
            <nav className={`flex-1 space-y-1 overflow-y-auto ${compact ? 'p-2' : 'p-4'}`} aria-label="DeFi">
                {navItems.map(({ href, label, icon: Icon }) => {
                    const active = isActive(pathname, href);
                    return (
                        <Link
                            key={href}
                            href={href}
                            onClick={onNavigate}
                            title={compact ? label : undefined}
                            aria-label={compact ? label : undefined}
                            aria-current={active ? 'page' : undefined}
                            className={`flex items-center rounded-lg text-sm transition-colors ${compact ? 'justify-center py-2.5' : 'gap-3 px-3 py-2.5'} ${active
                                ? 'bg-bez-primary/20 text-bez-primary font-semibold'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            <Icon size={18} aria-hidden="true" />
                            {!compact && label}
                        </Link>
                    );
                })}
            </nav>

            {/* Cross-app links */}
            <div className={`border-t border-bez-border ${compact ? 'p-2' : 'p-4'}`}>
                {!compact && <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Ecosystem</p>}
                {crossAppLinks.map(({ href, label, icon: Icon }) => (
                    <a
                        key={href}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={compact ? label : undefined}
                        aria-label={compact ? label : undefined}
                        className={`flex items-center rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ${compact ? 'justify-center py-2' : 'gap-3 px-3 py-2'}`}
                    >
                        <Icon size={16} aria-hidden="true" />
                        {!compact && label}
                    </a>
                ))}
            </div>
        </aside>
    );
}
