/**
 * RWARentPanel — reparto y cobro de rentas de activos RWA.
 *  · Titular: elige un activo, ve sus repartos con lo que le toca y cobra.
 *  · Emisor:  ve sus activos, calcula un reparto (quién cobra qué, comisión, raíz),
 *             descarga el justificante y firma el depósito.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
    activosDeCreador, descargarJustificante, leerActivo, mensajeDeError, prepararReclamo, prepararReparto,
    repartosDeActivo,
} from '../../lib/rwaOps';
import { Aviso, BTN, FABRICAS, INPUT, Progreso, fecha, useFirma } from './rwaShared';

// ── Titular ──────────────────────────────────────────────────────────────────

function Titular({ cuenta }) {
    const [fabrica, setFabrica] = useState('activos');
    const [assetId, setAssetId] = useState('');
    const [repartos, setRepartos] = useState(null);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');
    const { firmar, pasos, ocupado } = useFirma();

    const buscar = useCallback(async (e) => {
        e?.preventDefault();
        if (!/^\d+$/.test(assetId) || Number(assetId) < 1) { setError('Escribe el número del activo.'); return; }
        setCargando(true);
        setError('');
        setRepartos(null);
        try {
            setRepartos((await repartosDeActivo({ fabrica, assetId, cuenta })).repartos);
        } catch (err) {
            setError(mensajeDeError(err));
        } finally {
            setCargando(false);
        }
    }, [assetId, fabrica, cuenta]);

    const cobrar = async (reparto) => {
        setError('');
        try {
            const prep = await prepararReclamo({ fabrica, distributionId: Number(reparto.distributionId), cuenta });
            await firmar(prep.transacciones, cuenta);
            toast.success(`Cobrado: ${prep.cobro.importe} ${prep.cobro.token}`);
            await buscar();
        } catch (err) {
            setError(mensajeDeError(err));
        }
    };

    return (
        <section aria-labelledby="titulo-titular" className="space-y-4">
            <h3 id="titulo-titular" className="text-lg font-semibold text-white">Cobrar mis rentas</h3>
            <p className="text-sm text-gray-400">
                Si tienes fracciones de un activo, aquí ves los repartos de rentas en los que participas. El dinero llega siempre a la wallet de tu sesión.
            </p>
            <form onSubmit={buscar} className="flex flex-wrap items-end gap-3">
                <label className="text-sm text-gray-300">
                    Fábrica
                    <select value={fabrica} onChange={(e) => setFabrica(e.target.value)} className={INPUT}>
                        {FABRICAS.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                    </select>
                </label>
                <label className="text-sm text-gray-300">
                    Nº de activo
                    <input inputMode="numeric" value={assetId} onChange={(e) => setAssetId(e.target.value.trim())} placeholder="3" className={`${INPUT} w-32`} />
                </label>
                <button type="submit" disabled={cargando || ocupado} className={BTN}>{cargando ? 'Buscando…' : 'Ver repartos'}</button>
            </form>

            {error && <Aviso tipo="error">{error}</Aviso>}
            <Progreso pasos={pasos} />

            {repartos && repartos.length === 0 && <Aviso>Este activo todavía no tiene repartos de rentas.</Aviso>}
            {repartos && repartos.length > 0 && (
                <ul className="space-y-3">
                    {repartos.map((r) => {
                        const puedeCobrar = r.abierto && !r.yaCobrado && r.miParte;
                        return (
                            <li key={r.distributionId} className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <div className="font-medium text-white">Reparto #{r.distributionId} · {r.importe} {r.token}</div>
                                        <div className="text-xs text-gray-400">
                                            {r.abierto ? `Se puede cobrar hasta el ${fecha(r.plazoReclamo)}` : `Cerrado el ${fecha(r.plazoReclamo)}`}
                                            {r.detallesCID && <> · <span title={r.detallesCID}>con justificante</span></>}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {r.yaCobrado && <span className="text-green-400 text-sm">Ya cobrado</span>}
                                        {!r.yaCobrado && r.miParte && <div className="text-lg font-semibold text-amber-400">{r.miParte} {r.token}{r.miParteUsd && <span className="block text-xs font-normal text-gray-400">≈ ${r.miParteUsd}</span>}</div>}
                                        {!r.yaCobrado && !r.miParte && r.abierto && (
                                            <span className="text-sm text-gray-400">
                                                {r.motivoSinParte === 'NO_SHARE' ? 'No tenías fracciones en el corte'
                                                    : r.motivoSinParte ? 'No se puede calcular tu parte desde aquí' : '—'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {puedeCobrar && (
                                    <button type="button" onClick={() => cobrar(r)} disabled={ocupado} className={`${BTN} mt-3 text-sm`}>
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

function Emisor({ cuenta }) {
    const [fabrica, setFabrica] = useState('activos');
    const [activos, setActivos] = useState(null);
    const [elegido, setElegido] = useState(null);
    const [repartos, setRepartos] = useState([]);
    const [form, setForm] = useState({ token: 'usdc', importe: '', plazoDias: 90, detallesCID: '' });
    const [propuesta, setPropuesta] = useState(null);
    const [calculando, setCalculando] = useState(false);
    const [error, setError] = useState('');
    const [hecho, setHecho] = useState(false);
    const { firmar, pasos, ocupado } = useFirma();

    useEffect(() => {
        let vivo = true;
        setActivos(null);
        setElegido(null);
        setPropuesta(null);
        setError('');
        (async () => {
            try {
                const { assetIds } = await activosDeCreador({ fabrica, address: cuenta });
                const fichas = await Promise.all(assetIds.map((id) => leerActivo({ fabrica, assetId: id })));
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
        repartosDeActivo({ fabrica, assetId: elegido.assetId })
            .then((r) => { if (vivo) setRepartos(r.repartos); })
            .catch(() => { if (vivo) setRepartos([]); }); // el historial es accesorio: no tapa el formulario
        return () => { vivo = false; };
    }, [elegido, fabrica, hecho]);

    const cambiar = (campo) => (e) => {
        setForm((f) => ({ ...f, [campo]: e.target.value }));
        setPropuesta(null); // cualquier cambio invalida el cálculo anterior
        setHecho(false);
    };

    const calcular = async (e) => {
        e.preventDefault();
        setCalculando(true);
        setError('');
        setPropuesta(null);
        setHecho(false);
        try {
            const cuerpo = {
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
        setError('');
        try {
            await firmar(propuesta.transacciones, cuenta);
            toast.success('Reparto creado: los titulares ya pueden cobrar.');
            setHecho(true);
            setPropuesta(null);
        } catch (err) {
            setError(mensajeDeError(err));
        }
    };

    const r = propuesta?.reparto;
    return (
        <section aria-labelledby="titulo-emisor" className="space-y-4">
            <h3 id="titulo-emisor" className="text-lg font-semibold text-white">Repartir rentas de mis activos</h3>
            <p className="text-sm text-gray-400">
                Depositas las rentas (alquileres, cupones…) y cada titular cobra a prorrata de sus fracciones en el bloque de corte.
                Las fracciones que conservas tú no cobran.
            </p>
            <label className="text-sm text-gray-300 block">
                Fábrica
                <select value={fabrica} onChange={(e) => setFabrica(e.target.value)} className={`${INPUT} w-auto`}>
                    {FABRICAS.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                </select>
            </label>

            {activos === null && <div className="text-gray-400 text-sm">Cargando tus activos…</div>}
            {activos && activos.length === 0 && !error && <Aviso>Esta wallet no ha creado ningún activo en esta fábrica.</Aviso>}
            {activos && activos.length > 0 && (
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Activo a repartir">
                    {activos.map((a) => (
                        <button key={a.assetId} type="button" role="radio" aria-checked={elegido?.assetId === a.assetId}
                            onClick={() => { setElegido(a); setPropuesta(null); setHecho(false); setError(''); }}
                            className={`rounded-lg border px-3 py-2 text-left text-sm ${elegido?.assetId === a.assetId ? 'border-amber-500 bg-amber-500/10 text-white' : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-500'}`}>
                            <div className="font-medium">#{a.assetId} · {a.nombre}</div>
                            <div className="text-xs text-gray-400">{a.fracciones} fracciones{a.activo ? '' : ' · desactivado'}</div>
                        </button>
                    ))}
                </div>
            )}

            {error && <Aviso tipo="error">{error}</Aviso>}
            {hecho && <Aviso tipo="ok">Reparto creado. Los titulares lo verán en «Cobrar mis rentas».</Aviso>}

            {elegido && (
                <>
                    <form onSubmit={calcular} className="grid gap-3 sm:grid-cols-2">
                        <label className="text-sm text-gray-300">
                            Se paga en
                            <select value={form.token} onChange={cambiar('token')} className={INPUT}>
                                <option value="usdc">USDC</option>
                                <option value="bez">BEZ</option>
                            </select>
                        </label>
                        <label className="text-sm text-gray-300">
                            Importe a repartir
                            <input required inputMode="decimal" value={form.importe} onChange={cambiar('importe')} placeholder="900" className={INPUT} />
                        </label>
                        <label className="text-sm text-gray-300">
                            Días para reclamar (31–365)
                            <input type="number" min="31" max="365" value={form.plazoDias} onChange={cambiar('plazoDias')} className={INPUT} />
                        </label>
                        <label className="text-sm text-gray-300">
                            CID del justificante (opcional)
                            <input value={form.detallesCID} onChange={cambiar('detallesCID')} placeholder="Qm…" className={INPUT} />
                        </label>
                        <div className="sm:col-span-2">
                            <button type="submit" disabled={calculando || ocupado} className={BTN}>
                                {calculando ? 'Calculando desde Polygon…' : 'Calcular reparto'}
                            </button>
                        </div>
                    </form>

                    {r && (
                        <div className="space-y-3 rounded-xl border border-amber-500/40 bg-gray-800/60 p-4">
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                                <div><dt className="text-gray-400">Titulares que cobran</dt><dd className="text-white">{r.titulares}</dd></div>
                                <div><dt className="text-gray-400">A repartir</dt><dd className="text-white">{r.importe} {r.token}{r.importeUsd && <span className="block text-xs text-gray-400">≈ ${r.importeUsd}</span>}</dd></div>
                                <div><dt className="text-gray-400">Comisión BeZhas</dt><dd className="text-white">{r.comision} {r.token}</dd></div>
                                <div><dt className="text-gray-400">Pagas en total</dt><dd className="font-semibold text-amber-400">{r.totalAPagar} {r.token}{r.totalAPagarUsd && <span className="block text-xs font-normal text-gray-400">≈ ${r.totalAPagarUsd}</span>}</dd></div>
                                <div><dt className="text-gray-400">Sin asignar (redondeo)</dt><dd className="text-white">{r.restoSinAsignar} {r.token}</dd></div>
                                <div><dt className="text-gray-400">Bloque de corte</dt><dd className="text-white">{r.bloqueDeCorte}</dd></div>
                            </dl>
                            <p className="text-xs text-gray-400">Plazo de reclamo hasta el {fecha(r.plazoReclamo)}. Lo que nadie reclame lo recuperas tú después.</p>
                            {propuesta.aviso && <Aviso>{propuesta.aviso}</Aviso>}
                            <div className="flex flex-wrap gap-3">
                                <button type="button" onClick={() => descargarJustificante(propuesta.justificante, `justificante-activo-${elegido.assetId}.json`)}
                                    className="inline-flex items-center gap-2 rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-200 hover:border-gray-400">
                                    <Download className="w-4 h-4" aria-hidden="true" /> Descargar justificante
                                </button>
                                <button type="button" onClick={depositar} disabled={ocupado} className={`${BTN} text-sm`}>
                                    {ocupado ? 'Firmando…' : `Firmar y depositar ${r.totalAPagar} ${r.token}`}
                                </button>
                            </div>
                            <Progreso pasos={pasos} />
                        </div>
                    )}

                    {repartos.length > 0 && (
                        <div>
                            <h4 className="mb-2 text-sm font-medium text-gray-300">Repartos anteriores</h4>
                            <ul className="space-y-1 text-sm text-gray-300">
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

export default function RWARentPanel({ cuenta }) {
    const [rol, setRol] = useState('titular');
    return (
        <div className="space-y-6">
            <div role="tablist" aria-label="Rol" className="flex gap-2 border-b border-gray-700">
                {[['titular', 'Soy titular'], ['emisor', 'Soy emisor']].map(([id, nombre]) => (
                    <button key={id} type="button" role="tab" aria-selected={rol === id} onClick={() => setRol(id)}
                        className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${rol === id ? 'border-amber-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
                        {nombre}
                    </button>
                ))}
            </div>
            {rol === 'titular' ? <Titular cuenta={cuenta} /> : <Emisor cuenta={cuenta} />}
        </div>
    );
}
