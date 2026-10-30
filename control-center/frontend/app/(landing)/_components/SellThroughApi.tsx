import Link from 'next/link';

/**
 * «Vende a través de la API de BeZhas» — bloque comercial del programa de
 * proveedores del marketplace de APIs (docs/API_MARKETPLACE_DISENO.md).
 *
 * Se usa en /docs, /developers y /mcp. El marketplace está en acceso
 * anticipado: el texto lo dice, y no promete cifras (comisión, volumen de
 * clientes) que todavía no están fijadas.
 */

const CONTACT = 'mailto:support@bezhas.com?subject=BeZhas%20%E2%80%94%20Quiero%20vender%20a%20trav%C3%A9s%20de%20la%20API';

const BENEFITS = [
    {
        icon: 'storefront',
        title: 'Clientes nuevos sin buscarlos',
        text: 'Tus servicios, datos o productos aparecen en el catálogo que ven las empresas que BeZhas capta cada día: logística, aduanas, industria, energía y activos reales.',
    },
    {
        icon: 'smart_toy',
        title: 'Vende también a agentes IA',
        text: 'Tu API se convierte en una herramienta del MCP de BeZhas. Los asistentes de IA de tus clientes la encuentran, la entienden y la usan sin integración a medida.',
    },
    {
        icon: 'payments',
        title: 'Cobras por cada uso',
        text: 'Por llamada, por suscripción o por licencia de datos. El cobro llega a tu cuenta y BeZhas se lleva una comisión sólo cuando vendes: sin perseguir facturas.',
    },
    {
        icon: 'verified_user',
        title: 'Confianza que se puede demostrar',
        text: 'Clientes verificados, cada llamada con su recibo firmado y anclado en blockchain. Si hay una discrepancia, se resuelve con datos y no con correos.',
    },
];

export default function SellThroughApi({ id = 'vende-con-bezhas' }: { id?: string }) {
    return (
        <section id={id} className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.12] via-transparent to-tertiary/[0.08] px-6 sm:px-10 py-14 md:py-16 scroll-mt-32">
            <div className="absolute -top-24 -right-24 w-72 h-72 bg-primary/20 blur-[100px] pointer-events-none" aria-hidden="true"></div>

            <div className="relative grid gap-10 lg:grid-cols-[1.1fr_1fr] items-start">
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <span className="h-2 w-2 bg-tertiary rounded-full animate-pulse"></span>
                        <span className="text-[10px] tracking-[0.4em] uppercase text-tertiary font-bold">Nuevo · Programa de proveedores</span>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter uppercase leading-[0.95] mb-6">
                        Tu API, <span className="text-primary">nuestro canal de ventas</span>
                    </h2>
                    <p className="text-lg text-on-surface-variant leading-relaxed mb-4 max-w-xl">
                        Conecta tu negocio a la API de BeZhas y publica lo que ya haces bien como un servicio que otras empresas pueden contratar al momento.
                        Tú pones el producto; BeZhas pone los clientes, el cobro y la confianza.
                    </p>
                    <p className="text-sm text-on-surface-variant/80 leading-relaxed mb-8 max-w-xl">
                        Estamos en acceso anticipado y seleccionando a los primeros proveedores. Los que entren ahora salen en el catálogo desde el primer día.
                    </p>
                    <div className="flex flex-wrap gap-4">
                        <a href={CONTACT} className="bg-primary text-white px-8 py-4 font-bold uppercase tracking-widest text-xs hover:scale-105 transition-transform inline-flex items-center gap-2">
                            QUIERO VENDER EN BEZHAS <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </a>
                        <Link href="/docs#api-reference" className="glass-panel border border-white/10 text-white px-8 py-4 font-bold uppercase tracking-widest text-xs hover:bg-white/10 transition-colors inline-flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">api</span>
                            VER LA API
                        </Link>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    {BENEFITS.map((b) => (
                        <div key={b.title} className="glass-panel rounded-xl border border-white/5 p-5 hover:border-primary/30 transition-colors">
                            <span className="material-symbols-outlined text-primary text-2xl mb-3 block">{b.icon}</span>
                            <h3 className="font-black italic uppercase tracking-tight text-base mb-2">{b.title}</h3>
                            <p className="text-sm text-on-surface-variant leading-relaxed">{b.text}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
