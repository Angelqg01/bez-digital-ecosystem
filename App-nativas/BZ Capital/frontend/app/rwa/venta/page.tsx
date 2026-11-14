'use client';

/**
 * RWA · Fracciones — venta primaria de fracciones de activos tokenizados, pagada
 * en BEZ y sin custodia.
 *
 *  · Comprar: consulta una oferta por su número y compra N fracciones (aprobar BEZ + comprar).
 *  · Vender (emisor): ofrece fracciones de un activo propio a un precio en BEZ
 *    (autorizar al contrato de venta + publicar la oferta). Las fracciones no salen
 *    de su wallet hasta que alguien compra.
 *
 * La API sólo devuelve transacciones sin firmar; las firma la wallet del navegador
 * (Polygon) y exigimos que sea la de la sesión, la única en cuyo nombre el Gateway
 * prepara nada.
 */
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { AlertCircle, CheckCircle, ExternalLink, Loader2 } from 'lucide-react';
import { sessionAddress } from '@/lib/api';
import { LockScreen, useAuth } from '@/components/SSOProvider';
import {
    activosDeCreador, firmarConWallet, idDeOfertaDeRecibo, leerActivo, leerOferta, mensajeDeError, prepararCompra,
    prepararOferta, urlTx,
    type Activo, type Fabrica, type Oferta, type Progreso, type PropuestaOferta, type Recibo,
} from '@/lib/rwaRent';

const FABRICAS: { id: Fabrica; nombre: string }[] = [
    { id: 'activos', nombre: 'Activos' },
    { id: 'industrial', nombre: 'Industrial' },
];
const INPUT = 'mt-1 block w-full rounded-lg bg-[#0b1020] border border-bez-border px-3 py-2 text-white';

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
                    <span>Paso {p.paso}/{p.total}: {p.estado === 'firmando' ? 'firma en tu wallet' : p.estado === 'confirmando' ? 'confirmando en Polygon' : 'hecho'}</span>
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

/** Firma con la wallet exigiendo la cuenta de la sesión; devuelve también los recibos por paso. */
function useFirma(cuenta: string) {
    const [pasos, setPasos] = useState<Progreso[]>([]);
    const [ocupado, setOcupado] = useState(false);

    const firmar = useCallback(async (transacciones: Parameters<typeof firmarConWallet>[0]) => {
        setOcupado(true);
        setPasos([]);
        const recibos: Record<number, Recibo> = {};
        try {
            const hashes = await firmarConWallet(transacciones, cuenta, (e) => {
                if (e.recibo) recibos[e.paso] = e.recibo;
                const { recibo: _omitido, ...resto } = e;
                setPasos((prev) => [...prev.filter((p) => p.paso !== e.paso), resto].sort((a, b) => a.paso - b.paso));
            });
            return { hashes, recibos };
        } finally {
            setOcupado(false);
        }
    }, [cuenta]);

    return { firmar, pasos, ocupado };
}

// ── Comprar ──────────────────────────────────────────────────────────────────

