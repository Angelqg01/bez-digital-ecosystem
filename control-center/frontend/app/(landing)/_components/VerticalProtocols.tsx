import Link from 'next/link';
import type { ReactNode } from 'react';
import Reveal from './Reveal';
import s from '../home.module.css';

export type Vertical = {
    title: string;
    desc: string;
    /** Contratos reales del repo. Los que van en <b> son la pieza central. */
    contracts: ReactNode;
    icon: ReactNode;
    /** Ruta ya existente del sitio, o URL de la SubApp desplegada. */
    href: string;
};

/**
 * Los siete protocolos sectoriales, mas el modelo de oraculo.
 *
 * Cada tarjeta es un enlace: una rejilla de ocho bloques sin destino es un
 * callejon sin salida justo donde el visitante tiene mas interes.
 */
export default function VerticalProtocols({ verticals }: { verticals: Vertical[] }) {
    return (
        <div className={s.verticals}>
            {verticals.map((v, i) => {
                const external = v.href.startsWith('http');
                const body = (
                    <>
                        {v.icon}
                        <h3>{v.title}</h3>
                        <p>{v.desc}</p>
                        <div className={s.contracts}>{v.contracts}</div>
                        <span className={s.vcardGo}>
                            {external ? 'Abrir App' : 'Ver soluciones'} <span className={s.arw}>{external ? '↗' : '→'}</span>
                        </span>
                    </>
                );

                return (
                    <Reveal key={v.title} index={i}>
                        {external ? (
                            <a
                                className={s.vcard}
                                href={v.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ height: '100%' }}
                            >
                                {body}
                            </a>
                        ) : (
                            <Link className={s.vcard} href={v.href} style={{ height: '100%' }}>
                                {body}
                            </Link>
                        )}
                    </Reveal>
                );
            })}
        </div>
    );
}
