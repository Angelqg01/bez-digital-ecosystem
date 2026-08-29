import Reveal from './Reveal';
import s from '../home.module.css';

export type ChainStep = {
    n: string;
    title: string;
    desc: string;
    tags: string[];
};

/** La secuencia de seis pasos que va del evento del ERP a la prueba del auditor. */
export default function EvidenceChain({ steps }: { steps: ChainStep[] }) {
    return (
        <div className={s.chain}>
            {steps.map((step, i) => (
                <Reveal key={step.n} index={i} className={s.chainStep}>
                    <div className={s.chainN}>{step.n}</div>
                    <div className={s.chainC}>
                        <h3>{step.title}</h3>
                        <p>{step.desc}</p>
                        <div className={s.tags}>
                            {step.tags.map((tag) => (
                                <span key={tag} className={s.tag}>
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                </Reveal>
            ))}
        </div>
    );
}
