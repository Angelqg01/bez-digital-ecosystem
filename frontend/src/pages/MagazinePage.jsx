import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Search, Sparkles } from 'lucide-react';
import { magazineCategories, magazinePosts } from '../data/magazine';

export default function MagazinePage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [featured, ...rest] = magazinePosts;

  const posts = useMemo(() => {
    return rest.filter((post) => {
      const matchesCategory = category === 'All' || post.category === category;
      const text = `${post.title} ${post.excerpt} ${post.category}`.toLowerCase();
      return matchesCategory && text.includes(query.toLowerCase());
    });
  }, [category, query, rest]);

  return (
    <div className="min-h-screen bg-[#0A0E1A] px-4 py-8 text-slate-100 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">BeZhas Magazine</p>
          <h1 className="max-w-4xl text-4xl font-black text-white md:text-6xl">Noticias nativas del ecosistema BeZhas</h1>
          <p className="mt-4 max-w-2xl text-slate-300">Core updates, RWA, DePIN y supply chain con foco en legibilidad y contexto operativo.</p>
        </div>

        <article className="mb-8 overflow-hidden rounded-3xl border border-cyan-400/20 bg-slate-950 shadow-2xl shadow-cyan-950/20">
          <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
            <img src={featured.coverImage} alt="" className="h-full min-h-[300px] w-full object-cover" />
            <div className="flex flex-col justify-center p-6 md:p-10">
              <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-slate-400">
                <span className="rounded-full bg-violet-500/15 px-3 py-1 text-violet-200">{featured.category}</span>
                <span className="inline-flex items-center gap-2"><Calendar size={16} /> {featured.date}</span>
                <span className="inline-flex items-center gap-2 text-cyan-200"><Sparkles size={16} /> {featured.authorType}</span>
              </div>
              <h2 className="text-3xl font-black text-white md:text-5xl">{featured.title}</h2>
              <p className="mt-4 text-lg leading-8 text-slate-300">{featured.excerpt}</p>
            </div>
          </div>
        </article>

        <div className="mb-8 grid gap-4 lg:grid-cols-[1fr_auto]">
          <label className="relative block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 py-3 pl-11 pr-4 text-white outline-none focus:border-cyan-300"
              placeholder="Buscar noticias..."
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {magazineCategories.map((item) => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${category === item ? 'bg-cyan-300 text-slate-950' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {posts.map((post) => (
            <article key={post.id} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
              <img src={post.coverImage} alt="" className="h-48 w-full object-cover" />
              <div className="p-5">
                <div className="mb-3 flex items-center justify-between gap-3 text-xs text-slate-400">
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-cyan-200">{post.category}</span>
                  <span>{post.date}</span>
                </div>
                <h3 className="text-xl font-bold text-white">{post.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{post.excerpt}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8">
          <Link to="/admin/magazine" className="inline-flex rounded-xl border border-cyan-300/40 px-4 py-2 font-semibold text-cyan-200 hover:bg-cyan-300/10">
            Crear noticia
          </Link>
        </div>
      </div>
    </div>
  );
}
