'use client';

import { useCallback, useEffect, useState } from 'react';
import { useOracleTokenPrices } from '@/lib/public-hooks';
import s from '../home.module.css';

/* ── Formato ────────────────────────────────────────────────────────────── */

function fmtPrice(v: unknown): string | null {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n) || n <= 0) return null;
    if (n >= 1) return `$${n.toFixed(2)}`;
    // Recorta ceros finales sin bajar de 4 decimales: $0.0075, no $0.007500
    const raw = n.toFixed(n < 0.01 ? 6 : 4);
    return `$${raw.replace(/(\.\d{4}\d*?)0+$/, '$1')}`;
}

function fmtUsd(v: unknown): string | null {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) return null;
    if (n <= 0) return 'Sin liquidez';
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
}

function ago(ms: number): string {
    const sec = Math.max(0, Math.round(ms / 1000));
    if (sec < 60) return `hace ${sec} s`;
    if (sec < 3600) return `hace ${Math.round(sec / 60)} min`;
    return `hace ${Math.round(sec / 3600)} h`;
}

/* ── Tipos del payload ──────────────────────────────────────────────────── */

type Market = {
    chainId: number | string;
    price?: number | null;
    liquidityUsd?: number | null;
    pool?: string;
    status?: 'active' | 'paused' | 'pending' | string;
};

export type ContractCard = {
    chainId: number;
    name: string;
    address: string;
    explorerLabel: string;
    explorerUrl: string;
    mark: React.ReactNode;
};

const DEFAULT_FRESHNESS_S = 900;

/* ── Boton de copiar ────────────────────────────────────────────────────── */

function CopyButton({ value, label }: { value: string; label: string }) {
    const [done, setDone] = useState(false);

    const copy = useCallback(async () => {
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(value);
            } else {
                // Sin Clipboard API (http en LAN, navegadores viejos) queda el
                // camino del textarea oculto; execCommand sigue funcionando ahi.
                const ta = document.createElement('textarea');
                ta.value = value;
                ta.setAttribute('readonly', '');
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            setDone(true);
        } catch {
            /* Si el navegador bloquea el portapapeles, la direccion sigue visible. */
        }
    }, [value]);

    useEffect(() => {
        if (!done) return;
        const t = setTimeout(() => setDone(false), 1600);
        return () => clearTimeout(t);
    }, [done]);

    return (
        <button
            type="button"
            onClick={copy}
            aria-label={label}
            className={`${s.ccCopy} ${done ? s.ccCopyDone : ''}`.trim()}
        >
            {done ? 'Copiado' : 'Copiar'}
        </button>
    );
}

/* ── Panel ──────────────────────────────────────────────────────────────── */

/**
 * Oraculo BEZ/USD + contratos desplegados.
 *
 * Aplica sobre el precio la MISMA regla fail-closed que rige la red: si la
 * lectura sale de su ventana de frescura se marca obsoleta y deja de
 * presentarse como vigente. Un precio viejo pintado como actual seria
 * justamente lo que el resto de la pagina promete que no ocurre.
 *
 * El polling lo lleva SWR (`useOracleTokenPrices`, 30 s con deduplicacion), no
 * un setTimeout propio: asi la Home y el resto de paginas publicas comparten
 * una sola peticion en vuelo.
 */
