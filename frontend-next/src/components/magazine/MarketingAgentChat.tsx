'use client';

import { useState } from 'react';
import { Bot, Send, Sparkles } from 'lucide-react';
import { useMCPTool } from '@/hooks/useMCPTool';
import { MagazineCategory } from '@/lib/magazine';

export type MarketingAgentDraft = {
  title: string;
  category: MagazineCategory;
  content: string;
  excerpt: string;
  coverImagePrompt: string;
};

type MarketingToolResult = {
  status: string;
  data?: MarketingAgentDraft;
  reasoning?: string;
};

type Props = {
  onDraftGenerated: (draft: MarketingAgentDraft) => void;
};

export default function MarketingAgentChat({ onDraftGenerated }: Props) {
  const [vibe, setVibe] = useState('');
  const [lastPrompt, setLastPrompt] = useState('');
  const { execute, isLoading, error } = useMCPTool<MarketingToolResult>('generate_marketing_post');

  const handleGenerate = async () => {
    const cleanVibe = vibe.trim();
    if (!cleanVibe) return;

    setLastPrompt(cleanVibe);
    const result = await execute({
      vibe: cleanVibe,
      audience: 'BeZhas Blockchain ecosystem',
      categories: ['Core Updates', 'DePIN', 'RWA', 'Supply Chain'],
    }).catch(() => null);

    if (result?.data) {
      onDraftGenerated(result.data);
    }
  };

  return (
    <aside className="rounded-lg border border-[#00D4FF]/25 bg-[#06101f] p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#00D4FF]/12 text-[#00D4FF]">
          <Bot size={22} />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#00D4FF]">MCP Marketing Agent</p>
          <h2 className="text-lg font-black text-[var(--bez-text)]">Generacion por Vibe Coding</h2>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <label className="text-xs font-bold uppercase tracking-widest text-[var(--bez-text2)]">Vibe o intencion</label>
        <textarea
          value={vibe}
          onChange={(event) => setVibe(event.target.value)}
          rows={6}
          placeholder="Escribe un post optimista y tecnico sobre como BeZhas reduce el fraude aduanero, con un vibe cyberpunk corporativo"
          className="mt-3 w-full resize-none rounded-lg border border-white/10 bg-[#0A0E1A] p-3 text-sm leading-6 text-[var(--bez-text)] outline-none placeholder:text-[var(--bez-muted)] focus:border-[#00D4FF]/60"
        />
        <button
          onClick={handleGenerate}
          disabled={isLoading || !vibe.trim()}
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#00D4FF] px-4 text-sm font-black text-[#06111d] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? <Sparkles size={17} className="animate-pulse" /> : <Send size={17} />}
          {isLoading ? 'Invocando agente...' : 'Generar borrador'}
        </button>
      </div>

      {lastPrompt && (
        <div className="mt-4 rounded-lg border border-[#7B2FFF]/25 bg-[#7B2FFF]/10 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-[#C7B7FF]">Ultimo vibe enviado</p>
          <p className="mt-2 text-sm leading-6 text-[var(--bez-text2)]">{lastPrompt}</p>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </p>
      )}
    </aside>
  );
}
