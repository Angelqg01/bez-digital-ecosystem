import Reveal from './Reveal';
import s from '../home.module.css';

export type LogoGroup = {
    label: string;
    chips: { name: string; note: string }[];
};

export default function IntegrationsWall({ groups }: { groups: LogoGroup[] }) {
    return (
        <>
            {groups.map((group, gi) => (
                <div key={group.label}>
                    <Reveal
                        as="p"
                        className={s.eyebrow}
                        style={{ marginTop: gi === 0 ? 44 : 56 }}
                    >
                        {group.label}
                    </Reveal>
                    <div className={s.logowall}>
                        {group.chips.map((chip, i) => (
                            <Reveal key={chip.name} index={i} className={s.logoChip}>
                                <div>
                                    {chip.name}
                                    <small>{chip.note}</small>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            ))}
        </>
    );
}
