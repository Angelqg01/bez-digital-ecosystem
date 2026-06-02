'use client';

const TIER_META: Record<number, { label: string; color: string; bg: string }> = {
    1: { label: 'Bronze', color: 'text-orange-300', bg: 'bg-orange-900/40' },
    2: { label: 'Silver', color: 'text-gray-300', bg: 'bg-gray-700/50' },
    3: { label: 'Gold', color: 'text-yellow-300', bg: 'bg-yellow-900/40' },
    4: { label: 'Platinum', color: 'text-cyan-300', bg: 'bg-cyan-900/40' },
};

interface Props {
    tier: number;
    size?: 'sm' | 'md';
}

export default function ValidatorTierBadge({ tier, size = 'sm' }: Props) {
    const meta = TIER_META[tier] ?? { label: `Tier ${tier}`, color: 'text-zinc-400', bg: 'bg-zinc-800/50' };
    const sizeClass = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs';
    return (
        <span className={`inline-flex items-center rounded-full font-semibold ${meta.bg} ${meta.color} ${sizeClass}`}>
            {meta.label}
        </span>
    );
}
