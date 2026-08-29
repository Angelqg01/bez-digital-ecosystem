import Counter from './Counter';
import Reveal from './Reveal';
import s from '../home.module.css';

export type StatItem = {
    /** Numero a animar. Se omite para cifras no numericas como "2/N". */
    to?: number;
    suffix?: string;
    /** Texto literal cuando la cifra no es un numero animable. */
    label?: string;
    text: string;
};

export default function StatGrid({ items, light = false }: { items: StatItem[]; light?: boolean }) {
    return (
        <div className={`${s.stats} ${light ? s.statsLight : ''}`.trim()}>
            {items.map((item, i) => (
                <Reveal key={item.text} index={i} className={s.stat}>
                    <div className={s.statN}>
                        <Counter to={item.to} suffix={item.suffix} label={item.label} />
                    </div>
                    <div className={s.statL}>{item.text}</div>
                </Reveal>
            ))}
        </div>
    );
}
