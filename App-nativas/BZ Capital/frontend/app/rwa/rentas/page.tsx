'use client';

/**
 * RWA · Rentas — reparto y cobro de rentas de activos tokenizados.
 *
 *  · Titular: elige un activo, ve sus repartos con lo que le toca y cobra.
 *  · Emisor:  ve sus activos, calcula un reparto (quién cobra qué, comisión, raíz),
 *             descarga el justificante y firma el depósito.
 *
 * La API sólo devuelve transacciones sin firmar; las firma la wallet del navegador
 * (Polygon) y exigimos que sea la de la sesión, porque es la única en cuyo nombre
 * el Gateway prepara nada. Mientras RWARentDistributor no esté desplegado y
 * configurado en la API, ésta responde DISTRIBUTOR_NOT_DEPLOYED y la pantalla lo dice.
 */
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { AlertCircle, CheckCircle, Download, ExternalLink, Loader2 } from 'lucide-react';
import { sessionAddress } from '@/lib/api';
import { LockScreen, useAuth } from '@/components/SSOProvider';
import {
    activosDeCreador, descargarJustificante, firmarConWallet, leerActivo, mensajeDeError, prepararReclamo,
    prepararReparto, repartosDeActivo, urlTx,
    type Activo, type CuerpoReparto, type Fabrica, type Progreso, type PropuestaReparto, type Reparto,
} from '@/lib/rwaRent';

const FABRICAS: { id: Fabrica; nombre: string }[] = [
    { id: 'activos', nombre: 'Activos' },
    { id: 'industrial', nombre: 'Industrial' },
];

const INPUT = 'mt-1 block w-full rounded-lg bg-[#0b1020] border border-bez-border px-3 py-2 text-white';

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

function Aviso({ tipo = 'info', children }: { tipo?: 'info' | 'error' | 'ok'; children: ReactNode }) {
    const color = tipo === 'error' ? 'border-red-500/40 bg-red-500/10 text-red-200'
        : tipo === 'ok' ? 'border-green-500/40 bg-green-500/10 text-green-200'
            : 'border-amber-500/40 bg-amber-500/10 text-amber-100';
    const Icono = tipo === 'ok' ? CheckCircle : AlertCircle;
    return (
        <div role={tipo === 'error' ? 'alert' : 'status'} className={`flex gap-2 rounded-lg border p-3 text-sm ${color}`}>
            <Icono className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>{children}</div>
        </div>
    );
}

function Pasos({ pasos }: { pasos: Progreso[] }) {
    if (!pasos.length) return null;
    return (
        <ol className="space-y-1 text-sm" aria-label="Progreso de la firma">
            {pasos.map((p) => (
                <li key={p.paso} className="flex items-center gap-2 text-slate-300">
                    {p.estado === 'hecho'
                        ? <CheckCircle className="h-4 w-4 text-green-400" aria-hidden="true" />
                        : <Loader2 className="h-4 w-4 animate-spin text-amber-400" aria-hidden="true" />}
                    <span>
                        Paso {p.paso}/{p.total}: {p.estado === 'firmando' ? 'firma en tu wallet' : p.estado === 'confirmando' ? 'confirmando en Polygon' : 'hecho'}
                    </span>
                    {p.hash && (
                        <a className="inline-flex items-center gap-1 text-amber-400 hover:underline" href={urlTx(p.hash)} target="_blank" rel="noopener noreferrer">
                            ver <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                    )}
                </li>
            ))}
        </ol>
    );
}

/** Firma con la wallet exigiendo la cuenta de la sesión, con progreso y un único estado «ocupado». */
function useFirma(cuenta: string) {
    const [pasos, setPasos] = useState<Progreso[]>([]);
    const [ocupado, setOcupado] = useState(false);

    const firmar = useCallback(async (transacciones: Parameters<typeof firmarConWallet>[0]) => {
        setOcupado(true);
        setPasos([]);
        try {
            return await firmarConWallet(transacciones, cuenta, (e) =>
                setPasos((prev) => [...prev.filter((p) => p.paso !== e.paso), e].sort((a, b) => a.paso - b.paso)));
        } finally {
            setOcupado(false);
        }
    }, [cuenta]);

    return { firmar, pasos, ocupado };
}

// ── Titular ──────────────────────────────────────────────────────────────────

