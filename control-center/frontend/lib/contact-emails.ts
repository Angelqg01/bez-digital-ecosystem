/**
 * lib/contact-emails.ts — directorio unico de correos departamentales.
 *
 * Fuente de verdad: cinco buzones publicados en la landing y en cada pagina de
 * departamento. Cada agente / bot del ecosistema tiene su buzon asignado para
 * que el enrutamiento sea inequivoco (evita reboto entre departamentos y
 * respeta el reparto de responsabilidades que espera el visitante).
 *
 * Si un buzon cambia, se cambia AQUI. Los componentes leen esta constante; asi
 * no queda ninguna direccion pegada a mano en un JSX.
 */

export type DepartmentKey =
    | 'ventas'
    | 'facturacion'
    | 'soporte'
    | 'infraestructura'
    | 'marketing';

export type DepartmentContact = {
    key: DepartmentKey;
    label: string;
    email: string;
    /** Icono Material Symbols; se mapea 1:1 en los componentes. */
    icon: string;
    /** Que trata este buzon, para el subtitulo bajo el correo. */
    role: string;
    /** Agentes / bots que responden desde este buzon. */
    agents: string[];
};

export const DEPARTMENT_CONTACTS: DepartmentContact[] = [
    {
        key: 'ventas',
        label: 'Ventas',
        email: 'ventas@bezhas.com',
        icon: 'handshake',
        role: 'Pilotos, partnerships y propuesta comercial.',
        agents: ['OutreachAgent', 'FollowUpAgent', 'ProposalGeneratorAgent'],
    },
    {
        key: 'facturacion',
        label: 'Facturacion',
        email: 'facturacion@bezhas.com',
        icon: 'receipt_long',
        role: 'Finanzas, cobros, disputas de factura y conciliacion.',
        agents: ['Finanzas', 'InvoiceBot', 'InvoiceAgent'],
    },
    {
        key: 'soporte',
        label: 'Soporte',
        email: 'support@bezhas.com',
        icon: 'support_agent',
        role: 'Incidencias operativas y resolucion de tickets.',
        agents: ['SupportManager', 'ResolverAgent'],
    },
    {
        key: 'infraestructura',
        label: 'Infraestructura',
        email: 'infrastructure@bezhas.com',
        icon: 'dns',
        role: 'Operaciones on-chain, red, validadores y cumplimiento.',
        agents: ['BlockchainOpsManager', 'ComplianceCheckAgent'],
    },
    {
        key: 'marketing',
        label: 'Marketing',
        email: 'marketing@bezhas.com',
        icon: 'campaign',
        role: 'Campañas, prensa, calendario editorial y contenido.',
        agents: ['CampaignAnalystAgent', 'SocialSchedulerAgent'],
    },
];

/** Recupera el contacto de un departamento; nunca devuelve undefined. */
export function getDepartment(key: DepartmentKey): DepartmentContact {
    const found = DEPARTMENT_CONTACTS.find((d) => d.key === key);
    if (!found) throw new Error(`Departamento desconocido: ${key}`);
    return found;
}

/**
 * Crea el href mailto con asunto listo — encodeURIComponent siempre, no vale
 * concatenar texto libre a un mailto: el navegador rompe el encabezado ante
 * un & o un espacio y se pierde la referencia del origen.
 */
export function mailtoHref(email: string, subject?: string): string {
    if (!subject) return `mailto:${email}`;
    return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}
