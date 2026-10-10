/**
 * Tarjeta compacta con el buzon del departamento.
 *
 * Se usa en la home y como bloque de cabecera / pie en cada pagina sectorial.
 * Un solo componente evita que diez paginas mantengan diez versiones distintas
 * de la misma pieza de UI.
 */
import type { DepartmentContact as DepartmentContactType } from '@/lib/contact-emails';
import { mailtoHref } from '@/lib/contact-emails';

type Props = {
    contact: DepartmentContactType;
    /** Asunto sugerido; si se omite, el buzon abre sin subject. */
    subject?: string;
    /** Compact = una linea con boton; Card = tarjeta con detalle y agentes. */
    variant?: 'compact' | 'card';
    className?: string;
};

export default function DepartmentContact({
    contact,
    subject,
    variant = 'card',
    className = '',
}: Props) {
    const href = mailtoHref(contact.email, subject);

    if (variant === 'compact') {
        return (
            <a
                href={href}
                className={`inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-200 transition hover:border-emerald-300/60 hover:bg-emerald-400/15 ${className}`}
            >
                <span className="material-symbols-outlined text-[16px]">{contact.icon}</span>
                {contact.label} · {contact.email}
                <span className="material-symbols-outlined text-[14px]">arrow_outward</span>
            </a>
        );
    }

    return (
        <a
            href={href}
            className={`group flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-emerald-300/40 hover:bg-white/[0.06] ${className}`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300">
                    <span className="material-symbols-outlined">{contact.icon}</span>
                </div>
                <span className="material-symbols-outlined text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-300">
                    arrow_outward
                </span>
            </div>
            <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">
                    {contact.label}
                </p>
                <h3 className="mt-1 font-mono text-sm font-bold text-white">{contact.email}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-400">{contact.role}</p>
            </div>
            <div className="mt-auto flex flex-wrap gap-1.5 border-t border-white/5 pt-3">
                {contact.agents.map((a) => (
                    <span
                        key={a}
                        className="rounded-full border border-slate-700 bg-slate-900/40 px-2 py-0.5 font-mono text-[10px] text-slate-400"
                    >
                        {a}
                    </span>
                ))}
            </div>
        </a>
    );
}
