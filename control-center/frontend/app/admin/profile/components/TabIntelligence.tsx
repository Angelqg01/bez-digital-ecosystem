'use client';

import { useState, useEffect } from 'react';
import { BrainCircuit, Wrench, Download, Save, CodeSquare, Loader2, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';

export default function TabIntelligence() {
    const [soulText, setSoulText] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        api.get<any>('/admin-config/intelligence')
            .then(res => {
                if(res.data?.soul) setSoulText(res.data.soul);
            })
            .catch(() => {
                setSoulText(`# OpenClaw SOUL Core Definition

## Prime Directives
1. Protect BeZhas Blockchain integrity.
2. Keep irreversible actions behind human confirmation.
3. Consolidate successful loops into Obsidian memory.`);
            })
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.post('/admin-config/intelligence', { soul: soulText });
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch {
            setSuccess(false);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-fuchsia-500" /></div>;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
            {success && (
                <div className="absolute top-0 right-0 bg-emerald-900/90 text-emerald-300 border border-emerald-700 px-4 py-2 flex items-center space-x-2">
                    <CheckCircle2 size={16} /><span>SOUL actualizado exitosamente</span>
                </div>
            )}
            <div>
                <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-2">MCP Intelligence (OpenClaw)</h2>
                <p className="text-gray-400 text-sm max-w-2xl">Visualización del núcleo de pensamiento MCP, configuración del servidor BeZhas local y entorno para inyectar directivas éticas en tiempo real (SOUL.md).</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* ClawHub & MCP Settings */}
                <div className="space-y-6">
                    <div className="bg-white/5 border border-white/10 p-6 shadow-2xl">
                        <div className="flex items-center space-x-3 text-fuchsia-400 mb-6">
                            <BrainCircuit size={24} />
                            <h3 className="font-bold tracking-widest uppercase text-white">BeZhas Model Context Protocol</h3>
                        </div>
                        
                        <div className="bg-black/40 border border-white/5 p-4 mb-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">MCP Server URL</span>
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            </div>
                            <div className="text-xs text-fuchsia-300 font-mono tracking-wide">
                                http://localhost:8001/mcp/bezhas
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-3">Herramientas Base (Tools)</p>
                            
                            <div className="flex items-center justify-between p-3 border border-white/5 hover:bg-white/5 transition-colors group">
                                <div className="flex items-center space-x-3">
                                    <Wrench size={14} className="text-gray-500 group-hover:text-white transition-colors" />
                                    <span className="text-xs font-mono text-gray-300">analyzeGasStrategy()</span>
                                </div>
                                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 uppercase font-bold">Native</span>
                            </div>

                            <div className="flex items-center justify-between p-3 border border-white/5 hover:bg-white/5 transition-colors group">
                                <div className="flex items-center space-x-3">
                                    <Wrench size={14} className="text-gray-500 group-hover:text-white transition-colors" />
                                    <span className="text-xs font-mono text-gray-300">calculateSmartSwap()</span>
                                </div>
                                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 uppercase font-bold">Native</span>
                            </div>
                        </div>

                        <button className="w-full mt-6 py-3 border border-dashed border-fuchsia-500/30 text-fuchsia-400 text-xs font-bold uppercase tracking-widest hover:bg-fuchsia-500/10 transition-all flex justify-center items-center space-x-2">
                            <Download size={14} />
                            <span>Instalar Skills (ClawHub)</span>
                        </button>
                    </div>
                </div>

                {/* SOUL.md Editor */}
                <div className="bg-white/5 border border-white/10 p-6 flex flex-col h-full">
                    <div className="flex items-center space-x-3 text-[#0d33f2] mb-4">
                        <CodeSquare size={24} />
                        <h3 className="font-bold tracking-widest uppercase text-white">SOUL.md Editor Activo</h3>
                    </div>
                    
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest leading-relaxed mb-4">
                        Toda inyección en este archivo es procesada inmediatamente por la memoria episódica de OpenClaw. Define restricciones éticas, leyes asimovianas y priorizadas.
                    </p>

                    <div className="flex-1 relative border border-white/10 bg-[#05060a] p-1 rounded-sm">
                        <textarea
                            value={soulText}
                            onChange={(e) => setSoulText(e.target.value)}
                            className="w-full h-full min-h-[300px] bg-transparent text-gray-300 font-mono text-xs p-4 focus:outline-none resize-none"
                            spellCheck={false}
                        />
                    </div>
                    
                    <button onClick={handleSave} disabled={saving} className="w-full mt-4 bg-[#0d33f2] text-white px-6 py-3 text-xs font-bold tracking-widest uppercase shadow-[0_0_15px_rgba(13,51,242,0.3)] hover:brightness-110 transition-all flex items-center justify-center space-x-2">
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        <span>Compilar SOUL a Memoria Semántica</span>
                    </button>
                </div>
                
            </div>
        </div>
    );
}
