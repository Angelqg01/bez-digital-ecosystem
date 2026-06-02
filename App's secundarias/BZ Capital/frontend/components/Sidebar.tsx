'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Coins, TrendingUp, Vote, ArrowLeftRight,
    Wallet, PieChart, LayoutDashboard, ExternalLink,
    Repeat2,
} from 'lucide-react';

const navItems = [
    { href: '/', label: 'DeFi Home', icon: LayoutDashboard },
    { href: '/staking', label: 'Staking', icon: Coins },
    { href: '/farming', label: 'Farming', icon: TrendingUp },
    { href: '/trading', label: 'Trading', icon: Repeat2 },
    { href: '/governance', label: 'Governance', icon: Vote },
    { href: '/bridge', label: 'Bridge', icon: ArrowLeftRight },
    { href: '/wallet', label: 'Wallet', icon: Wallet },
    { href: '/treasury', label: 'Treasury', icon: PieChart },
    { href: '/payments', label: 'Payments', icon: Coins },
];

const crossAppLinks = [
    { href: process.env.NEXT_PUBLIC_BEZHAS_HOME_URL || 'http://localhost:5173', label: 'Home principal', icon: ExternalLink },
    { href: 'http://localhost:3000', label: 'Core Console', icon: ExternalLink },
    { href: 'http://localhost:5173', label: 'BeZhas App', icon: ExternalLink },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="fixed left-0 top-0 h-full w-64 bg-slate-900 border-r border-bez-border flex flex-col z-50">
            {/* Logo */}
            <div className="p-6 border-b border-bez-border">
                <h1 className="text-xl font-bold text-white">
                    <span className="text-bez-primary">BeZhas</span> DeFi
                </h1>
                <p className="text-xs text-slate-500 mt-1">Staking · Farming · DAO</p>
            </div>

            {/* Nav */}
            <nav className="flex-1 p-4 space-y-1">
                {navItems.map(({ href, label, icon: Icon }) => {
                    const active = pathname === href || (href !== '/' && pathname?.startsWith(href));
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${active
                                ? 'bg-bez-primary/20 text-bez-primary font-semibold'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            <Icon size={18} />
                            {label}
                        </Link>
                    );
                })}
            </nav>

            {/* Cross-app links */}
            <div className="p-4 border-t border-bez-border">
                <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Ecosystem</p>
                {crossAppLinks.map(({ href, label, icon: Icon }) => (
                    <a
                        key={href}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                        <Icon size={16} />
                        {label}
                    </a>
                ))}
            </div>
        </aside>
    );
}
