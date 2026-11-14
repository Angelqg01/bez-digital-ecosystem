/**
 * RWASalePanel — venta primaria de fracciones, pagada en BEZ y sin custodia.
 *  · Comprar: consulta una oferta por su número y compra N fracciones (aprobar BEZ + comprar).
 *  · Vender (emisor): ofrece fracciones de un activo propio a un precio en BEZ
 *    (autorizar al contrato de venta + publicar la oferta). Las fracciones no
 *    salen de su wallet hasta que alguien compra.
 */
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
    activosDeCreador, idDeOfertaDeRecibo, leerActivo, leerOferta, mensajeDeError, prepararCompra, prepararOferta,
} from '../../lib/rwaOps';
import { Aviso, BTN, FABRICAS, INPUT, Progreso, useFirma } from './rwaShared';

// ── Comprar ──────────────────────────────────────────────────────────────────

function Comprar({ cuenta }) {
    const [fabrica, setFabrica] = useState('activos');
    const [listingId, setListingId] = useState('');
    const [oferta, setOferta] = useState(null);
    const [cantidad, setCantidad] = useState('1');
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');
    const [hecho, setHecho] = useState('');
    const { firmar, pasos, ocupado } = useFirma();

    const buscar = async (e) => {
        e?.preventDefault();
        if (!/^\d+$/.test(listingId) || Number(listingId) < 1) { setError('Escribe el número de la oferta.'); return; }
        setCargando(true);
        setError('');
        setHecho('');
        setOferta(null);
        try {
            setOferta(await leerOferta({ fabrica, listingId }));
        } catch (err) {
            setError(mensajeDeError(err));
        } finally {
            setCargando(false);
        }
    };

    const n = /^\d+$/.test(cantidad) ? Number(cantidad) : 0;
    const total = oferta && n ? (Number(oferta.precioFraccionBez) * n) : 0;
    const puedeComprar = oferta?.abierta && n >= 1 && n <= Number(oferta.disponibles);

    const comprar = async () => {
        setError('');
        setHecho('');
        try {
            const prep = await prepararCompra({ fabrica, listingId: Number(listingId), cantidad: n, comprador: cuenta });
            await firmar(prep.transacciones, cuenta);
            toast.success(`Compradas ${prep.compra.fracciones} fracciones`);
            setHecho(`Compradas ${prep.compra.fracciones} fracciones del activo #${prep.compra.assetId} por ${prep.compra.totalBez} BEZ.`);
            setOferta(await leerOferta({ fabrica, listingId }).catch(() => null));
        } catch (err) {
            setError(mensajeDeError(err));
        }
    };

    return (
        <section aria-labelledby="titulo-comprar" className="space-y-4">
            <h3 id="titulo-comprar" className="text-lg font-semibold text-white">Comprar fracciones</h3>
            <p className="text-sm text-gray-400">
                Pagas en BEZ: el dinero va directo al emisor (menos la comisión) y las fracciones a tu wallet en la misma transacción.
            </p>
            <form onSubmit={buscar} className="flex flex-wrap items-end gap-3">
                <label className="text-sm text-gray-300">
                    Fábrica
                    <select value={fabrica} onChange={(e) => setFabrica(e.target.value)} className={INPUT}>
                        {FABRICAS.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                    </select>
                </label>
                <label className="text-sm text-gray-300">
                    Nº de oferta
                    <input inputMode="numeric" value={listingId} onChange={(e) => { setListingId(e.target.value.trim()); setOferta(null); }} placeholder="1" className={`${INPUT} w-32`} />
                </label>
                <button type="submit" disabled={cargando || ocupado} className={BTN}>{cargando ? 'Buscando…' : 'Ver oferta'}</button>
            </form>

            {error && <Aviso tipo="error">{error}</Aviso>}
            {hecho && <Aviso tipo="ok">{hecho}</Aviso>}

            {oferta && (
                <div className="space-y-3 rounded-xl border border-gray-700/50 bg-gray-800/50 p-4">
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                        <div><dt className="text-gray-400">Activo</dt><dd className="text-white">#{oferta.assetId}</dd></div>
                        <div><dt className="text-gray-400">Precio por fracción</dt><dd className="text-white">{oferta.precioFraccionBez} BEZ{oferta.precioFraccionUsd && <span className="block text-xs text-gray-400">≈ ${oferta.precioFraccionUsd}</span>}</dd></div>
                        <div><dt className="text-gray-400">Disponibles</dt><dd className="text-white">{oferta.disponibles}</dd></div>
                        <div><dt className="text-gray-400">Estado</dt><dd className={oferta.abierta ? 'text-green-400' : 'text-gray-400'}>{oferta.abierta ? 'Abierta' : 'Cerrada'}</dd></div>
                    </dl>
                    {oferta.abierta && (
                        <div className="flex flex-wrap items-end gap-3">
                            <label className="text-sm text-gray-300">
                                Fracciones a comprar
                                <input inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value.trim())} className={`${INPUT} w-32`} />
                            </label>
                            <button type="button" onClick={comprar} disabled={!puedeComprar || ocupado} className={BTN}>
                                {ocupado ? 'Firmando…' : puedeComprar ? `Comprar por ${total} BEZ` : 'Cantidad no válida'}
                            </button>
                        </div>
                    )}
                    <Progreso pasos={pasos} />
                </div>
            )}
        </section>
    );
}

