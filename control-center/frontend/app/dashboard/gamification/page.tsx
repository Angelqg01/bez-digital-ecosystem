'use client';

import { useAchievements, useLeaderboard, useReferralCode, useReferralStats, useMarketplace, useGamificationFeed } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { useState } from 'react';
import { Trophy, Star, Medal, Info, ChevronRight, Users, Share2, ArrowUpRight, ShoppingBag, Gift, Sparkles } from 'lucide-react';
import CopyButton from '@/components/CopyButton';
import { toast } from 'sonner';

const rankBadges = ['🥇', '🥈', '🥉'];

// Level Calculation Logic: Exponential scale (level = floor(sqrt(XP/100)))
const getLevelInfo = (xp: number) => {
    const level = Math.floor(Math.sqrt(xp / 100)) || 1;
    const currentLevelXP = Math.pow(level, 2) * 100;
    const nextLevelXP = Math.pow(level + 1, 2) * 100;
    const xpInLevel = xp - currentLevelXP;
    const xpForNextLevel = nextLevelXP - currentLevelXP;
    const progress = Math.min(Math.max((xpInLevel / xpForNextLevel) * 100, 0), 100);

    return { level, progress, nextLevelXP, xpInLevel, xpForNextLevel };
};

const Skeleton = ({ className }: { className?: string }) => (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
);

