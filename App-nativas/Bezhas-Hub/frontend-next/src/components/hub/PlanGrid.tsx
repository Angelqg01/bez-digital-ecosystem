import { PLANS } from '../../config/hubData';

export default function PlanGrid({ withLinks = true }: { withLinks?: boolean }) {
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
          {withLinks && (
            <div style={{ marginTop: 'auto', display: 'grid', gap: 8, paddingTop: 10 }}>
              {p.monthlyUrl ? (
                <>
                  <a className="hub-btn hub-btn-primary" href={p.monthlyUrl} rel="noopener">Contratar mensual</a>
                  {p.annualUrl && <a className="hub-btn hub-btn-ghost" href={p.annualUrl} rel="noopener">Contratar anual</a>}
                </>
              ) : (
                <a className="hub-btn hub-btn-ghost" href="https://www.bezhas.com/register?plan=starter">Empezar gratis</a>
              )}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
