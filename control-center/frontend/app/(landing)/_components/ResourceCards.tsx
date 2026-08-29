import Reveal from './Reveal';
import s from '../home.module.css';

export type Resource = {
    type: string;
    title: string;
    desc: string;
    /** Sin href la tarjeta es informativa: se pinta el estado, no un enlace muerto. */
    href?: string;
    cta: string;
};

export default function ResourceCards({ resources }: { resources: Resource[] }) {
    return (
        <div className={s.res}>
            {resources.map((r, i) => {
                const soon = !r.href;
                const external = r.href?.startsWith('http');

                return (
                    <Reveal
                        key={r.title}
                        index={i}
                        as="article"
                        className={`${s.rcard} ${soon ? s.rcardSoon : ''}`.trim()}
                    >
                        <span className={s.rcardType}>{r.type}</span>
                        <h4>{r.title}</h4>
                        <p>{r.desc}</p>
                        {soon ? (
                            <span className={s.rcardGo}>{r.cta}</span>
                        ) : (
                            <a
                                className={s.rcardGo}
                                href={r.href}
                                target={external ? '_blank' : undefined}
                                rel={external ? 'noopener noreferrer' : undefined}
                            >
                                {r.cta} <span className={s.arw}>{external ? '↗' : '→'}</span>
                            </a>
                        )}
                    </Reveal>
                );
            })}
        </div>
    );
}
