'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Shield } from 'lucide-react';
import { useNotifications } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import HeaderAuthButton from './HeaderAuthButton';

export default function Header() {
    const router = useRouter();
    const { data: notifications } = useNotifications();
    const { user } = useAuth();
    const unread = notifications?.filter(n => !n.read).length ?? 0;
    const canAccessAdmin = ['superadmin', 'admin'].includes((user?.role ?? '').toLowerCase());

    return (
        <header className="h-16 border-b border-gray-200 bg-[#090d16] flex items-center justify-between px-6 shrink-0 shadow-lg">
            <div>
                <h2 className="text-lg font-black italic tracking-tighter text-white uppercase font-sans">Enterprise Control Center</h2>
                <p className="text-xs text-slate-400">BeZhas L2 &middot; Chain 2708</p>
            </div>
            <div className="flex items-center gap-6">
                {canAccessAdmin && (
                    <Link
                        href="/admin/profile"
                        className="hidden sm:flex items-center gap-2 rounded-lg border border-bezhas-accent/20 bg-bezhas-accent/10 px-3 py-2 text-xs font-semibold text-bezhas-accent hover:bg-bezhas-accent/15 transition-colors"
                    >
                        <Shield className="w-4 h-4" />
                        Admin
                    </Link>
                )}
                <div className="relative cursor-pointer">
                    <Bell className="w-5 h-5 text-slate-400 hover:text-white transition-colors" />
                    {unread > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {unread > 9 ? '9+' : unread}
                        </span>
                    )}
                </div>

                {/* Unified Header Auth Button (Pill shape) */}
                <HeaderAuthButton />
            </div>
        </header>
    );
}
