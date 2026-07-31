import Link from 'next/link';

const SECTIONS = [
    {
        id: 'responsable',
        title: 'Responsable del tratamiento',
        icon: 'gavel',
        body: (
            <>
                <p>
                    BeZhas (<a className="text-primary" href="https://bez.digital/">bez.digital</a>) es el responsable del tratamiento de los datos
                    personales recogidos a través de la Plataforma (dashboard principal, API y las SubApps sectoriales: BZ CargoLink, BZ PureScan,
                    BZ Genesis, BZ Sphere, bez-energy, entre otras).
                </p>
                <p className="mt-3">
                    Para cualquier consulta sobre privacidad o para ejercer tus derechos, escribe a{' '}
                    <a className="text-primary" href="mailto:privacy@bez.digital">privacy@bez.digital</a>.
                </p>
            </>
        ),
    },
    {
        id: 'datos',
        title: 'Qué datos recogemos',
        icon: 'database',
        body: (
            <>
                <table className="w-full text-sm text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/10 text-on-surface-variant uppercase text-[10px] tracking-widest">
                            <th className="py-2 pr-4">Dato</th>
                            <th className="py-2 pr-4">Finalidad</th>
                            <th className="py-2 pr-4">Base legal</th>
                            <th className="py-2">Conservación</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-on-surface-variant">
                        <tr>
                            <td className="py-3 pr-4 text-white">Dirección de wallet (Ethereum/Polygon)</td>
                            <td className="py-3 pr-4">Autenticación (Sign-In With Ethereum), identificación de cuenta</td>
                            <td className="py-3 pr-4">Ejecución de contrato</td>
                            <td className="py-3">Mientras la cuenta esté activa</td>
                        </tr>
                        <tr>
                            <td className="py-3 pr-4 text-white">Email + contraseña (alta &quot;fiat&quot;)</td>
                            <td className="py-3 pr-4">Alternativa de registro sin wallet propia (wallet gestionada internamente)</td>
                            <td className="py-3 pr-4">Ejecución de contrato</td>
                            <td className="py-3">Mientras la cuenta esté activa</td>
                        </tr>
                        <tr>
                            <td className="py-3 pr-4 text-white">Plan de suscripción y uso de IA/facturación</td>
                            <td className="py-3 pr-4">Gestión de tu plan, facturación, límites de uso</td>
                            <td className="py-3 pr-4">Ejecución de contrato</td>
                            <td className="py-3">Duración de la relación + plazos fiscales</td>
                        </tr>
                        <tr>
                            <td className="py-3 pr-4 text-white">Cámara (BZ CargoLink, BZ PureScan)</td>
                            <td className="py-3 pr-4">Generar huella de integridad (hash) de la carga/producto escaneado</td>
                            <td className="py-3 pr-4">Consentimiento explícito, just-in-time</td>
                            <td className="py-3">La imagen no sale del dispositivo; solo se ancla el hash</td>
                        </tr>
                        <tr>
                            <td className="py-3 pr-4 text-white">Geolocalización (BZ CargoLink)</td>
                            <td className="py-3 pr-4">Verificar el punto de entrega en rutas de última milla</td>
                            <td className="py-3 pr-4">Consentimiento explícito, just-in-time</td>
                            <td className="py-3">Solo en sesión, salvo consentimiento adicional para histórico</td>
                        </tr>
                        <tr>
                            <td className="py-3 pr-4 text-white">Cookies analíticas (Google Analytics)</td>
                            <td className="py-3 pr-4">Medir uso agregado del sitio para mejorarlo</td>
                            <td className="py-3 pr-4">Consentimiento (banner de cookies)</td>
                            <td className="py-3">180 días o hasta que retires el consentimiento</td>
                        </tr>
                        <tr>
                            <td className="py-3 pr-4 text-white">Cookies técnicas necesarias</td>
                            <td className="py-3 pr-4">Sesión, seguridad, preferencias básicas</td>
                            <td className="py-3 pr-4">Interés legítimo (funcionamiento del sitio)</td>
                            <td className="py-3">Duración de la sesión o según finalidad técnica</td>
                        </tr>
                    </tbody>
                </table>
            </>
        ),
    },
    {
        id: 'permisos',
        title: 'Permisos de cámara y ubicación en las SubApps',
        icon: 'security',
        body: (
            <>
                <p>
                    Algunas SubApps piden permisos del navegador (cámara, ubicación) para funciones concretas. Seguimos estas reglas en todas ellas:
                </p>
                <ul className="mt-3 space-y-2 list-none">
                    <li className="flex gap-3"><span className="material-symbols-outlined text-primary text-lg">check_circle</span><span><strong className="text-white">Solo cuando hace falta:</strong> el permiso nunca se pide al abrir la app, solo cuando activas la función concreta que lo necesita.</span></li>
                    <li className="flex gap-3"><span className="material-symbols-outlined text-primary text-lg">check_circle</span><span><strong className="text-white">Explicación previa:</strong> antes de que tu navegador te pregunte, te mostramos qué se va a usar, para qué y qué pasa con el dato.</span></li>
                    <li className="flex gap-3"><span className="material-symbols-outlined text-primary text-lg">check_circle</span><span><strong className="text-white">Ligado a tu plan:</strong> las funciones que usan cámara o ubicación están disponibles en los planes Profesional y Enterprise. Si tu cuenta no tiene un plan admitido, no te pedimos el permiso en absoluto.</span></li>
                    <li className="flex gap-3"><span className="material-symbols-outlined text-primary text-lg">check_circle</span><span><strong className="text-white">Sin insistencia:</strong> si rechazas el permiso, no lo volvemos a pedir automáticamente; puedes reactivarlo tú desde los ajustes del navegador cuando quieras.</span></li>
                </ul>
            </>
        ),
    },
    {
        id: 'onchain',
        title: 'Datos anclados en blockchain (importante)',
        icon: 'link',
        body: (
            <>
                <p>
                    Una parte de la actividad de la Plataforma (hashes de integridad, eventos de validación, transacciones de BEZ-Coin) se ancla en
                    la capa 2 de BeZhas y, por diseño, es <strong className="text-white">pública e inmutable</strong>. Esto significa que:
                </p>
                <ul className="mt-3 space-y-2 list-disc list-inside text-on-surface-variant">
                    <li>Nunca anclamos datos personales identificables directamente (nombre, email, imagen) — solo hashes criptográficos y direcciones de wallet.</li>
                    <li>El derecho de supresión (&quot;derecho al olvido&quot;) no puede aplicarse a un dato ya anclado on-chain, por la propia naturaleza de la tecnología. Si ejerces este derecho, eliminamos los datos personales asociados en nuestras bases de datos off-chain; el hash on-chain permanece, pero no es identificable sin esa información asociada.</li>
                    <li>La dirección de tu wallet es pseudónima, no anónima: es pública en la propia blockchain independientemente de BeZhas.</li>
                </ul>
            </>
        ),
    },
    {
        id: 'derechos',
        title: 'Tus derechos (RGPD)',
        icon: 'balance',
        body: (
            <>
                <p>Puedes ejercer en cualquier momento, escribiendo a <a className="text-primary" href="mailto:privacy@bez.digital">privacy@bez.digital</a>:</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                    {['Acceso', 'Rectificación', 'Supresión', 'Portabilidad', 'Oposición', 'Limitación'].map((r) => (
                        <div key={r} className="glass-panel border border-white/5 rounded-lg px-4 py-3 text-sm font-bold text-white">{r}</div>
                    ))}
                </div>
                <p className="mt-4 text-sm">
                    También tienes derecho a presentar una reclamación ante tu autoridad de protección de datos (en España, la AEPD).
                </p>
            </>
        ),
    },
    {
        id: 'cookies',
        title: 'Cookies',
        icon: 'cookie',
        body: (
            <p>
                Usamos cookies técnicas necesarias para el funcionamiento del sitio, y —solo con tu consentimiento— cookies de analítica. Puedes
                cambiar tu decisión cuando quieras desde el aviso de cookies que aparece la primera vez que visitas el sitio, o borrando las cookies
                de tu navegador para que vuelva a aparecer.
            </p>
        ),
    },
];

