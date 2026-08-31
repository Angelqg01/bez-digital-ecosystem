/**
 * DocsPortal — Navegador de documentación interactivo
 * Muestra guías de: SDK, API, MCP, WordPress, ERP, ABI, Nodos, SubApps
 * Embebible en cualquier página (/developers/docs, /documentation, etc.)
 */
import React, { useState } from 'react';
import { BookOpen, Code, Plug2, Eye, Database, Shield, Zap, Users } from 'lucide-react';

const DOCS = [
  {
    id: 'sdk',
    title: '@bezhas/sdk',
    icon: Code,
    color: 'from-blue-500 to-cyan-500',
    description: 'Librería JavaScript/Node para cualquier plataforma',
    topics: ['Instalación', 'Autenticación', 'Pagos', 'Settlement', 'Webhooks'],
  },
  {
    id: 'api',
    title: 'REST API',
    icon: Plug2,
    color: 'from-purple-500 to-pink-500',
    description: 'Endpoints HTTP para integración sin SDK',
    topics: ['Autenticación', 'Pagos', 'Settlement', 'Stats', 'Rate limits'],
  },
  {
    id: 'mcp',
    title: 'MCP Server',
    icon: Zap,
    color: 'from-orange-500 to-red-500',
    description: 'Integración con n8n, Zapier, Make',
    topics: ['n8n', 'Zapier', 'Make', 'Workflows', 'Triggers'],
  },
  {
    id: 'wordpress',
    title: 'Plugin WordPress',
    icon: Eye,
    color: 'from-green-500 to-emerald-500',
    description: 'WooCommerce Gateway integrado',
    topics: ['Instalación', 'Configuración', 'Checkout', 'Dashboard', 'Webhooks'],
  },
  {
    id: 'erp',
    title: 'ERP Integration',
    icon: Database,
    color: 'from-indigo-500 to-blue-500',
    description: 'SAP, Oracle, Odoo, Sage, NetSuite',
    topics: ['SAP Adapter', 'Oracle Fusion', 'Odoo', 'Sincronización', 'Auditoría'],
  },
  {
    id: 'abi',
    title: 'Smart Contracts',
    icon: Shield,
    color: 'from-amber-500 to-orange-500',
    description: 'Interfaces blockchain de BeZhas',
    topics: ['BeZhasPayment', 'Settlement', 'Token', 'Eventos', 'Testnet'],
  },
  {
    id: 'nodes',
    title: 'Nodos & Validadores',
    icon: Users,
    color: 'from-rose-500 to-pink-500',
    description: 'RPC Nodes y Validadores',
    topics: ['Instalación', 'Sincronización', 'Staking', 'Rewards', 'Troubleshooting'],
  },
  {
    id: 'subapps',
    title: 'SubApps Manual',
    icon: BookOpen,
    color: 'from-teal-500 to-cyan-500',
    description: 'Guía de usuario para todas las apps',
    topics: ['Hub', 'CargoLink', 'Wallet', 'Capital', 'Energy', 'Prestige', 'PureScan', 'Genesis'],
  },
];

export default function DocsPortal() {
  const [selectedDoc, setSelectedDoc] = useState(DOCS[0].id);
  const doc = DOCS.find(d => d.id === selectedDoc);
  const Icon = doc.icon;

  return (
    <section className="min-h-screen bg-[#080911] text-white py-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-20">
        {/* Header */}
        <div className="mb-14 text-center">
          <h1 className="font-display text-5xl md:text-7xl font-black leading-tight uppercase italic mb-4 text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-400">
            Developer Portal
          </h1>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            Documentación completa: SDK, API, MCP, Plugins, Smart Contracts y más.
          </p>
        </div>

        {/* Grid de documentos */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-14">
          {DOCS.map((d) => {
            const DocIcon = d.icon;
            const isSelected = d.id === selectedDoc;
            return (
              <button
                key={d.id}
                onClick={() => setSelectedDoc(d.id)}
                className={`p-5 rounded-2xl border transition-all text-left group ${
                  isSelected
                    ? 'border-cyan-300 bg-gradient-to-br ' + d.color + ' text-white shadow-[0_0_30px_rgba(34,211,238,0.3)]'
                    : 'border-white/10 bg-white/5 hover:border-white/30 text-gray-300'
                }`}
              >
                <DocIcon
                  size={24}
                  className={`mb-3 ${isSelected ? 'text-white' : 'text-cyan-300 group-hover:text-white'}`}
                />
                <div className="font-bold text-sm uppercase tracking-wider mb-1">{d.title}</div>
                <div className={`text-xs leading-relaxed ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
                  {d.description}
                </div>
              </button>
            );
          })}
        </div>

        {/* Contenido de documentación */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-8 lg:p-12">
          {/* Header del doc */}
          <div className="flex items-center gap-4 mb-8 pb-8 border-b border-white/10">
            <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${doc.color} flex items-center justify-center`}>
              <Icon size={32} className="text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-black uppercase mb-1">{doc.title}</h2>
              <p className="text-gray-300">{doc.description}</p>
            </div>
          </div>

          {/* Topics */}
          <div className="mb-8">
            <h3 className="text-sm uppercase tracking-widest text-cyan-300 font-bold mb-4">Temas cubiertos</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {doc.topics.map((topic) => (
                <div
                  key={topic}
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-300 hover:border-cyan-300/50 transition-all"
                >
                  {topic}
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <a
            href={`/developers/docs/${doc.id}`}
            className="inline-block mt-8 px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-300 to-purple-400 text-[#080911] font-bold uppercase tracking-widest hover:scale-[1.03] transition-transform"
          >
            Leer documentación completa →
          </a>
        </div>

        {/* Búsqueda rápida */}
        <div className="mt-14 p-6 rounded-2xl border border-white/10 bg-white/5">
          <h3 className="text-sm uppercase tracking-widest text-gray-400 font-bold mb-4">¿No encuentras lo que buscas?</h3>
          <div className="flex gap-3 flex-wrap">
            <a href="#" className="px-4 py-2 text-sm text-cyan-300 hover:text-white transition-colors">
              📚 Índice completo
            </a>
            <a href="#" className="px-4 py-2 text-sm text-cyan-300 hover:text-white transition-colors">
              🔍 Búsqueda
            </a>
            <a href="#" className="px-4 py-2 text-sm text-cyan-300 hover:text-white transition-colors">
              💬 Chat de soporte
            </a>
            <a href="#" className="px-4 py-2 text-sm text-cyan-300 hover:text-white transition-colors">
              📧 support@bez.digital
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
