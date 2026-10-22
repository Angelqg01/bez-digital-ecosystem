import SectorContactFooter from '../_components/SectorContactFooter';

// Espejo de api/config/plans.js y api/config/stripe-payment-links.js (fuente de
// verdad). Si cambia un precio o un Payment Link, cambiarlo allí y aquí.
// El webhook checkout.session.completed activa el plan por metadata.plan_id.
type Plan = {
    id: string;
    name: string;
    profile: string;
    price: string;
    priceNote: string;
    annual?: string;
    features: string[];
    monthlyUrl?: string;
    annualUrl?: string;
    cta?: { label: string; href: string };
    highlight?: boolean;
};

const PLANS: Plan[] = [
    {
        id: 'starter',
        name: 'Starter',
        profile: 'Autónomos y startups',
        price: '0 €',
        priceNote: '15 días gratis, después pago por uso',
        features: [
            'Hub y Wallet incluidos',
            '150 acciones de IA para empezar',
            'API y SDK con consumo real',
            'OPERANT: Ventas y Soporte en modo borrador',
        ],
        cta: { label: 'Empezar gratis', href: '/register?plan=starter' },
    },
    {
        id: 'creator_pro',
        name: 'Creator Pro',
        profile: 'Pymes y creadores',
        price: '99 €',
        priceNote: '/mes + IVA',
        annual: '990 €/año (2 meses gratis)',
        features: [
            '1.500 acciones de IA al mes',
            '25 % de gas subvencionado',
            'Hub, Wallet y SubApps activables',
            'OPERANT opcional: 4 departamentos (+39 €/mes)',
        ],
        monthlyUrl: 'https://buy.stripe.com/8x2aEXgqY2q29bEeqTew807',
        annualUrl: 'https://buy.stripe.com/6oU9ATa2A6Gi0F83Mfew80a',
    },
    {
        id: 'business',
        name: 'Business',
        profile: 'Empresas en crecimiento',
        price: '499 €',
        priceNote: '/mes + IVA',
        annual: '4.990 €/año (2 meses gratis)',
        features: [
            '15.000 acciones de IA al mes',
            '50 % de gas subvencionado',
            'Conectores ERP: SAP, Dynamics, NetSuite, Odoo',
            'OPERANT opcional: 8 departamentos autónomos (+249 €/mes)',
        ],
        monthlyUrl: 'https://buy.stripe.com/00w3cv7UsggSfA22Ibew80f',
        annualUrl: 'https://buy.stripe.com/8x228r8YwfcO87A4Qjew80b',
        highlight: true,
    },
    {
        id: 'enterprise_vip',
        name: 'Enterprise VIP',
        profile: 'Holdings e instituciones',
        price: '2.499 €',
        priceNote: '/mes + IVA',
        annual: '24.990 €/año (2 meses gratis)',
        features: [
            'Acciones de IA sin límite',
            '100 % de gas subvencionado',
            'Despliegue y conectores ERP a medida',
            'OPERANT opcional: 10 departamentos (+1.199 €/mes)',
        ],
        monthlyUrl: 'https://buy.stripe.com/aFa4gzb6E4ya1Jc4Qjew809',
        annualUrl: 'https://buy.stripe.com/fZufZhgqY8Oq73w2Ibew80c',
    },
];

export default function PreciosPage() {
    return (
        <>
            <section className="pt-32 pb-16 px-6 max-w-7xl mx-auto text-center">
                <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter uppercase leading-none">
                    Planes y <span className="text-primary">precios</span>
                </h1>
                <p className="text-on-surface-variant text-lg max-w-2xl mx-auto mt-6">
                    Conecta tu ERP con puertos, aduanas, bancos y socios verificados. Contrata hoy, sin llamadas previas;
                    cancela cuando quieras. Pagando con BEZ-Coin, un 20&nbsp;% de descuento.
                </p>
            </section>

            <section className="pb-24 px-6 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    {PLANS.map((p) => (
                        <div
                            key={p.id}
                            className={`glass-panel border p-8 rounded-xl flex flex-col ${p.highlight ? 'border-primary' : 'border-white/10'}`}
                        >
                            {p.highlight && (
                                <span className="self-start text-[10px] uppercase tracking-[0.3em] font-bold text-primary mb-3">
                                    Más elegido
                                </span>
                            )}
                            <h2 className="text-2xl font-bold italic uppercase tracking-tighter">{p.name}</h2>
                            <p className="text-on-surface-variant text-sm mb-6">{p.profile}</p>
                            <div className="mb-1">
                                <span className="text-4xl font-black">{p.price}</span>{' '}
                                <span className="text-on-surface-variant text-sm">{p.priceNote}</span>
                            </div>
                            <p className="text-xs text-on-surface-variant mb-6 min-h-[1rem]">{p.annual ?? ''}</p>
                            <ul className="space-y-3 text-sm mb-8 flex-1">
                                {p.features.map((f) => (
                                    <li key={f} className="flex gap-2">
                                        <span className="material-symbols-outlined text-primary text-base">check</span>
                                        <span>{f}</span>
                                    </li>
                                ))}
                            </ul>
                            <div className="flex flex-col gap-3">
                                {p.cta && (
                                    <a href={p.cta.href} className="bg-primary text-white px-6 py-4 font-bold uppercase tracking-widest text-xs text-center hover:translate-y-[-2px] transition-transform">
                                        {p.cta.label}
                                    </a>
                                )}
                                {p.monthlyUrl && (
                                    <a href={p.monthlyUrl} rel="noopener" className="bg-primary text-white px-6 py-4 font-bold uppercase tracking-widest text-xs text-center hover:translate-y-[-2px] transition-transform">
                                        Contratar mensual
                                    </a>
                                )}
                                {p.annualUrl && (
                                    <a href={p.annualUrl} rel="noopener" className="glass-panel border border-white/10 text-white px-6 py-4 font-bold uppercase tracking-widest text-xs text-center hover:bg-white/10 transition-colors">
                                        Contratar anual
                                    </a>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-on-surface-variant mt-8 text-center max-w-3xl mx-auto">
                    Precios en euros sin IVA (21&nbsp;%). El pago se procesa con Stripe y el plan se activa automáticamente en tu cuenta.
                    BEZ-Coin es un token de utilidad de la plataforma BeZhas y no constituye un producto de inversión.
                </p>
            </section>

            <section className="pb-32 px-6">
                <div className="max-w-4xl mx-auto glass-panel border border-primary/20 p-12 text-center rounded-xl">
                    <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-4">
                        ¿Piloto a <span className="text-primary">medida</span>?
                    </h2>
                    <p className="text-on-surface-variant text-lg mb-8 max-w-2xl mx-auto">
                        Para puertos, transitarios y agentes de aduanas diseñamos un piloto de 30 días conectado a tu ERP.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <a href="/onboarding" className="bg-primary text-white px-10 py-4 font-bold uppercase tracking-widest text-sm">
                            Solicitar piloto
                        </a>
                        <a href="mailto:ventas@bezhas.com?subject=Piloto%20BeZhas" className="glass-panel border border-white/10 text-white px-10 py-4 font-bold uppercase tracking-widest text-sm">
                            ventas@bezhas.com
                        </a>
                    </div>
                </div>
            </section>

            <SectorContactFooter department="ventas" />
        </>
    );
}