function Titular({ cuenta }: { cuenta: string }) {
    const [fabrica, setFabrica] = useState<Fabrica>('activos');
    const [assetId, setAssetId] = useState('');
    const [repartos, setRepartos] = useState<Reparto[] | null>(null);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');
    const [cobrado, setCobrado] = useState('');
    const { firmar, pasos, ocupado } = useFirma(cuenta);

    const buscar = useCallback(async (e?: FormEvent) => {
        e?.preventDefault();
        if (!/^\d+$/.test(assetId) || Number(assetId) < 1) { setError('Escribe el número del activo.'); return; }
        setCargando(true);
        setError('');
        setRepartos(null);
        try {
            setRepartos((await repartosDeActivo(fabrica, assetId, cuenta)).repartos);
        } catch (err) {
            setError(mensajeDeError(err));
        } finally {
            setCargando(false);
        }
    }, [assetId, fabrica, cuenta]);

    const cobrar = async (reparto: Reparto) => {
        setError('');
        setCobrado('');
        try {
            const prep = await prepararReclamo({ fabrica, distributionId: Number(reparto.distributionId), cuenta });
            await firmar(prep.transacciones);
            setCobrado(`Cobrado: ${prep.cobro.importe} ${prep.cobro.token}`);
            await buscar();
        } catch (err) {
            setError(mensajeDeError(err));
        }
    };

    return (
        <section aria-labelledby="titulo-titular" className="space-y-4">
            <h2 id="titulo-titular" className="text-lg font-semibold text-white">Cobrar mis rentas</h2>
            <p className="text-sm text-slate-400">
                Si tienes fracciones de un activo, aquí ves los repartos de rentas en los que participas. El dinero llega siempre a la wallet de tu sesión.
            </p>
            <form onSubmit={buscar} className="flex flex-wrap items-end gap-3">
                <label className="text-sm text-slate-300">
                    Fábrica
                    <select value={fabrica} onChange={(e) => setFabrica(e.target.value as Fabrica)} className={INPUT}>
                        {FABRICAS.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                    </select>
                </label>
                <label className="text-sm text-slate-300">
                    Nº de activo
                    <input inputMode="numeric" value={assetId} onChange={(e) => setAssetId(e.target.value.trim())} placeholder="3" className={`${INPUT} w-32`} />
                </label>
                <button type="submit" disabled={cargando || ocupado} className="btn-primary disabled:opacity-50">
                    {cargando ? 'Buscando…' : 'Ver repartos'}
                </button>
            </form>

            {error && <Aviso tipo="error">{error}</Aviso>}
            {cobrado && <Aviso tipo="ok">{cobrado}</Aviso>}
            <Pasos pasos={pasos} />

            {repartos && repartos.length === 0 && <Aviso>Este activo todavía no tiene repartos de rentas.</Aviso>}
            {repartos && repartos.length > 0 && (
                <ul className="space-y-3">
                    {repartos.map((r) => {
                        const puedeCobrar = r.abierto && !r.yaCobrado && !!r.miParte;
                        return (
                            <li key={r.distributionId} className="card">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <div className="font-medium text-white">Reparto #{r.distributionId} · {r.importe} {r.token}</div>
                                        <div className="text-xs text-slate-400">
                                            {r.abierto ? `Se puede cobrar hasta el ${fecha(r.plazoReclamo)}` : `Cerrado el ${fecha(r.plazoReclamo)}`}
                                            {r.detallesCID && <> · <span title={r.detallesCID}>con justificante</span></>}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {r.yaCobrado && <span className="text-sm text-green-400">Ya cobrado</span>}
                                        {!r.yaCobrado && r.miParte && <div className="text-lg font-semibold text-amber-400">{r.miParte} {r.token}{r.miParteUsd && <span className="block text-xs font-normal text-slate-400">≈ ${r.miParteUsd}</span>}</div>}
                                        {!r.yaCobrado && !r.miParte && r.abierto && (
                                            <span className="text-sm text-slate-400">
                                                {r.motivoSinParte === 'NO_SHARE' ? 'No tenías fracciones en el corte'
                                                    : r.motivoSinParte ? 'No se puede calcular tu parte desde aquí' : '—'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {puedeCobrar && (
                                    <button type="button" onClick={() => cobrar(r)} disabled={ocupado} className="btn-primary mt-3 disabled:opacity-50">
                                        {ocupado ? 'Firmando…' : `Cobrar ${r.miParte} ${r.token}`}
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}

// ── Emisor ───────────────────────────────────────────────────────────────────

function Emisor({ cuenta }: { cuenta: string }) {
    const [fabrica, setFabrica] = useState<Fabrica>('activos');
    const [activos, setActivos] = useState<Activo[] | null>(null);
    const [elegido, setElegido] = useState<Activo | null>(null);
    const [repartos, setRepartos] = useState<Reparto[]>([]);
    const [form, setForm] = useState({ token: 'usdc', importe: '', plazoDias: '90', detallesCID: '' });
    const [propuesta, setPropuesta] = useState<PropuestaReparto | null>(null);
    const [calculando, setCalculando] = useState(false);
    const [error, setError] = useState('');
    const [hecho, setHecho] = useState(false);
    const { firmar, pasos, ocupado } = useFirma(cuenta);

    // Mis activos: ids del creador y ficha de cada uno.
    useEffect(() => {
        let vivo = true;
        setActivos(null);
        setElegido(null);
        setPropuesta(null);
        setError('');
        (async () => {
            try {
                const { assetIds } = await activosDeCreador(fabrica, cuenta);
                const fichas = await Promise.all(assetIds.map((id) => leerActivo(fabrica, id)));
                if (vivo) setActivos(fichas);
            } catch (err) {
                if (vivo) { setActivos([]); setError(mensajeDeError(err)); }
            }
        })();
        return () => { vivo = false; };
    }, [fabrica, cuenta]);

    useEffect(() => {
        if (!elegido) { setRepartos([]); return undefined; }
        let vivo = true;
        repartosDeActivo(fabrica, elegido.assetId)
            .then((r) => { if (vivo) setRepartos(r.repartos); })
            .catch(() => { if (vivo) setRepartos([]); }); // el historial es accesorio: no tapa el formulario
        return () => { vivo = false; };
    }, [elegido, fabrica, hecho]);

    const cambiar = (campo: keyof typeof form) => (e: { target: { value: string } }) => {
        setForm((f) => ({ ...f, [campo]: e.target.value }));
        setPropuesta(null); // cualquier cambio invalida el cálculo anterior
        setHecho(false);
    };

    const calcular = async (e: FormEvent) => {
        e.preventDefault();
        if (!elegido) return;
        setCalculando(true);
        setError('');
        setPropuesta(null);
        setHecho(false);
        try {
            const cuerpo: CuerpoReparto = {
                fabrica, assetId: Number(elegido.assetId), emisor: cuenta, token: form.token,
                importe: form.importe.trim(), plazoDias: Number(form.plazoDias),
            };
            if (form.detallesCID.trim()) cuerpo.detallesCID = form.detallesCID.trim();
            setPropuesta(await prepararReparto(cuerpo));
        } catch (err) {
            setError(mensajeDeError(err));
        } finally {
            setCalculando(false);
        }
    };

    const depositar = async () => {
        if (!propuesta) return;
        setError('');
        try {
            await firmar(propuesta.transacciones);
            setHecho(true);
            setPropuesta(null);
        } catch (err) {
            setError(mensajeDeError(err));
        }
    };

    const r = propuesta?.reparto;
    return (
        <section aria-labelledby="titulo-emisor" className="space-y-4">
            <h2 id="titulo-emisor" className="text-lg font-semibold text-white">Repartir rentas de mis activos</h2>
            <p className="text-sm text-slate-400">
                Depositas las rentas (alquileres, cupones…) y cada titular cobra a prorrata de sus fracciones en el bloque de corte.
                Las fracciones que conservas tú no cobran.
            </p>
            <label className="block text-sm text-slate-300">
                Fábrica
                <select value={fabrica} onChange={(e) => setFabrica(e.target.value as Fabrica)} className={`${INPUT} w-auto`}>
                    {FABRICAS.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                </select>
            </label>

            {activos === null && <div className="flex items-center gap-2 text-slate-400"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Cargando tus activos…</div>}
            {activos && activos.length === 0 && !error && <Aviso>Esta wallet no ha creado ningún activo en esta fábrica.</Aviso>}
            {activos && activos.length > 0 && (
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Activo a repartir">
                    {activos.map((a) => (
                        <button key={a.assetId} type="button" role="radio" aria-checked={elegido?.assetId === a.assetId}
                            onClick={() => { setElegido(a); setPropuesta(null); setHecho(false); setError(''); }}
                            className={`rounded-lg border px-3 py-2 text-left text-sm ${elegido?.assetId === a.assetId ? 'border-amber-500 bg-amber-500/10 text-white' : 'border-bez-border text-slate-300 hover:border-slate-500'}`}>
                            <div className="font-medium">#{a.assetId} · {a.nombre}</div>
                            <div className="text-xs text-slate-400">{a.fracciones} fracciones{a.activo ? '' : ' · desactivado'}</div>
                        </button>
                    ))}
                </div>
            )}

            {error && <Aviso tipo="error">{error}</Aviso>}
            {hecho && <Aviso tipo="ok">Reparto creado. Los titulares lo verán en «Cobrar mis rentas».</Aviso>}

            {elegido && (
                <>
                    <form onSubmit={calcular} className="grid gap-3 sm:grid-cols-2">
                        <label className="text-sm text-slate-300">
                            Se paga en
                            <select value={form.token} onChange={cambiar('token')} className={INPUT}>
                                <option value="usdc">USDC</option>
                                <option value="bez">BEZ</option>
                            </select>
                        </label>
                        <label className="text-sm text-slate-300">
                            Importe a repartir
                            <input required inputMode="decimal" value={form.importe} onChange={cambiar('importe')} placeholder="900" className={INPUT} />
                        </label>
                        <label className="text-sm text-slate-300">
                            Días para reclamar (31–365)
                            <input type="number" min={31} max={365} value={form.plazoDias} onChange={cambiar('plazoDias')} className={INPUT} />
                        </label>
                        <label className="text-sm text-slate-300">
                            CID del justificante (opcional)
                            <input value={form.detallesCID} onChange={cambiar('detallesCID')} placeholder="Qm…" className={INPUT} />
                        </label>
                        <div className="sm:col-span-2">
                            <button type="submit" disabled={calculando || ocupado} className="btn-primary disabled:opacity-50">
                                {calculando ? 'Calculando desde Polygon…' : 'Calcular reparto'}
                            </button>
                        </div>
                    </form>

                    {propuesta && r && (
                        <div className="card space-y-3 !border-amber-500/40">
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                                <div><dt className="text-slate-400">Titulares que cobran</dt><dd className="text-white">{r.titulares}</dd></div>
                                <div><dt className="text-slate-400">A repartir</dt><dd className="text-white">{r.importe} {r.token}{r.importeUsd && <span className="block text-xs text-slate-400">≈ ${r.importeUsd}</span>}</dd></div>
                                <div><dt className="text-slate-400">Comisión BeZhas</dt><dd className="text-white">{r.comision} {r.token}</dd></div>
                                <div><dt className="text-slate-400">Pagas en total</dt><dd className="font-semibold text-amber-400">{r.totalAPagar} {r.token}{r.totalAPagarUsd && <span className="block text-xs font-normal text-slate-400">≈ ${r.totalAPagarUsd}</span>}</dd></div>
                                <div><dt className="text-slate-400">Sin asignar (redondeo)</dt><dd className="text-white">{r.restoSinAsignar} {r.token}</dd></div>
                                <div><dt className="text-slate-400">Bloque de corte</dt><dd className="text-white">{r.bloqueDeCorte}</dd></div>
                            </dl>
                            <p className="text-xs text-slate-400">Plazo de reclamo hasta el {fecha(r.plazoReclamo)}. Lo que nadie reclame lo recuperas tú después.</p>
                            {propuesta.aviso && <Aviso>{propuesta.aviso}</Aviso>}
                            <div className="flex flex-wrap gap-3">
                                <button type="button" onClick={() => descargarJustificante(propuesta.justificante, `justificante-activo-${elegido.assetId}.json`)}
                                    className="btn-secondary inline-flex items-center gap-2">
                                    <Download className="h-4 w-4" aria-hidden="true" /> Descargar justificante
                                </button>
                                <button type="button" onClick={depositar} disabled={ocupado} className="btn-primary disabled:opacity-50">
                                    {ocupado ? 'Firmando…' : `Firmar y depositar ${r.totalAPagar} ${r.token}`}
                                </button>
                            </div>
                            <Pasos pasos={pasos} />
                        </div>
                    )}

                    {repartos.length > 0 && (
                        <div>
                            <h3 className="mb-2 text-sm font-medium text-slate-300">Repartos anteriores</h3>
                            <ul className="space-y-1 text-sm text-slate-300">
                                {repartos.map((x) => (
                                    <li key={x.distributionId}>
                                        #{x.distributionId} · {x.importe} {x.token} · sin reclamar {x.sinReclamar} · {x.abierto ? `abierto hasta ${fecha(x.plazoReclamo)}` : 'cerrado'}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}

// ── Página ───────────────────────────────────────────────────────────────────

export default function RwaRentasPage() {
    const auth = useAuth();
    const [tab, setTab] = useState<'titular' | 'emisor'>('titular');
    // La sesión vive en localStorage: se lee tras montar para no desajustar la hidratación.
    const [cuenta, setCuenta] = useState<string | null | undefined>(undefined);
    useEffect(() => { setCuenta(sessionAddress()); }, [auth?.token]);

    if (cuenta === undefined) return null;
    if (!auth?.token || !cuenta) return <LockScreen title="Inicia sesión para ver tus rentas" />;

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white">RWA · Rentas</h1>
                <p className="mt-1 text-slate-400">Reparto y cobro de rentas de activos del mundo real tokenizados.</p>
            </div>

            <div role="tablist" aria-label="Rol" className="flex gap-2 border-b border-bez-border">
                {([['titular', 'Soy titular'], ['emisor', 'Soy emisor']] as const).map(([id, nombre]) => (
                    <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                        className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === id ? 'border-amber-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
                        {nombre}
                    </button>
                ))}
            </div>
            {tab === 'titular' ? <Titular cuenta={cuenta} /> : <Emisor cuenta={cuenta} />}
        </div>
    );
}
