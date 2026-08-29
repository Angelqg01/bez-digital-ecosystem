import Reveal from './Reveal';
import s from '../home.module.css';

export type Control = {
    badge: string;
    title: string;
    desc: string;
};

/** Los ocho controles de AEGIS. Rejilla a hueso: 1px de separacion, sin radios. */
export default function SecurityControls({ controls }: { controls: Control[] }) {
    return (
        <div className={s.controls}>
            {controls.map((c, i) => (
                <Reveal key={c.title} index={i} className={s.ctrl}>
                    <span className={s.badge}>{c.badge}</span>
                    <h4>{c.title}</h4>
                    <p>{c.desc}</p>
                </Reveal>
            ))}
        </div>
    );
}
