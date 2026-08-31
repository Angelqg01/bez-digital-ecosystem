import Link from 'next/link';
import { ArrowRight, Sparkles, UserRound } from 'lucide-react';
import { getLatestPosts } from '@/lib/magazine';

function formatDate(date: string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

export default function LatestNewsGrid() {
  const posts = getLatestPosts(4);

  return (
    <section className="mx-auto max-w-6xl px-7 py-20" style={{ borderTop: '1px solid var(--bez-border)' }}>
      <div className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.32em] text-[#00D4FF]">
            BeZhas Magazine
          </p>
          <h2 className="mt-3 text-3xl font-black text-[var(--bez-text)] md:text-5xl">
            Ultimas Noticias
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--bez-text2)]">
            Actualizaciones del core, infraestructura DePIN, activos RWA y supply chain con contexto operativo para el ecosistema.
          </p>
        </div>
        <Link
          href="/magazine"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-[#00D4FF]/40 px-5 text-sm font-bold text-[#00D4FF] transition hover:bg-[#00D4FF]/10"
        >
          Ver todas las noticias
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {posts.map((post) => (
          <article
            key={post.id}
            className="group overflow-hidden rounded-lg border border-[var(--bez-border2)] bg-[var(--bez-card)] transition duration-300 hover:-translate-y-1 hover:border-[#00D4FF]/50 hover:shadow-[0_18px_40px_rgba(0,212,255,0.12)]"
          >
            <div
              className="h-40 bg-cover bg-center"
              style={{ backgroundImage: `linear-gradient(180deg, rgba(10,14,26,0) 35%, rgba(10,14,26,0.88) 100%), url(${post.coverImage})` }}
            />
            <div className="p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="rounded-full border border-[#7B2FFF]/40 bg-[#7B2FFF]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#C7B7FF]">
                  {post.category}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--bez-text2)]">
                  {post.authorType === 'ai' ? <Sparkles size={13} /> : <UserRound size={13} />}
                  {post.authorType === 'ai' ? 'Generado por IA' : 'Humano'}
                </span>
              </div>
              <h3 className="min-h-[72px] text-lg font-black leading-snug text-[var(--bez-text)]">
                {post.title}
              </h3>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--bez-text2)]">
                {post.excerpt}
              </p>
              <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-[var(--bez-muted)]">
                <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                <span>{post.readTime}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