export default function OraclePanel({ contracts }: { contracts: ContractCard[] }) {
    const { data, error } = useOracleTokenPrices();

    // `now` se fija tras montar. Calcular la antiguedad durante el render del
    // servidor daria un "hace N s" distinto al del cliente y React se quejaria.
    const [now, setNow] = useState<number | null>(null);
    useEffect(() => {
        setNow(Date.now());
        const id = setInterval(() => setNow(Date.now()), 15_000);
        return () => clearInterval(id);
    }, []);

    const payload = (data?.data ?? data) as Record<string, any> | undefined;
    const bez = payload?.tokens?.BEZ ?? payload?.tokens?.['BEZ-COIN'];

    const price =
        typeof bez?.priceUSD === 'number'
            ? bez.priceUSD
            : typeof payload?.bezCoinPriceUSD === 'number'
                ? payload.bezCoinPriceUSD
                : typeof payload?.price === 'number'
                    ? payload.price
                    : null;

    const change24h =
        typeof bez?.change24h === 'number'
            ? bez.change24h
            : typeof payload?.bezCoinChange24h === 'number'
                ? payload.bezCoinChange24h
                : null;

    const updatedRaw = bez?.updatedAt ?? payload?.updatedAt;
    const updatedAt = updatedRaw ? Date.parse(updatedRaw) : NaN;
    const windowMs =
        (typeof payload?.freshnessWindow === 'number' ? payload.freshnessWindow : DEFAULT_FRESHNESS_S) * 1000;

    const age = now !== null && Number.isFinite(updatedAt) ? now - updatedAt : Infinity;
    const stale = age > windowMs;

    const loading = !data && !error;
    const priceLabel = fmtPrice(price);

    // Sin precio utilizable el panel no inventa nada: dice que el oraculo esta
    // pendiente, que es la verdad mientras no exista el primer par BEZ/USDC.
    const down = !loading && (priceLabel === null || error);
    const state: 'loading' | 'live' | 'stale' | 'down' = loading
        ? 'loading'
        : down
            ? 'down'
            : stale
                ? 'stale'
                : 'live';

    const markets: Market[] = Array.isArray(payload?.markets)
        ? payload.markets
        : Array.isArray(payload?.pairs)
            ? payload.pairs
            : [];

    const stateLabel =
        state === 'loading' ? 'Conectando' : state === 'down' ? 'Sin dato' : state === 'stale' ? 'Obsoleto' : 'En vivo';

    const metaLabel = (() => {
        if (loading) return 'Consultando el oraculo…';
        if (down) return 'Sin pool de liquidez activo · a la espera del primer par BEZ/USDC';
        const source = payload?.source ?? (bez?.seed ? 'precio semilla' : 'bezhas-oracle');
        const when = Number.isFinite(updatedAt) && now !== null ? `actualizado ${ago(age)}` : 'en fecha desconocida';
        const win = `ventana ${Math.round(windowMs / 1000)} s`;
        return `${source} · ${when} · ${win}${stale ? ' · fuera de ventana, no se considera vigente' : ''}`;
    })();

    const changeClass = change24h === null ? s.chgFlat : change24h > 0 ? s.chgUp : change24h < 0 ? s.chgDown : s.chgFlat;

    return (
        <div className={s.oracle} data-state={state}>
            <div className={s.oracleHead}>
                <div>
                    <span className={s.opLabel}>BEZ / USD · Oraculo BeZhas</span>
                    <div className={`${s.opValue} ${down ? s.opValuePending : ''}`.trim()}>
                        {loading ? (
                            <span className={s.skl} />
                        ) : down ? (
                            'Oraculo pendiente'
                        ) : (
                            <>
                                <span>{priceLabel}</span>
                                {change24h !== null && (
                                    <span className={`${s.chg} ${changeClass}`}>
                                        {change24h > 0 ? '+' : ''}
                                        {change24h.toFixed(2)}% 24 h
                                    </span>
                                )}
                            </>
                        )}
                    </div>
                    <div className={s.opMeta}>{metaLabel}</div>
                </div>
                <div className={s.oracleStatus}>
                    <span className={s.osDot} />
                    <span>{stateLabel}</span>
                </div>
            </div>

            <div className={s.contractsGrid}>
                {contracts.map((c) => {
                    const m = markets.find((x) => String(x.chainId) === String(c.chainId));
                    const mPrice = m ? fmtPrice(m.price) : null;
                    const mLiq = m ? fmtUsd(m.liquidityUsd) : null;
                    const hasLiq = typeof m?.liquidityUsd === 'number' && m.liquidityUsd > 0;

                    const mStatus = !m
                        ? 'Pendiente de pool'
                        : m.status === 'active'
                            ? m.pool
                                ? `${m.pool} · activo`
                                : 'Activo'
                            : m.status === 'paused'
                                ? 'Pausado'
                                : m.pool
                                    ? `${m.pool} · pendiente`
                                    : 'Pendiente de pool';

                    const cell = (value: string | null, ok: boolean) =>
                        loading ? (
                            <span className={s.skl} />
                        ) : (
                            <span className={ok ? '' : s.muted}>{value ?? '—'}</span>
                        );

                    return (
                        <article key={c.chainId} className={s.ccard}>
                            <div className={s.ccHead}>
                                {c.mark}
                                <span className={s.ccName}>{c.name}</span>
                                <span className={s.ccChain}>chainId {c.chainId}</span>
                            </div>

                            <div className={s.ccAddr}>
                                <code>{c.address}</code>
                                <CopyButton
                                    value={c.address}
                                    label={`Copiar direccion del contrato en ${c.name}`}
                                />
                            </div>

                            <dl className={s.ccRows}>
                                <div className={s.ccRow}>
                                    <dt>Precio del oraculo</dt>
                                    <dd>{cell(mPrice, mPrice !== null)}</dd>
                                </div>
                                <div className={s.ccRow}>
                                    <dt>Liquidez del par</dt>
                                    <dd>{cell(mLiq, hasLiq)}</dd>
                                </div>
                                <div className={s.ccRow}>
                                    <dt>Estado del par</dt>
                                    <dd>{cell(mStatus, m?.status === 'active')}</dd>
                                </div>
                            </dl>

                            <div className={s.ccLinks}>
                                <a
                                    className={s.ccLink}
                                    href={c.explorerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {c.explorerLabel} ↗
                                </a>
                            </div>
                        </article>
                    );
                })}
            </div>

            <p className={s.oracleNote}>
                El precio lo publica el oraculo de BeZhas con la misma regla que rige la red:{' '}
                <b>
                    si la lectura sale de su ventana de frescura, se marca como obsoleta y no se muestra
                    como vigente
                </b>
                . La venta directa a precio fijo es un canal aparte y no constituye cotizacion de mercado.
                BEZ-Coin es un token de utilidad; esta pagina no es asesoramiento financiero.
            </p>
        </div>
    );
}
