/**
 * Pie de contacto por departamento — se inyecta al final de cada pagina
 * sectorial. Un componente + una linea de JSX evita que 8 paginas dupliquen
 * el mismo bloque de correo con estilos ligeramente distintos.
 */
import DepartmentContact from './DepartmentContact';
import { getDepartment, type DepartmentKey } from '@/lib/contact-emails';

type Props = {
    department: DepartmentKey;
    /** Titulo del bloque; por defecto se genera con el nombre del departamento. */
    heading?: string;
    /** Asunto sugerido para el mailto. */
    subject?: string;
    /** Texto arriba del titulo. */
    eyebrow?: string;
};

export default function SectorContactFooter({
    department,
    heading,
    subject,
    eyebrow = 'Buzon del departamento',
}: Props) {
    const contact = getDepartment(department);

    return (
        <section className="mt-16 rounded-2xl border border-white/10 bg-gradient-to-br from-[#071022] to-[#050711] p-6 md:p-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-300">
                        {eyebrow}
                    </p>
                    <h2 className="mt-3 text-3xl font-black uppercase italic text-white md:text-4xl">
                        {heading ?? `Contacto directo con ${contact.label.toLowerCase()}`}
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
                        {contact.role} Escribes al buzon del departamento y responde el equipo asignado —
                        sin filtros, sin recepcion generica.
                    </p>
                </div>
                <DepartmentContact
                    contact={contact}
                    subject={subject ?? `BeZhas — ${contact.label}`}
                />
            </div>
        </section>
    );
}
