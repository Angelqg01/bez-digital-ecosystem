'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Sparkles, UserRound } from 'lucide-react';
import { MAGAZINE_CATEGORIES, MagazineCategory, magazinePosts } from '@/lib/magazine';

function formatDate(date: string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
}

export default function MagazineLanding() {
  const [category, setCategory] = useState<MagazineCategory | 'Todos'>('Todos');
  const [query, setQuery] = useState('');
  const featured = magazinePosts[0];

  const filteredPosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return magazinePosts.slice(1).filter((post) => {
      const matchesCategory = category === 'Todos' || post.category === category;
      const matchesQuery =
        !normalizedQuery ||
        `${post.title} ${post.excerpt} ${post.category}`.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

  return (
    <main className="magazine-page min-h-screen bg-[#0A0E1A] text-[var(--bez-text)]">
      <section className="mx-auto max-w-6xl px-6 pb-12 pt-14">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.35em] text-[#00D4FF]">
          BeZhas Magazine
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-normal md:text-6xl">
          Inteligencia editorial para el ecosistema Web3 de BeZhas
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--bez-text2)]">
          Noticias, analisis y actualizaciones nativas sobre blockchain, supply chain, RWA, DePIN e IA aplicada a infraestructura real.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6">
        <article className="overflow-hidden rounded-lg border border-[#00D4FF]/25 bg-[var(--bez-card)]">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
            <div
              className="min-h-[320px] bg-cover bg-center"
              style={{ backgroundImage: `linear-gradient(90deg, rgba(10,14,26,0.12), rgba(10,14,26,0.82)), url(${featured.coverImage})` }}
            />
            <div className="flex flex-col justify-center p-7 md:p-10">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-[#00D4FF]/12 px-3 py-1 text-xs font-black uppercase tracking-widest text-[#00D4FF]">
                  Featured Post
                </span>
                <span className="rounded-full border border-[#7B2FFF]/40 bg-[#7B2FFF]/10 px-3 py-1 text-xs font-bold text-[#C7B7FF]">
                  {featured.category}
                </span>
              </div>
              <h2 className="mt-5 text-3xl font-black leading-tight md:text-4xl">{featured.title}</h2>
              <p className="mt-4 text-sm leading-7 text-[var(--bez-text2)]">{featured.excerpt}</p>
              <div className="mt-6 flex items-center gap-4 text-xs text-[var(--bez-muted)]">
                <time dateTime={featured.publishedAt}>{formatDate(featured.publishedAt)}</time>
                <span>{featured.readTime}</span>
                <span className="inline-flex items-center gap-1">
                  {featured.authorType === 'ai' ? <Sparkles size={14} /> : <UserRound size={14} />}
                  {featured.authorType === 'ai' ? 'Generado por IA' : 'Escrito por Humano'}
                </span>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-wrap gap-2">
            {(['Todos', ...MAGAZINE_CATEGORIES] as const).map((item) => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                className={`h-10 rounded-lg border px-4 text-sm font-bold transition ${
                  category === item
                    ? 'border-[#00D4FF] bg-[#00D4FF] text-[#06111d]'
                    : 'border-white/10 bg-white/[0.03] text-[var(--bez-text2)] hover:border-[#00D4FF]/50'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          <label className="flex h-10 items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 focus-within:border-[#00D4FF]/60">
            <Search size={17} className="text-[#00D4FF]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar noticias"
              className="w-full bg-transparent text-sm text-[var(--bez-text)] outline-none placeholder:text-[var(--bez-muted)]"
            />
          </label>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredPosts.map((post) => (
            <article key={post.id} className="overflow-hidden rounded-lg border border-[var(--bez-border2)] bg-[var(--bez-card)]">
              <div className="h-44 bg-cover bg-center" style={{ backgroundImage: `url(${post.coverImage})` }} />
              <div className="p-5">
                <div className="mb-4 flex items-center justify-between gap-3 text-xs">
                  <span className="font-bold uppercase tracking-widest text-[#00D4FF]">{post.category}</span>
                  <span className="text-[var(--bez-muted)]">{formatDate(post.publishedAt)}</span>
                </div>
                <h3 className="text-xl font-black leading-snug">{post.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[var(--bez-text2)]">{post.excerpt}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-12 flex justify-center">
          <Link
            href="/admin/magazine"
            className="rounded-lg border border-[#7B2FFF]/50 bg-[#7B2FFF]/12 px-5 py-3 text-sm font-bold text-[#C7B7FF] hover:bg-[#7B2FFF]/20"
          >
            Crear noticia con Agente IA
          </Link>
        </div>
      </section>
    </main>
  );
}
