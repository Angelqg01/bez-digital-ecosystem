/**
 * ApiConnectionGuide — "Conecta tu empresa a las demás en 4 pasos".
 *
 * Sección guía de usuario con estética glass-pipes: 4 nodos (empresas) unidos
 * por tuberías de cristal que muestran el flujo de datos por la API.
 *
 * Cero jerga blockchain. Tono comercial: "tu empresa habla con sus socios sin
 * desarrollos a medida". Apilado responsive: en mobile los pasos van en columna.
 */
import React, { useEffect, useRef, useState } from 'react';
import { KeyRound, Plug, Webhook, ShieldCheck } from 'lucide-react';
import GlassPipes from './GlassPipes';

const STEPS = [
    {
        icon: KeyRound,
        title: 'Registra tu empresa',
        text: 'Creas tu cuenta en el portal de desarrolladores y obtienes tu API key. 2 minutos, sin papeleo.',
    },
    {
        icon: Plug,
        title: 'Conecta tus sistemas',
        text: 'Tu ERP o tu app llama a un solo endpoint. Pedidos, facturas y entregas se entienden con cualquier socio.',
    },
    {
        icon: Webhook,
        title: 'Recibe eventos firmados',
        text: 'Cuando un socio confirma un envío o un pago, te llega un webhook con firma criptográfica verificable.',
    },
    {
        icon: ShieldCheck,
        title: 'Opera con confianza',
        text: 'Cada operación queda registrada y auditable. Si surge una duda, hay un único hilo de evidencia compartida.',
    },
];

// Nodos del SVG (en coordenadas viewBox 0..100). Los pasos del DOM se alinean
// por columnas debajo. Las tuberías encadenan los 4 nodos.
const NODES = [
    { x: 12, y: 50, label: 'Tu empresa' },
    { x: 38, y: 30, label: 'Hub' },
    { x: 64, y: 70, label: 'Socio A' },
    { x: 88, y: 40, label: 'Socio B' },
];
const PIPES = [
    { from: [NODES[0].x, NODES[0].y], to: [NODES[1].x, NODES[1].y], curve: -18 },
    { from: [NODES[1].x, NODES[1].y], to: [NODES[2].x, NODES[2].y], curve: 18 },
    { from: [NODES[2].x, NODES[2].y], to: [NODES[3].x, NODES[3].y], curve: -16 },
];
// Referencia estable para GlassPipes (memo) — no recrear el array en cada render.
const NODE_POINTS = NODES.map(({ x, y }) => ({ x, y }));

export default function ApiConnectionGuide() {
    const ref = useRef(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!ref.current) return;
        const io = new IntersectionObserver(
            ([e]) => e.isIntersecting && setVisible(true),
            { threshold: 0.18 }
        );
        io.observe(ref.current);
        return () => io.disconnect();
    }, []);

    return (
        <section
            ref={ref}
            id="conexion-api"
            className="relative py-24 px-6 lg:px-20 overflow-hidden z-10 border-y border-white/5 bg-[#080911]/70 backdrop-blur-md"
        >
            <div className="absolute inset-0">
                <GlassPipes
                    paths={PIPES}
                    nodes={NODE_POINTS}
                    viewBox="0 0 100 100"
                    speed={3.6}
                    particleCount={2}
                />
            </div>

            <div className="relative max-w-6xl mx-auto">
                <div className="text-center mb-14">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-cyan-300/30 mb-5">
                        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-300">
                            Guía rápida
                        </span>
                    </div>
                    <h2 className="font-display text-4xl md:text-6xl font-black leading-tight text-white uppercase italic">
                        Conecta tu empresa <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-400">
                            con las demás en 4 pasos
                        </span>
                    </h2>
                    <p className="mt-6 text-gray-300 text-lg max-w-2xl mx-auto leading-relaxed">
                        Una sola integración para hablar con todos tus socios. Sin desarrollos
                        a medida por cada cliente. Sin formatos que adivinar.
                    </p>
                </div>

                <ol className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
                    {STEPS.map((s, i) => {
                        const Icon = s.icon;
                        return (
                            <li
                                key={s.title}
                                className={`relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 transition-all duration-700 ease-out ${
                                    visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                                }`}
                                style={{ transitionDelay: `${i * 140}ms` }}
                            >
                                <div className="absolute -top-3 -left-3 w-9 h-9 rounded-full bg-gradient-to-br from-cyan-300 to-purple-500 text-[#080911] text-sm font-black flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.4)]">
                                    {i + 1}
                                </div>
                                <Icon size={28} className="text-cyan-300 mb-4" />
                                <h3 className="text-white font-bold text-lg mb-2">{s.title}</h3>
                                <p className="text-gray-400 text-sm leading-relaxed">{s.text}</p>
                            </li>
                        );
                    })}
                </ol>

                <p className="mt-10 text-center text-sm text-gray-500">
                    ¿Lo prefieres por SDK?{' '}
                    <a href="/developers" className="text-cyan-300 hover:underline">
                        SDK y MCP listos para tu stack →
                    </a>
                </p>
            </div>
        </section>
    );
}
