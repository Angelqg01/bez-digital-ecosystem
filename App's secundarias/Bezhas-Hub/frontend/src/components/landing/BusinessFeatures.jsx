/**
 * BusinessFeatures — "Qué hace BeZhas-Hub por tu empresa" (cero jerga).
 * 6 cards de funciones B2B en lenguaje de director comercial, no de ingeniero.
 */
import React from 'react';
import {
    Network, FileSignature, Banknote, Eye, BellRing, Boxes,
} from 'lucide-react';

const FEATURES = [
    {
        icon: Network,
        title: 'Una API para todos tus socios',
        text: 'Habla con clientes, proveedores y plataformas a través de una sola conexión. Olvídate de mantener 20 integraciones distintas.',
    },
    {
        icon: FileSignature,
        title: 'Contratos y pedidos verificables',
        text: 'Cada acuerdo queda firmado y consultable por las partes autorizadas. Si surge una duda, basta abrir el hilo.',
    },
    {
        icon: Banknote,
        title: 'Pagos y cobros sin fricción',
        text: 'Liquidaciones inmediatas con tus socios. Menos dinero esperando en cuentas por cobrar, mejor flujo de caja.',
    },
    {
        icon: Eye,
        title: 'Visibilidad de extremo a extremo',
        text: 'Sabes en tiempo real dónde está tu pedido, tu envío y tu factura. Tus clientes también — sin tener que llamar para preguntar.',
    },
    {
        icon: BellRing,
        title: 'Eventos firmados y auditables',
        text: 'Cada confirmación llega como webhook con firma criptográfica. Tu sistema actúa solo cuando un evento es legítimo.',
    },
    {
        icon: Boxes,
        title: 'Catálogo de socios ya verificados',
        text: 'Conecta con empresas que ya están en la red, sin onboarding manual. Tu ecosistema se amplía con un clic.',
    },
];

export default function BusinessFeatures() {
    return (
        <section id="funciones" className="relative py-24 px-6 lg:px-20 z-10">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-14">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-purple-300/30 mb-5">
                        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-purple-300">
                            Qué hace por tu empresa
                        </span>
                    </div>
                    <h2 className="font-display text-4xl md:text-6xl font-black leading-tight text-white uppercase italic">
                        Las funciones que <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-cyan-300">
                            tu equipo agradece
                        </span>
                    </h2>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
                    {FEATURES.map(({ icon: Icon, title, text }) => (
                        <div
                            key={title}
                            className="group relative rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-6 hover:border-cyan-300/30 hover:-translate-y-1 transition-all duration-300"
                        >
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-300/20 to-purple-400/20 flex items-center justify-center mb-4 group-hover:from-cyan-300/30 group-hover:to-purple-400/30 transition-all">
                                <Icon size={22} className="text-cyan-300" />
                            </div>
                            <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">{text}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
