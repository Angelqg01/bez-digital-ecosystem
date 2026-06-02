'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard, BarChart3, Boxes, Fuel, FileText, Shield,
    Bell, Trophy, Settings, Globe, ChevronLeft, ChevronRight, Layers,
    ArrowRightLeft, Link2, Sprout, ScrollText, Bot,
    Wallet, User, TrendingUp, LogOut,
    QrCode, FileCheck, MessageSquare, Cpu, ShieldCheck, BrainCircuit, MonitorPlay,
    Database,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';

const NAV_ITEMS = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/demo', label: 'Demo Clientes', icon: MonitorPlay },
    { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/dashboard/market', label: 'Market', icon: TrendingUp },
    { href: '/dashboard/blockchain', label: 'Blockchain L2', icon: Link2 },
    { href: '/dashboard/sectors', label: 'Sectores', icon: Globe },
    { href: '/dashboard/contracts', label: 'Contratos', icon: Layers },
    { href: '/dashboard/transactions', label: 'Transacciones', icon: FileText },
    { href: '/dashboard/nfts', label: 'NFTs', icon: Boxes },
    { href: '/dashboard/wallet', label: 'Wallet', icon: Wallet },
    { href: '/dashboard/gas', label: 'Gas Tanks', icon: Fuel },
    { href: '/dashboard/bridge', label: 'Bridge', icon: ArrowRightLeft },
    { href: '/dashboard/farming', label: 'Farming', icon: Sprout },
    { href: '/dashboard/aegis', label: 'Aegis AI', icon: Shield },
    { href: '/dashboard/ai-logs', label: 'AI Logs', icon: ScrollText },
    { href: '/dashboard/agents', label: 'Agents', icon: Bot },
    { href: '/dashboard/runtime', label: 'Runtime', icon: Cpu },
    { href: '/dashboard/ai-agent', label: 'AI Agent', icon: BrainCircuit },
    { href: '/dashboard/parity', label: 'Parity Audit', icon: ShieldCheck },
    { href: '/dashboard/qr', label: 'Códigos QR', icon: QrCode },
    { href: '/dashboard/documents', label: 'Documentos', icon: FileCheck },
    { href: '/dashboard/channels', label: 'Canales', icon: MessageSquare },
    { href: '/dashboard/gamification', label: 'Gamificacion', icon: Trophy },
    { href: '/dashboard/notifications', label: 'Notificaciones', icon: Bell },
    { href: '/dashboard/profile', label: 'Mi Perfil', icon: User },
    { href: '/dashboard/settings', label: 'Configuracion', icon: Settings },
];

const DEV_ITEMS = [
    { href: 'http://localhost:3000', label: 'Control Center (Local)', icon: LayoutDashboard },
    { href: 'http://localhost:3001/api-docs', label: 'API Swagger Docs', icon: ScrollText },
    { href: 'http://localhost:3030', label: 'Grafana Dashboard', icon: BarChart3 },
    { href: 'http://localhost:9000', label: 'Portainer Docker', icon: Cpu },
    { href: 'http://localhost:9090', label: 'Prometheus Server', icon: Database },
    { href: 'http://localhost:9093', label: 'Alertmanager Alerts', icon: Bell },
    { href: 'http://localhost:8545', label: 'Blockchain L2 RPC', icon: Globe },
];

function SidebarLink({ href, label, icon: Icon, collapsed, active }: {
    href: string; label: string; icon: typeof LayoutDashboard; collapsed: boolean; active: boolean;
}) {
    const className = `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
        ${active
                    ? 'bg-bezhas-accent/10 text-bezhas-accent'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }
        ${collapsed ? 'justify-center' : ''}`;

    if (href.startsWith('http')) {
        return (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
                title={collapsed ? label : undefined}
            >
                <Icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span>{label}</span>}
            </a>
        );
    }

    return (
        <Link
            href={href}
            className={className}
            title={collapsed ? label : undefined}
        >
            <Icon className="w-5 h-5 shrink-0" />
            {!collapsed && <span>{label}</span>}
        </Link>
    );
}

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { logout } = useAuth();
    const [collapsed, setCollapsed] = useState(false);

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    return (
        <aside className={`${collapsed ? 'w-16' : 'w-56'} h-screen sticky top-0 flex flex-col bg-bezhas-blue border-r border-white/10 transition-all duration-200`}>
            {/* Logo */}
            <div className="flex items-center gap-2 px-4 h-16 border-b border-white/10">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-bezhas-accent to-bezhas-cyan flex items-center justify-center text-white font-bold text-sm">B</div>
                {!collapsed && <span className="text-white font-semibold text-lg">BeZhas</span>}
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
                {!collapsed && <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 px-3 pt-2 pb-1">Operaciones</div>}
                {NAV_ITEMS.map((item) => (
                    <SidebarLink
                        key={item.href}
                        {...item}
                        collapsed={collapsed}
                        active={pathname === item.href || (item.href !== '/dashboard' && (pathname ?? '').startsWith(item.href))}
                    />
                ))}

                {!collapsed && <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 px-3 pt-4 pb-1 border-t border-white/5 mt-4">DevOps & Infra L2</div>}
                {DEV_ITEMS.map((item) => (
                    <SidebarLink
                        key={item.href}
                        {...item}
                        collapsed={collapsed}
                        active={false}
                    />
                ))}
            </nav>

            {/* Logout + Collapse */}
            <div className="border-t border-white/10">
                <button
                    onClick={handleLogout}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium text-gray-400 hover:text-rose-400 hover:bg-white/5 transition-all ${collapsed ? 'justify-center' : ''}`}
                    title={collapsed ? 'Cerrar sesion' : undefined}
                >
                    <LogOut className="w-5 h-5 shrink-0" />
                    {!collapsed && <span>Cerrar sesion</span>}
                </button>
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="flex items-center justify-center w-full h-10 text-gray-500 hover:text-white transition-colors"
                >
                    {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
            </div>
        </aside>
    );
}
