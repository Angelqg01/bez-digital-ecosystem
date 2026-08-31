import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
    DOC_LIBRARY,
    getDocEntry,
    getDocNeighbours,
    loadDoc,
} from '@/lib/docs-library';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://bez.digital';

export function generateStaticParams() {
    return DOC_LIBRARY.map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const entry = getDocEntry(slug);

    if (!entry) {
        return { title: 'Documento no encontrado | BeZhas Docs' };
    }

    const title = `${entry.title} | BeZhas Docs`;
    const canonical = `${BASE_URL}/docs/${entry.slug}`;

    return {
        title,
        description: entry.description,
        alternates: { canonical },
        openGraph: {
            title,
            description: entry.description,
            url: canonical,
            siteName: 'BeZhas Protocol',
            type: 'article',
            locale: 'es_ES',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description: entry.description,
        },
    };
}

export default async function DocPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const doc = loadDoc(slug);

    if (!doc) notFound();

    const { entry, html, headings, readingMinutes } = doc;
    const { prev, next } = getDocNeighbours(entry.slug);
    const sections = headings.filter((h) => h.level === 2);

    return (
        <div className="max-w-7xl mx-auto px-8 py-12">
            {/* Miga de pan */}
            <nav className="flex items-center gap-2 text-[11px] tracking-widest uppercase text-on-surface-variant mb-8">
                <Link href="/docs" className="hover:text-primary transition-colors">
                    Docs
                </Link>
                <span className="material-symbols-outlined text-sm">chevron_right</span>
                <span className="text-on-surface-variant/60">{entry.category}</span>
                <span className="material-symbols-outlined text-sm">chevron_right</span>
                <span className="text-primary">{entry.title}</span>
            </nav>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-12 items-start">
                {/* Contenido */}
                <article className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3 mb-6">
                        <span className="inline-flex items-center gap-2 text-[10px] tracking-[0.25em] uppercase font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">
                            <span className="material-symbols-outlined text-sm">{entry.icon}</span>
                            {entry.category}
                        </span>
                        <span className="text-[10px] tracking-[0.25em] uppercase font-bold text-on-surface-variant bg-white/5 px-3 py-1 rounded-full">
                            {entry.level}
                        </span>
                        <span className="text-[10px] tracking-[0.25em] uppercase text-on-surface-variant">
                            {readingMinutes} min de lectura
                        </span>
                    </div>

                    <div
                        className="md-body"
                        dangerouslySetInnerHTML={{ __html: html }}
                    />

                    {/* Navegación entre documentos */}
                    <nav className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-16 pt-8 border-t border-white/5">
                        {prev ? (
                            <Link
                                href={`/docs/${prev.slug}`}
                                className="glass-panel border border-white/5 rounded-xl p-5 hover:border-primary/30 transition-all group"
                            >
                                <span className="text-[10px] tracking-[0.25em] uppercase text-on-surface-variant block mb-2">
                                    Anterior
                                </span>
                                <span className="font-bold text-white text-sm inline-flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm group-hover:-translate-x-1 transition-transform">
                                        arrow_back
                                    </span>
                                    {prev.title}
                                </span>
                            </Link>
                        ) : (
                            <span />
                        )}
                        {next && (
                            <Link
                                href={`/docs/${next.slug}`}
                                className="glass-panel border border-white/5 rounded-xl p-5 hover:border-primary/30 transition-all group sm:text-right"
                            >
                                <span className="text-[10px] tracking-[0.25em] uppercase text-on-surface-variant block mb-2">
                                    Siguiente
                                </span>
                                <span className="font-bold text-white text-sm inline-flex items-center gap-2">
                                    {next.title}
                                    <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">
                                        arrow_forward
                                    </span>
                                </span>
                            </Link>
                        )}
                    </nav>
                </article>

                {/* Índice lateral */}
                <aside className="hidden lg:block sticky top-24">
                    {sections.length > 0 && (
                        <>
                            <div className="text-[10px] tracking-[0.3em] uppercase text-on-surface-variant font-bold mb-4">
                                En esta página
                            </div>
                            <ul className="space-y-2 border-l border-white/5 pl-4 mb-8">
                                {sections.map((h) => (
                                    <li key={h.id}>
                                        <a
                                            href={`#${h.id}`}
                                            className="text-xs text-on-surface-variant hover:text-primary transition-colors block leading-snug"
                                        >
                                            {h.text}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}

                    <Link
                        href="/docs"
                        className="text-primary text-[10px] font-bold tracking-widest uppercase inline-flex items-center gap-1 hover:gap-2 transition-all"
                    >
                        <span className="material-symbols-outlined text-sm">arrow_back</span>
                        Toda la documentación
                    </Link>
                </aside>
            </div>
        </div>
    );
}