function Comprar({ cuenta }: { cuenta: string }) {
    const [fabrica, setFabrica] = useState<Fabrica>('activos');
    const [listingId, setListingId] = useState('');
    const [oferta, setOferta] = useState<Oferta | null>(null);
    const [cantidad, setCantidad] = useState('1');
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');
    const [hecho, setHecho] = useState('');
    const { firmar, pasos, ocupado } = useFirma(cuenta);

    const buscar = async (e?: FormEvent) => {
        e?.preventDefault();
        if (!/^\d+$/.test(listingId) || Number(listingId) < 1) { setError('Escribe el número de la oferta.'); return; }
        setCargando(true);
        setError('');
        setHecho('');
        setOferta(null);
        try {
            setOferta(await leerOferta(fabrica, listingId));
        } catch (err) {
            setError(mensajeDeError(err));
        } finally {
            setCargando(false);
        }
    };

    const n = /^\d+$/.test(cantidad) ? Number(cantidad) : 0;
    const total = oferta && n ? Number(oferta.precioFraccionBez) * n : 0;
    const puedeComprar = !!oferta?.abierta && n >= 1 && n <= Number(oferta.disponibles);

    const comprar = async () => {
        setError('');
        setHecho('');
        try {
            const prep = await prepararCompra({ fabrica, listingId: Number(listingId), cantidad: n, comprador: cuenta });
            await firmar(prep.transacciones);
            setHecho(`Compradas ${prep.compra.fracciones} fracciones del activo #${prep.compra.assetId} por ${prep.compra.totalBez} BEZ.`);
            setOferta(await leerOferta(fabrica, listingId).catch(() => null));
        } catch (err) {
            setError(mensajeDeError(err));
        }
    };

    return (
        <section aria-labelledby="titulo-comprar" className="space-y-4">
            <h2 id="titulo-comprar" className="text-lg font-semibold text-white">Comprar fracciones</h2>
            <p className="text-sm text-slate-400">
                Pagas en BEZ: el dinero va directo al emisor (menos la comisión) y las fracciones a tu wallet en la misma transacción.
            </p>
            <form onSubmit={buscar} className="flex flex-wrap items-end gap-3">
                <label className="text-sm text-slate-300">
                    Fábrica
                    <select value={fabrica} onChange={(e) => setFabrica(e.target.value as Fabrica)} className={INPUT}>
                        {FABRICAS.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                    </select>
                </label>
                <label className="text-sm text-slate-300">
                    Nº de oferta
                    <input inputMode="numeric" value={listingId} onChange={(e) => { setListingId(e.target.value.trim()); setOferta(null); }} placeholder="1" className={`${INPUT} w-32`} />
                </label>
                <button type="submit" disabled={cargando || ocupado} className="btn-primary disabled:opacity-50">{cargando ? 'Buscando…' : 'Ver oferta'}</button>
            </form>

            {error && <Aviso tipo="error">{error}</Aviso>}
            {hecho && <Aviso tipo="ok">{hecho}</Aviso>}

            {oferta && (
                <div className="card space-y-3">
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                        <div><dt className="text-slate-400">Activo</dt><dd className="text-white">#{oferta.assetId}</dd></div>
                        <div><dt className="text-slate-400">Precio por fracción</dt><dd className="text-white">{oferta.precioFraccionBez} BEZ{oferta.precioFraccionUsd && <span className="block text-xs text-slate-400">≈ ${oferta.precioFraccionUsd}</span>}</dd></div>
                        <div><dt className="text-slate-400">Disponibles</dt><dd className="text-white">{oferta.disponibles}</dd></div>
                        <div><dt className="text-slate-400">Estado</dt><dd className={oferta.abierta ? 'text-green-400' : 'text-slate-400'}>{oferta.abierta ? 'Abierta' : 'Cerrada'}</dd></div>
                    </dl>
                    {oferta.abierta && (
                        <div className="flex flex-wrap items-end gap-3">
                            <label className="text-sm text-slate-300">
                                Fracciones a comprar
                                <input inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value.trim())} className={`${INPUT} w-32`} />
                            </label>
                            <button type="button" onClick={comprar} disabled={!puedeComprar || ocupado} className="btn-primary disabled:opacity-50">
                                {ocupado ? 'Firmando…' : puedeComprar ? `Comprar por ${total} BEZ` : 'Cantidad no válida'}
                            </button>
                        </div>
                    )}
                    <Pasos pasos={pasos} />
                </div>
            )}
        </section>
    );
}

// ── Vender (emisor) ──────────────────────────────────────────────────────────

