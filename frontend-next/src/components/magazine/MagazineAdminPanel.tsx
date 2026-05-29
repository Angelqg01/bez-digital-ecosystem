'use client';

import { useEffect, useMemo, useState } from 'react';
import { Save, Send, Image as ImageIcon } from 'lucide-react';
import { MAGAZINE_CATEGORIES, MagazineCategory } from '@/lib/magazine';
import { withAdminAuth } from '@/components/auth/withAdminAuth';
import MarketingAgentChat, { MarketingAgentDraft } from './MarketingAgentChat';

type PostForm = {
  title: string;
  category: MagazineCategory;
  coverImage: string;
  excerpt: string;
  content: string;
  status: 'draft' | 'published';
  coverImagePrompt: string;
};

const DRAFT_KEY = 'bezhas-magazine-draft';

const initialForm: PostForm = {
  title: '',
  category: 'Core Updates',
  coverImage: '',
  excerpt: '',
  content: '',
  status: 'draft',
  coverImagePrompt: '',
};

function MagazineAdminPanel() {
  const [form, setForm] = useState<PostForm>(initialForm);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(DRAFT_KEY);
    if (stored) {
      setForm({ ...initialForm, ...JSON.parse(stored) });
    }
  }, []);

  const wordCount = useMemo(() => form.content.trim().split(/\s+/).filter(Boolean).length, [form.content]);

  const updateField = <K extends keyof PostForm>(key: K, value: PostForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveDraft = () => {
    const draft = { ...form, status: 'draft' as const };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    setForm(draft);
    setSavedAt(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
  };

  const publishPost = () => {
    const published = { ...form, status: 'published' as const };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(published));
    setForm(published);
    setSavedAt(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
  };

  const applyAgentDraft = (draft: MarketingAgentDraft) => {
    setForm((current) => ({
      ...current,
      title: draft.title,
      category: draft.category,
      excerpt: draft.excerpt,
      content: draft.content,
      coverImagePrompt: draft.coverImagePrompt,
    }));
  };

  return (
    <main className="min-h-screen bg-[#0A0E1A] px-6 py-10 text-[var(--bez-text)]">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.35em] text-[#00D4FF]">
              Admin Magazine
            </p>
            <h1 className="mt-3 text-3xl font-black md:text-5xl">Crear noticia BeZhas Magazine</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--bez-text2)]">
              Redacta, guarda borradores y usa el Agente IA de Marketing para convertir un vibe en un post estructurado.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={saveDraft}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-4 text-sm font-bold text-[var(--bez-text)] hover:bg-white/[0.08]"
            >
              <Save size={17} />
              Guardar borrador
            </button>
            <button
              onClick={publishPost}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#00D4FF] px-4 text-sm font-black text-[#06111d] hover:brightness-110"
            >
              <Send size={17} />
              Publicar
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <section className="rounded-lg border border-[var(--bez-border2)] bg-[var(--bez-card)] p-5 md:p-7">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--bez-text2)]">Titulo</span>
                <input
                  value={form.title}
                  onChange={(event) => updateField('title', event.target.value)}
                  className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-[#0A0E1A] px-4 text-sm text-[var(--bez-text)] outline-none focus:border-[#00D4FF]/60"
                  placeholder="Titulo del post"
                />
              </label>

              <label>
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--bez-text2)]">Categoria</span>
                <select
                  value={form.category}
                  onChange={(event) => updateField('category', event.target.value as MagazineCategory)}
                  className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-[#0A0E1A] px-4 text-sm text-[var(--bez-text)] outline-none focus:border-[#00D4FF]/60"
                >
                  {MAGAZINE_CATEGORIES.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label>
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--bez-text2)]">Imagen de portada</span>
                <div className="mt-2 flex h-12 items-center gap-3 rounded-lg border border-white/10 bg-[#0A0E1A] px-4 focus-within:border-[#00D4FF]/60">
                  <ImageIcon size={17} className="text-[#00D4FF]" />
                  <input
                    value={form.coverImage}
                    onChange={(event) => updateField('coverImage', event.target.value)}
                    className="w-full bg-transparent text-sm text-[var(--bez-text)] outline-none"
                    placeholder="URL de imagen o upload futuro"
                  />
                </div>
              </label>

              <label className="md:col-span-2">
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--bez-text2)]">Extracto</span>
                <textarea
                  value={form.excerpt}
                  onChange={(event) => updateField('excerpt', event.target.value)}
                  rows={3}
                  className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-[#0A0E1A] p-4 text-sm leading-6 text-[var(--bez-text)] outline-none focus:border-[#00D4FF]/60"
                  placeholder="Resumen corto para tarjetas y SEO"
                />
              </label>

              <label className="md:col-span-2">
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--bez-text2)]">Editor rich text</span>
                <textarea
                  value={form.content}
                  onChange={(event) => updateField('content', event.target.value)}
                  rows={16}
                  className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-[#0A0E1A] p-4 font-mono text-sm leading-7 text-[var(--bez-text)] outline-none focus:border-[#00D4FF]/60"
                  placeholder="Usa Markdown por ahora: ## subtitulos, listas, enlaces y bloques de codigo."
                />
              </label>
            </div>

            <div className="mt-5 grid gap-3 border-t border-white/10 pt-5 text-sm text-[var(--bez-text2)] md:grid-cols-3">
              <div className="rounded-lg bg-white/[0.03] p-3">
                Estado: <span className="font-bold text-[#00D4FF]">{form.status}</span>
              </div>
              <div className="rounded-lg bg-white/[0.03] p-3">Palabras: {wordCount}</div>
              <div className="rounded-lg bg-white/[0.03] p-3">Guardado: {savedAt || 'sin cambios'}</div>
            </div>

            {form.coverImagePrompt && (
              <div className="mt-5 rounded-lg border border-[#7B2FFF]/25 bg-[#7B2FFF]/10 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-[#C7B7FF]">Prompt sugerido para portada</p>
                <p className="mt-2 text-sm leading-6 text-[var(--bez-text2)]">{form.coverImagePrompt}</p>
              </div>
            )}
          </section>

          <MarketingAgentChat onDraftGenerated={applyAgentDraft} />
        </div>
      </div>
    </main>
  );
}

export default withAdminAuth(MagazineAdminPanel);

