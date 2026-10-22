import Link from 'next/link';
import AppCard from '../../components/hub/AppCard';
import Icon from '../../components/hub/Icon';
import PlanGrid from '../../components/hub/PlanGrid';
import { CONTRACTS, HUB_PILLARS, LINKS, LIVE_APPS, PLUGIN, POLYGONSCAN } from '../../config/hubData';
import { appStatus } from '../../lib/status';

export default async function HubHome() {
  const states = await Promise.all(LIVE_APPS.map((a) => appStatus(a.href!)));
  const online = states.filter((s) => s === 'online').length;

  return (
    <>
      <section className="hub-hero">
        <div className="hub-wrap">
          <span className="hub-eyebrow">Centro de operaciones B2B</span>
          <h1>Tu empresa, tus claves y <em>todas las apps de BeZhas</em> en un solo sitio.</h1>
          <p className="hub-lead">
            Gestiona la organización, las sedes y los miembros; crea claves de API con permisos acotados; sigue el consumo de tu
            plan y entra a cada app nativa con el mismo BeZhas ID.
          </p>
          <div className="hub-hero-cta">
            <a className="hub-btn hub-btn-primary" href={LINKS.precios}>Ver planes y contratar</a>
            <Link className="hub-btn hub-btn-ghost" href="/apps">Explorar apps nativas</Link>
            <Link className="hub-btn hub-btn-ghost" href="/developers">Plugin WordPress y API</Link>
          </div>
          <div className="hub-chips" aria-label="Datos de la plataforma">
            <span className="hub-chip">{online} de {LIVE_APPS.length} apps respondiendo ahora</span>
            <span className="hub-chip">BEZ-Coin sobre Polygon</span>
            <span className="hub-chip">Pagos en EUR, USD o BEZ (−20 %)</span>
            <span className="hub-chip">MiCA · SEPA · DAC8</span>
          </div>
        </div>
      </section>

      <section className="hub-section" style={{ paddingTop: 0 }}>
        <div className="hub-wrap">
          <span className="hub-eyebrow">Qué hace el Hub</span>
          <h2 className="hub-h2">El plano de control del ecosistema</h2>
          <div className="hub-grid hub-grid-4">
            {HUB_PILLARS.map((p) => (
              <div key={p.title} className="hub-card">
                <span className="hub-card-ico"><Icon name={p.icon} /></span>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="hub-section hub-deep">
        <div className="hub-wrap">
          <span className="hub-eyebrow">Apps nativas</span>
          <h2 className="hub-h2">Cada vertical, en su propia app</h2>
          <p className="hub-lead">El Hub no opera por ellas: te lleva a la app que corresponde. Las que están publicadas responden en su subdominio de bezhas.com.</p>
          <div className="hub-grid hub-grid-3">
            {LIVE_APPS.map((a, i) => <AppCard key={a.key} app={a} state={states[i]} />)}
          </div>
          <div className="hub-hero-cta">
            <Link className="hub-btn hub-btn-ghost" href="/apps">Ver el catálogo completo</Link>
          </div>
        </div>
      </section>

      <section className="hub-section">
        <div className="hub-wrap">
          <span className="hub-eyebrow">Planes</span>
          <h2 className="hub-h2">Contrata en minutos, sin llamadas previas</h2>
          <p className="hub-lead">Cancela cuando quieras. Pagando con BEZ-Coin, un 20 % de descuento. Precios sin IVA.</p>
          <PlanGrid />
        </div>
      </section>

      <section className="hub-section hub-deep">
        <div className="hub-wrap hub-split">
          <div>
            <span className="hub-eyebrow">Plugin para WordPress</span>
            <h2 className="hub-h2">El Hub dentro de tu wp-admin</h2>
            <p className="hub-lead">
              Suscríbete a los planes, activa apps nativas y cobra con BeZhas-Pay sin salir de WordPress. Gateway WooCommerce incluido.
            </p>
            <div className="hub-hero-cta">
              <a className="hub-btn hub-btn-primary" href={PLUGIN.url}>Descargar v{PLUGIN.version}</a>
              <Link className="hub-btn hub-btn-ghost" href="/developers">Instalación y verificación</Link>
            </div>
          </div>
          <div className="hub-card">
            <span className="hub-tag">Requisitos</span>
            <ul className="hub-feats">
              <li>PHP {PLUGIN.php} o superior, en una versión con los parches de seguridad de octubre de 2026</li>
              <li>WordPress 5.8 o superior; WooCommerce 5.0 o superior (opcional)</li>
              <li>API Key de BeZhas y cuenta activa</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="hub-section">
        <div className="hub-wrap">
          <span className="hub-eyebrow">On-chain</span>
          <h2 className="hub-h2">Contratos verificables</h2>
          <p className="hub-lead">Direcciones públicas, comprobables en Polygonscan. BEZ-Coin solo existe en Polygon.</p>
          <div className="hub-grid hub-grid-3">
            {CONTRACTS.map((c) => (
              <a key={c.address} className="hub-card" href={`${POLYGONSCAN}${c.address}`}>
                <span className="hub-tag">{c.label}</span>
                <span className="hub-mono">{c.address}</span>
                <span className="hub-card-foot">Ver en Polygonscan <Icon name="arrow-up-right" size={16} /></span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
