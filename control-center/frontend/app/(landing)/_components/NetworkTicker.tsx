'use client';

import s from '../home.module.css';

/**
 * Cinta continua de datos de red.
 *
 * Los items se duplican para que el bucle no tenga costura: la animacion
 * desplaza -50%, justo el ancho de la primera copia.
 */
export default function NetworkTicker({ items }: { items: [string, string][] }) {
    const doubled = [...items, ...items];

    return (
        <div className={s.ticker} aria-hidden="true">
            <div className={s.tickerRow}>
                {doubled.map(([label, value], i) => (
                    <span key={`${label}-${i}`}>
                        <i className={s.tickerDot} />
                        {label}
                        <b>{value}</b>
                    </span>
                ))}
            </div>
        </div>
    );
}