function Vender({ cuenta }: { cuenta: string }) {
    const [fabrica, setFabrica] = useState<Fabrica>('activos');
    const [activos, setActivos] = useState<Activo[] | null>(null);
    const [elegido, setElegido] = useState<Activo | null>(null);
    const [form, setForm] = useState({ cantidad: '', precio: '' });
    const [propuesta, setPropuesta] = useState<PropuestaOferta | null>(null);
    const [calculando, setCalculando] = useState(false);
    const [error, setError] = useState('');
    const [publicada, setPublicada] = useState<string | null>(null);
    const { firmar, pasos, ocupado } = useFirma(cuenta);

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

    const cambiar = (campo: keyof typeof form) => (e: { target: { value: string } }) => {
        setForm((f) => ({ ...f, [campo]: e.target.value }));
        setPropuesta(null);
        setPublicada(null);
    };

    const preparar = async (e: FormEvent) => {
        e.preventDefault();
        if (!elegido) return;
        setCalculando(true);
        setError('');
        setPropuesta(null);
        setPublicada(null);
        try {
            setPropuesta(await prepararOferta({
                fabrica, assetId: Number(elegido.assetId), cantidad: Number(form.cantidad),
                precioFraccionBez: form.precio.trim(), vendedor: cuenta,
            }));
        } catch (err) {
            setError(mensajeDeError(err));
        } finally {
            setCalculando(false);
        }
    };

    const publicar = async () => {
        if (!propuesta) return;
        setError('');
        try {
            const { recibos } = await firmar(propuesta.transacciones);
            // El segundo paso es `list`: su recibo trae el evento Listed con el número de la oferta.
            const ultimo = Object.values(recibos).at(-1);
            setPublicada(idDeOfertaDeRecibo(recibos[2] ?? ultimo, propuesta.contratoVenta) ?? '?');
            setPropuesta(null);
        } catch (err) {
            setError(mensajeDeError(err));
        }
    };

    return (
        <section aria-labelledby="titulo-vender" className="space-y-4">
            <h2 id="titulo-vender" className="text-lg font-semibold text-white">Vender fracciones de mis activos</h2>
            <p className="text-sm text-slate-400">
                Autorizas al contrato de venta y publicas la oferta. Tus fracciones no salen de tu wallet hasta que alguien compra.
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
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Activo a vender">
                    {activos.map((a) => (
                        <button key={a.assetId} type="button" role="radio" aria-checked={elegido?.assetId === a.assetId}
                            onClick={() => { setElegido(a); setPropuesta(null); setPublicada(null); setError(''); }}
                            className={`rounded-lg border px-3 py-2 text-left text-sm ${elegido?.assetId === a.assetId ? 'border-amber-500 bg-amber-500/10 text-white' : 'border-bez-border text-slate-300 hover:border-slate-500'}`}>
                            <div className="font-medium">#{a.assetId} · {a.nombre}</div>
                            <div className="text-xs text-slate-400">{a.fracciones} fracciones{a.precioFraccionBez ? ` · ${a.precioFraccionBez} BEZ` : ''}</div>
                        </button>
                    ))}
                </div>
            )}

            {error && <Aviso tipo="error">{error}</Aviso>}
            {publicada && (
                <Aviso tipo="ok">
                    Oferta publicada{publicada !== '?' ? <>: el número de tu oferta es <strong>{publicada}</strong>. Compártelo con los compradores.</> : '. No se pudo leer su número del recibo: búscalo en el evento Listed.'}
                </Aviso>
            )}

            {elegido && (
                <>
                    <form onSubmit={preparar} className="grid gap-3 sm:grid-cols-2">
                        <label className="text-sm text-slate-300">
                            Fracciones a la venta
                            <input required inputMode="numeric" value={form.cantidad} onChange={cambiar('cantidad')} placeholder={`máx. ${elegido.fracciones}`} className={INPUT} />
                        </label>
                        <label className="text-sm text-slate-300">
                            Precio por fracción (BEZ)
                            <input required inputMode="decimal" value={form.precio} onChange={cambiar('precio')} placeholder="10" className={INPUT} />
                        </label>
                        <div className="sm:col-span-2">
                            <button type="submit" disabled={calculando || ocupado} className="btn-primary disabled:opacity-50">{calculando ? 'Preparando…' : 'Preparar oferta'}</button>
                        </div>
                    </form>

                    {propuesta && (
                        <div className="card space-y-3 !border-amber-500/40">
                            <p className="text-sm text-slate-200">
                                Ofrecerás <strong>{propuesta.oferta.fracciones}</strong> fracciones del activo #{propuesta.oferta.assetId} a <strong>{propuesta.oferta.precioFraccionBez} BEZ</strong>{propuesta.oferta.precioFraccionUsd && <> (≈ ${propuesta.oferta.precioFraccionUsd})</>} cada una{propuesta.oferta.totalUsd && <>, en total ≈ ${propuesta.oferta.totalUsd}</>}.
                            </p>
                            <button type="button" onClick={publicar} disabled={ocupado} className="btn-primary disabled:opacity-50">
                                {ocupado ? 'Firmando…' : 'Firmar y publicar oferta'}
                            </button>
                            <Pasos pasos={pasos} />
                        </div>
                    )}
                </>
            )}
        </section>
    );
}

// ── Página ───────────────────────────────────────────────────────────────────

export default function RwaVentaPage() {
    const auth = useAuth();
    const [tab, setTab] = useState<'comprar' | 'vender'>('comprar');
    // La sesión vive en localStorage: se lee tras montar para no desajustar la hidratación.
    const [cuenta, setCuenta] = useState<string | null | undefined>(undefined);
    useEffect(() => { setCuenta(sessionAddress()); }, [auth?.token]);

    if (cuenta === undefined) return null;
    if (!auth?.token || !cuenta) return <LockScreen title="Inicia sesión para operar con fracciones" />;

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white">RWA · Fracciones</h1>
                <p className="mt-1 text-slate-400">Venta primaria de fracciones de activos del mundo real tokenizados.</p>
            </div>

            <div role="tablist" aria-label="Operación" className="flex gap-2 border-b border-bez-border">
                {([['comprar', 'Comprar'], ['vender', 'Vender (emisor)']] as const).map(([id, nombre]) => (
                    <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                        className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === id ? 'border-amber-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
                        {nombre}
                    </button>
                ))}
            </div>
            {tab === 'comprar' ? <Comprar cuenta={cuenta} /> : <Vender cuenta={cuenta} />}
        </div>
    );
}
