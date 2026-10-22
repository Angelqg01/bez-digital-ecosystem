import { PLANS } from '../../config/hubData';
import PlanActions from '../account/PlanActions';

/** interactive: botones de contratación con sesión (solo dentro de <Suspense>, usa useSearchParams). */
export default function PlanGrid({ interactive = false }: { interactive?: boolean }) {
  return (
    <div className="hub-grid hub-grid-4" style={{ marginTop: 48 }}>
      {PLANS.map((p) => (
        <article key={p.id} className="hub-card hub-plan" data-hl={p.highlight ? '1' : '0'}>
          {p.highlight && <span className="hub-plan-badge">Más elegido</span>}
          <span className="hub-tag">{p.profile}</span>
          <h3>{p.name}</h3>
          <div className="hub-price">{p.price} <small>{p.priceNote}</small></div>
          {p.annual && <p style={{ fontSize: 13 }}>{p.annual}</p>}
          <ul className="hub-feats">{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
          {interactive && <PlanActions planId={p.id} hasAnnual={!!p.annualUrl} />}
        </article>
      ))}
    </div>
  );
}
