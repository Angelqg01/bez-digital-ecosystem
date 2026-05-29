import { useState } from 'react';
import { Bot, Sparkles, Loader2 } from 'lucide-react';
import { useMCPTool } from '../../hooks/useMCPTool';

export default function MarketingAgentChat({ onGenerated }) {
  const [vibe, setVibe] = useState('');
  const { execute, loading, error } = useMCPTool('generate_marketing_post');

  const handleGenerate = async () => {
    if (!vibe.trim()) return;

    try {
      const response = await execute({ vibe });
      const payload = response?.result || response?.data || response;
      onGenerated?.({
        title: payload?.title || 'Post sugerido por Marketing IA',
        category: payload?.category || 'Core Updates',
        coverImage: payload?.coverImage || '',
        imagePrompt: payload?.imagePrompt || payload?.coverPrompt || '',
        content: payload?.content || payload?.body || ''
      });
    } catch {
      onGenerated?.({
        title: 'BeZhas transforma operaciones complejas en confianza verificable',
        category: 'Core Updates',
        imagePrompt: `Cyberpunk corporativo para: ${vibe}`,
        content: `# BeZhas transforma operaciones complejas\n\nVibe solicitado: ${vibe}\n\nBeZhas combina IA, trazabilidad y blockchain para convertir procesos empresariales en flujos verificables, auditables y preparados para escalar.`
      });
    }
  };

  return (
    <section className="rounded-2xl border border-cyan-400/20 bg-slate-950/80 p-5 shadow-xl shadow-cyan-950/20">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-xl bg-cyan-400/10 p-2 text-cyan-300">
          <Bot size={22} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Agente IA de Marketing</h3>
          <p className="text-sm text-slate-400">Genera un borrador desde una intencion o vibe.</p>
        </div>
      </div>

      <textarea
        value={vibe}
        onChange={(event) => setVibe(event.target.value)}
        rows={5}
        className="w-full rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-white outline-none transition focus:border-cyan-300"
        placeholder="Ej: Escribe un post optimista y tecnico sobre como BeZhas reduce el fraude aduanero, con un vibe cyberpunk corporativo."
      />

      {error && <p className="mt-3 text-sm text-amber-300">Modo fallback activo: {error}</p>}

      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading || !vibe.trim()}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
        Generar con Vibe
      </button>
    </section>
  );
}