export default function PrivacyPage() {
    return (
        <div className="max-w-4xl mx-auto px-8 py-12">
            <section className="mb-12">
                <div className="flex items-center gap-2 mb-4">
                    <span className="h-2 w-2 bg-tertiary rounded-full animate-pulse"></span>
                    <span className="text-[10px] tracking-[0.4em] uppercase text-tertiary font-bold">Última actualización: 2026-07-20</span>
                </div>
                <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter uppercase mb-6 leading-none">
                    Política de <span className="text-primary">Privacidad</span>
                </h1>
                <p className="text-lg text-on-surface-variant max-w-2xl font-light leading-relaxed">
                    Cómo BeZhas recoge, usa y protege tus datos en la plataforma y en sus SubApps, conforme al Reglamento General de Protección
                    de Datos (RGPD/GDPR) de la Unión Europea.
                </p>
            </section>

            <nav className="mb-12 flex flex-wrap gap-2">
                {SECTIONS.map((s) => (
                    <a key={s.id} href={`#${s.id}`} className="text-[11px] uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors px-3 py-2 rounded-lg border border-white/5 hover:border-primary/30">
                        {s.title}
                    </a>
                ))}
            </nav>

            <div className="space-y-10">
                {SECTIONS.map((s) => (
                    <section key={s.id} id={s.id} className="glass-panel border border-white/5 rounded-xl p-6 md:p-8 scroll-mt-24">
                        <div className="flex items-center gap-3 mb-5">
                            <span className="material-symbols-outlined text-primary text-2xl">{s.icon}</span>
                            <h2 className="text-2xl font-black italic tracking-tight uppercase">{s.title}</h2>
                        </div>
                        <div className="text-on-surface-variant leading-relaxed">{s.body}</div>
                    </section>
                ))}
            </div>

            <div className="mt-12 glass-panel border border-amber-500/20 rounded-xl p-6 flex gap-4">
                <span className="material-symbols-outlined text-amber-400 text-2xl flex-shrink-0">info</span>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                    <strong className="text-white">Aviso:</strong> este documento describe el tratamiento de datos tal como está implementado
                    técnicamente hoy en la Plataforma. No sustituye asesoría legal — su redacción final para producción debe ser validada por
                    un profesional del derecho, especialmente en lo relativo a transferencias internacionales, plazos fiscales y normativa
                    sectorial específica de cada mercado.
                </p>
            </div>

            <div className="mt-10 text-center">
                <Link href="/support" className="text-primary text-xs font-bold tracking-widest uppercase inline-flex items-center gap-2 hover:gap-3 transition-all">
                    ¿Dudas sobre privacidad? Contacta con soporte <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </Link>
            </div>
        </div>
    );
}
