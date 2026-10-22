import {
  Landmark, Wallet, CreditCard, Truck, Zap, ScanLine, Fuel, Server, Eye, Gem, Users, Sparkles,
  Building2, KeyRound, Fingerprint, Route, ArrowUpRight, Download, ShieldCheck, Plug, Bot, type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  landmark: Landmark, wallet: Wallet, 'credit-card': CreditCard, truck: Truck, zap: Zap, 'scan-line': ScanLine,
  fuel: Fuel, server: Server, eye: Eye, gem: Gem, users: Users, sparkles: Sparkles, 'building-2': Building2,
  'key-round': KeyRound, fingerprint: Fingerprint, route: Route, 'arrow-up-right': ArrowUpRight, download: Download,
  'shield-check': ShieldCheck, plug: Plug, bot: Bot,
};

export default function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const C = ICONS[name] ?? Sparkles;
  return <C size={size} strokeWidth={1.8} aria-hidden="true" />;
}