// ── Vender (emisor) ──────────────────────────────────────────────────────────

function Vender({ cuenta }) {
    const [fabrica, setFabrica] = useState('activos');
    const [activos, setActivos] = useState(null);
    const [elegido, setElegido] = useState(null);
    const [form, setForm] = useState({ cantidad: '', precio: '' });
    const [propuesta, setPropuesta] = useState(null);
    const [calculando, setCalculando] = useState(false);
    const [error, setError] = useState('');
    const [publicada, setPublicada] = useState(null);
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

    const cambiar = (campo) => (e) => {
        setForm((f) => ({ ...f, [campo]: e.target.value }));
        setPropuesta(null);
        setPublicada(null);
    };

    const preparar = async (e) => {
        e.preventDefault();
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
        setError('');
        try {
            const { recibos } = await firmar(propuesta.transacciones, cuenta);
            // El segundo paso es `list`: su recibo trae el evento Listed con el número de la oferta.
            const id = idDeOfertaDeRecibo(recibos[2] ?? Object.values(recibos).at(-1), propuesta.contratoVenta);
            setPublicada(id || '?');
            setPropuesta(null);
            toast.success('Oferta publicada');
        } catch (err) {
            setError(mensajeDeError(err));
        }
    };

    return (
        <section aria-labelledby="titulo-vender" className="space-y-4">
            <h3 id="titulo-vender" className="text-lg font-semibold text-white">Vender fracciones de mis activos</h3>
            <p className="text-sm text-gray-400">
                Autorizas al contrato de venta y publicas la oferta. Tus fracciones no salen de tu wallet hasta que alguien compra.
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
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Activo a vender">
                    {activos.map((a) => (
                        <button key={a.assetId} type="button" role="radio" aria-checked={elegido?.assetId === a.assetId}
                            onClick={() => { setElegido(a); setPropuesta(null); setPublicada(null); setError(''); }}
                            className={`rounded-lg border px-3 py-2 text-left text-sm ${elegido?.assetId === a.assetId ? 'border-amber-500 bg-amber-500/10 text-white' : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-500'}`}>
                            <div className="font-medium">#{a.assetId} · {a.nombre}</div>
                            <div className="text-xs text-gray-400">{a.fracciones} fracciones · {a.precioFraccionBez} BEZ</div>
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
                        <label className="text-sm text-gray-300">
                            Fracciones a la venta
                            <input required inputMode="numeric" value={form.cantidad} onChange={cambiar('cantidad')} placeholder={`máx. ${elegido.fracciones}`} className={INPUT} />
                        </label>
                        <label className="text-sm text-gray-300">
                            Precio por fracción (BEZ)
                            <input required inputMode="decimal" value={form.precio} onChange={cambiar('precio')} placeholder="10" className={INPUT} />
                        </label>
                        <div className="sm:col-span-2">
                            <button type="submit" disabled={calculando || ocupado} className={BTN}>{calculando ? 'Preparando…' : 'Preparar oferta'}</button>
                        </div>
                    </form>

                    {propuesta && (
                        <div className="space-y-3 rounded-xl border border-amber-500/40 bg-gray-800/60 p-4">
                            <p className="text-sm text-gray-200">
                                Ofrecerás <strong>{propuesta.oferta.fracciones}</strong> fracciones del activo #{propuesta.oferta.assetId} a <strong>{propuesta.oferta.precioFraccionBez} BEZ</strong>{propuesta.oferta.precioFraccionUsd && <> (≈ ${propuesta.oferta.precioFraccionUsd})</>} cada una{propuesta.oferta.totalUsd && <>, en total ≈ ${propuesta.oferta.totalUsd}</>}.
                            </p>
                            <button type="button" onClick={publicar} disabled={ocupado} className={`${BTN} text-sm`}>
                                {ocupado ? 'Firmando…' : 'Firmar y publicar oferta'}
                            </button>
                            <Progreso pasos={pasos} />
                        </div>
                    )}
                </>
            )}
        </section>
    );
}

export default function RWASalePanel({ cuenta }) {
    const [rol, setRol] = useState('comprar');
    return (
        <div className="space-y-6">
            <div role="tablist" aria-label="Operación" className="flex gap-2 border-b border-gray-700">
                {[['comprar', 'Comprar'], ['vender', 'Vender (emisor)']].map(([id, nombre]) => (
                    <button key={id} type="button" role="tab" aria-selected={rol === id} onClick={() => setRol(id)}
                        className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${rol === id ? 'border-amber-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
                        {nombre}
                    </button>
                ))}
            </div>
            {rol === 'comprar' ? <Comprar cuenta={cuenta} /> : <Vender cuenta={cuenta} />}
        </div>
    );
}