export default function GamificationPage() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'achievements' | 'marketplace'>('achievements');
    const { data: achievements, isLoading: loadingA } = useAchievements();
    const { data: leaderboard, isLoading: loadingL } = useLeaderboard();
    const { data: referralCode } = useReferralCode();
    const { data: refStats } = useReferralStats();
    const { data: marketplace, isLoading: loadingM } = useMarketplace();
    const { data: feed } = useGamificationFeed();

    const unlocked = achievements?.filter(a => a.unlocked) ?? [];
    const totalXP = unlocked.reduce((s, a) => s + a.xp, 0);
    const { level, progress, nextLevelXP } = getLevelInfo(totalXP);

    const handleRedeem = async (itemId: string) => {
        try {
            const res = await fetch('/api/gamification/redeem', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('¡Canje exitoso! Revisa tus notificaciones para más detalles.');
            } else {
                toast.error(data.error || 'Error al canjear item');
            }
        } catch (err) {
            toast.error('Error de conexión');
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-bezhas-orange/10 rounded-lg">
                        <Trophy className="w-7 h-7 text-bezhas-orange" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Gamificación</h1>
                        <p className="text-sm text-gray-500">Logros, XP y reputación de la red BeZhas</p>
                    </div>
                </div>

                <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner border border-gray-200">
                    <button 
                        onClick={() => setActiveTab('achievements')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'achievements' ? 'bg-white text-bezhas-accent shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Logros
                    </button>
                    <button 
                        onClick={() => setActiveTab('marketplace')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'marketplace' ? 'bg-white text-bezhas-accent shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Marketplace
                    </button>
                </div>
            </div>

            {/* Level & XP Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-gradient-to-br from-bezhas-accent via-bezhas-purple to-indigo-600 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl group-hover:scale-110 transition-transform duration-700" />
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-md">
                                <Star className="w-8 h-8 text-yellow-300 fill-yellow-300" />
                            </div>
                            <div>
                                <p className="text-sm font-medium opacity-80 uppercase tracking-wider">Nivel Actual</p>
                                <p className="text-4xl font-black">Nivel {level}</p>
                            </div>
                            <div className="ml-auto text-right">
                                <p className="text-sm opacity-80">XP Acumulado</p>
                                <p className="text-3xl font-bold">{totalXP.toLocaleString()} <span className="text-lg font-normal opacity-70 text-yellow-200">XP</span></p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-sm font-medium">
                                <span>Progreso al Nivel {level + 1}</span>
                                <span>{totalXP.toLocaleString()} / {nextLevelXP.toLocaleString()} XP</span>
                            </div>
                            <div className="h-4 bg-black/20 rounded-full overflow-hidden p-1 border border-white/10">
                                <div 
                                    className="h-full bg-gradient-to-r from-yellow-300 to-yellow-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(253,224,71,0.5)]"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-4">
                        <Medal className="w-6 h-6 text-bezhas-orange" />
                        <h3 className="font-semibold text-gray-900">Estado de Logros</h3>
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-5xl font-black text-gray-900">{unlocked.length}</span>
                        <span className="text-xl font-bold text-gray-400 mb-1">/ {achievements?.length ?? 0}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">Completa más misiones para subir de rango en el sector.</p>
                </div>
            </div>

            {activeTab === 'achievements' ? (
                <>
                    {/* Referral Widget */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                            <Users className="w-32 h-32 text-bezhas-accent" />
                        </div>
                        
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                            <div className="space-y-3 max-w-xl">
                                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    <Users className="w-6 h-6 text-bezhas-accent" />
                                    Programa de Referidos Empresariales
                                </h2>
                                <p className="text-sm text-gray-500 leading-relaxed">
                                    Construye tu red BeZhas. Invita a socios comerciales, proveedores o sucursales. Gana <span className="text-bezhas-accent font-bold">+500 XP</span> por cada empresa que se una al ecosistema usando tu código único.
                                </p>
                                <div className="flex items-center gap-4 pt-2">
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                        {refStats?.stats.completed || 0} Verificados
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                        <div className="w-2 h-2 rounded-full bg-bezhas-orange" />
                                        {refStats?.stats.pending || 0} Pendientes
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 flex flex-col items-center gap-4 min-w-[280px]">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                    <Share2 className="w-3 h-3" /> Tu Código Único
                                </p>
                                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2 w-full justify-between shadow-sm">
                                    <code className="text-lg font-black text-bezhas-accent tracking-widest">{referralCode?.code || '------'}</code>
                                    <CopyButton text={referralCode?.code || ''} label="Copiar" className="text-[10px] font-bold text-gray-400 hover:text-bezhas-accent transition-colors" />
                                </div>
                                <div className="flex items-center gap-2 w-full">
                                    <div className="h-[1px] flex-1 bg-gray-200" />
                                    <span className="text-[10px] font-bold text-gray-300 uppercase">Stats</span>
                                    <div className="h-[1px] flex-1 bg-gray-200" />
                                </div>
                                <div className="grid grid-cols-2 w-full gap-4">
                                    <div className="text-center">
                                        <p className="text-lg font-black text-gray-900">{refStats?.stats.total || 0}</p>
                                        <p className="text-[9px] text-gray-400 uppercase font-bold tracking-tighter">Invitados</p>
                                    </div>
                                    <div className="text-center border-l border-gray-200">
                                        <p className="text-lg font-black text-bezhas-accent">+{refStats?.stats.xp_earned || 0}</p>
                                        <p className="text-[9px] text-gray-400 uppercase font-bold tracking-tighter">XP Ganado</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Achievements Grid */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2">
                            <h2 className="font-bold text-gray-900">Logros y Desafíos</h2>
                            <Sparkles className="w-4 h-4 text-bezhas-orange" />
                        </div>

                        {loadingA ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-48" />)}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {(achievements ?? []).map(a => {
                                    const progress = Math.min((a.current / a.threshold) * 100, 100);
                                    const category = a.id.startsWith('safety') ? 'Seguridad' : 
                                                     a.id.startsWith('carbon') ? 'Sostenibilidad' : 
                                                     a.id.startsWith('tx') || a.id.startsWith('nft') ? 'Blockchain' : 'General';
                                    
                                    const categoryColors: Record<string, string> = {
                                        'Seguridad': 'bg-red-50 text-red-600',
                                        'Sostenibilidad': 'bg-emerald-50 text-emerald-600',
                                        'Blockchain': 'bg-blue-50 text-blue-600',
                                        'General': 'bg-gray-50 text-gray-600'
                                    };

                                    return (
                                        <div key={a.id} className={`group relative rounded-2xl border p-6 transition-all duration-300 ${a.unlocked 
                                            ? 'bg-white border-bezhas-accent/20 shadow-md hover:shadow-xl hover:-translate-y-1' 
                                            : 'bg-white border-gray-100 opacity-80'
                                            }`}>
                                            
                                            <div className="flex items-start justify-between mb-4">
                                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${categoryColors[category] || categoryColors.General}`}>
                                                    {category}
                                                </span>
                                                <div className={`shrink-0 text-[10px] font-black px-2 py-1 rounded-lg ${a.unlocked 
                                                    ? 'bg-bezhas-accent/10 text-bezhas-accent border border-bezhas-accent/20' 
                                                    : 'bg-gray-100 text-gray-400'
                                                    }`}>+{a.xp} XP</div>
                                            </div>

                                            <div className="pr-2">
                                                <h3 className={`font-bold text-sm ${a.unlocked ? 'text-gray-900' : 'text-gray-500'}`}>{a.name}</h3>
                                                <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed h-8">{a.description}</p>
                                            </div>

                                            <div className="mt-6 space-y-2">
                                                <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase">
                                                    <span>Progreso</span>
                                                    <span>{a.current} / {a.threshold}</span>
                                                </div>
                                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full transition-all duration-1000 ${a.unlocked ? 'bg-bezhas-accent' : 'bg-bezhas-orange'}`}
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {a.unlocked && a.unlocked_at && (
                                                <div className="flex items-center gap-1.5 mt-4 text-[10px] font-medium text-emerald-600">
                                                    <ArrowUpRight className="w-3 h-3" />
                                                    Desbloqueado
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h2 className="font-bold text-gray-900">Marketplace de Recompensas</h2>
                            <ShoppingBag className="w-4 h-4 text-bezhas-purple" />
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase bg-gray-50 px-3 py-1 rounded-full">
                            Tu Saldo: <span className="text-bezhas-accent">{totalXP.toLocaleString()} XP</span>
                        </p>
                    </div>

                    {loadingM ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3].map(i => <Skeleton key={i} className="h-64" />)}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {marketplace?.map(item => (
                                <div key={item.id} className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col hover:shadow-xl transition-all group overflow-hidden relative">
                                    <div className="h-40 -mx-6 -mt-6 mb-6 overflow-hidden bg-gray-100 relative">
                                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-80" />
                                        <div className="absolute top-4 right-4 px-3 py-1 bg-white/90 backdrop-blur rounded-full text-[10px] font-black text-bezhas-accent shadow-sm uppercase">
                                            {item.type}
                                        </div>
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                                    </div>
                                    
                                    <div className="flex-1">
                                        <h3 className="font-bold text-gray-900 mb-2">{item.name}</h3>
                                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-4">{item.description}</p>
                                    </div>
                                    
                                    <div className="mt-6 pt-6 border-t border-gray-50 flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Costo</span>
                                            <span className="text-lg font-black text-bezhas-accent">{item.cost_xp.toLocaleString()} XP</span>
                                        </div>
                                        <button 
                                            onClick={() => handleRedeem(item.id)}
                                            disabled={totalXP < item.cost_xp}
                                            className={`px-6 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                                                totalXP >= item.cost_xp 
                                                ? 'bg-bezhas-accent text-white hover:bg-bezhas-purple shadow-md active:scale-95' 
                                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            }`}
                                        >
                                            <Gift className="w-3 h-3" />
                                            Canjear
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Social & Competition Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Leaderboard (2/3) */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="font-bold text-gray-900 flex items-center gap-2">
                            <Medal className="w-5 h-5 text-bezhas-orange" /> Tabla de Posiciones Global
                        </h2>
                    </div>

                    {loadingL ? (
                        <div className="space-y-2">
                            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50/50 text-gray-500 border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-4 font-semibold w-20">Rank</th>
                                            <th className="px-6 py-4 font-semibold">Empresa</th>
                                            <th className="px-6 py-4 font-semibold text-center">Nivel</th>
                                            <th className="px-6 py-4 font-semibold">Insignia</th>
                                            <th className="px-6 py-4 font-semibold text-right">XP</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {(leaderboard ?? []).map(e => {
                                            const isMe = e.enterprise_name === user?.username || e.enterprise_name === 'Dev Enterprise';
                                            return (
                                                <tr key={e.rank} className={`group transition-colors ${isMe ? 'bg-bezhas-accent/[0.03] hover:bg-bezhas-accent/[0.05]' : 'hover:bg-gray-50/50'}`}>
                                                    <td className="px-6 py-4">
                                                        {rankBadges[e.rank - 1] ? (
                                                            <span className="text-2xl">{rankBadges[e.rank - 1]}</span>
                                                        ) : (
                                                            <span className="text-gray-400 font-mono font-bold">#{e.rank}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${isMe ? 'bg-bezhas-accent text-white' : 'bg-gray-100 text-gray-500'}`}>
                                                                {e.enterprise_name.charAt(0)}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className={`font-bold ${isMe ? 'text-bezhas-accent' : 'text-gray-900'}`}>{e.enterprise_name}</span>
                                                                {isMe && <span className="text-[10px] font-medium text-bezhas-accent uppercase">Tu Empresa</span>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-bold">Lv {e.level}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-full border border-gray-100 font-medium">{e.badge}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className="font-mono font-black text-gray-900">{e.xp.toLocaleString()}</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Activity Feed (1/3) */}
                <div className="space-y-4">
                    <h2 className="font-bold text-gray-900 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-bezhas-purple" /> Muro de Actividad
                    </h2>
                    
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-h-[500px] overflow-y-auto space-y-6 scrollbar-hide">
                        {(feed ?? []).length === 0 ? (
                            <div className="text-center py-10">
                                <p className="text-xs text-gray-400 font-medium italic">Esperando actividad en la red...</p>
                            </div>
                        ) : (
                            feed?.map((item, idx) => (
                                <div key={item.id} className="relative pl-8 group">
                                    {/* Timeline line */}
                                    {idx !== feed.length - 1 && (
                                        <div className="absolute left-[11px] top-6 bottom-[-24px] w-[2px] bg-gray-100 group-last:hidden" />
                                    )}
                                    
                                    {/* Activity Icon */}
                                    <div className={`absolute left-0 top-0 w-6 h-6 rounded-full flex items-center justify-center shadow-sm z-10 ${
                                        item.type === 'achievement' ? 'bg-bezhas-accent text-white' : 
                                        item.type === 'redemption' ? 'bg-bezhas-purple text-white' : 'bg-gray-200 text-gray-500'
                                    }`}>
                                        {item.type === 'achievement' ? <Trophy className="w-3 h-3" /> : <Gift className="w-3 h-3" />}
                                    </div>
                                    
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{item.title}</p>
                                            <span className="text-[9px] text-gray-300 font-bold">{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <p className="text-sm font-bold text-gray-800 leading-tight">
                                            {item.description}
                                        </p>
                                        {item.xp_value > 0 && (
                                            <span className="inline-block text-[9px] font-black text-bezhas-accent bg-bezhas-accent/10 px-2 py-0.5 rounded-full mt-1">
                                                +{item.xp_value} XP
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="bg-bezhas-accent/[0.03] rounded-xl p-4 border border-bezhas-accent/10">
                        <p className="text-[10px] text-bezhas-accent/60 font-medium italic leading-relaxed">
                            "La competitividad saludable impulsa la innovación y la sostenibilidad en el ecosistema BeZhas."
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
