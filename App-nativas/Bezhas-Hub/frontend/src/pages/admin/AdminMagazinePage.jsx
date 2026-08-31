import { useState } from 'react';
import { Save, Send } from 'lucide-react';
import MarketingAgentChat from '../../components/magazine/MarketingAgentChat';

const initialPost = {
  title: '',
  category: 'Core Updates',
  coverImage: '',
  imagePrompt: '',
  content: '',
  status: 'draft'
};

export default function AdminMagazinePage() {
  const [post, setPost] = useState(initialPost);
  const [savedAt, setSavedAt] = useState('');

  const updateField = (field, value) => {
    setPost((current) => ({ ...current, [field]: value }));
  };

  const saveDraft = () => {
    localStorage.setItem('bezhas-magazine-draft', JSON.stringify({ ...post, status: 'draft' }));
    setSavedAt(new Date().toLocaleTimeString());
  };

  const publishPost = () => {
    localStorage.setItem('bezhas-magazine-published-preview', JSON.stringify({ ...post, status: 'published' }));
    setPost((current) => ({ ...current, status: 'published' }));
    setSavedAt(new Date().toLocaleTimeString());
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] p-4 text-slate-100 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Admin Magazine</p>
          <h1 className="text-3xl font-black text-white md:text-5xl">Crear noticia</h1>
          <p className="mt-3 text-slate-400">Borradores locales preparados para conectar con el flujo editorial y MCP de BeZhas.</p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <form className="rounded-2xl border border-slate-800 bg-slate-950 p-5 md:p-6">
            <div className="grid gap-5">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-300">Titulo</span>
                <input value={post.title} onChange={(event) => updateField('title', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-white outline-none focus:border-cyan-300" />
              </label>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-300">Categoria</span>
                  <select value={post.category} onChange={(event) => updateField('category', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-white outline-none focus:border-cyan-300">
                    <option>Core Updates</option>
                    <option>DePIN</option>
                    <option>RWA</option>
                    <option>Supply Chain</option>
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-300">Imagen de portada URL</span>
                  <input value={post.coverImage} onChange={(event) => updateField('coverImage', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-white outline-none focus:border-cyan-300" />
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-300">Prompt sugerido para portada</span>
                <textarea value={post.imagePrompt} onChange={(event) => updateField('imagePrompt', event.target.value)} rows={3} className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-white outline-none focus:border-cyan-300" />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-300">Contenido del post</span>
                <textarea value={post.content} onChange={(event) => updateField('content', event.target.value)} rows={14} className="rounded-xl border border-slate-700 bg-slate-900 p-4 font-mono text-sm text-white outline-none focus:border-cyan-300" />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button type="button" onClick={saveDraft} className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-2 font-semibold text-slate-100 hover:bg-slate-800">
                <Save size={18} /> Guardar borrador
              </button>
              <button type="button" onClick={publishPost} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-200">
                <Send size={18} /> Publicar
              </button>
              {savedAt && <span className="text-sm text-slate-400">Guardado a las {savedAt}</span>}
            </div>
          </form>

          <MarketingAgentChat
            onGenerated={(generated) => setPost((current) => ({ ...current, ...generated, status: 'draft' }))}
          />
        </div>
      </div>
    </div>
  );
}
