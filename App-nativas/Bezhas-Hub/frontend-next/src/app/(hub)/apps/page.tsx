import type { Metadata } from 'next';
import AppCard from '../../../components/hub/AppCard';
import { LIVE_APPS, UPCOMING_APPS } from '../../../config/hubData';
import { appStatus } from '../../../lib/status';

export const metadata: Metadata = {
  title: 'Apps nativas — BeZhas Hub',
  description: 'Catálogo de las apps nativas de BeZhas: finanzas, wallet, pagos, logística, energía y trazabilidad.',
};

export default async function AppsPage() {
  const states = await Promise.all(LIVE_APPS.map((a) => appStatus(a.href!)));
  return (
    <section className="hub-section">
      <div className="hub-wrap">
        <span className="hub-eyebrow">Apps nativas</span>
        <h1 className="hub-h2" style={{ fontSize: 'clamp(36px,5vw,64px)' }}>El ecosistema, app por app</h1>
        <p className="hub-lead">
          Una sola identidad (BeZhas ID) y un solo plan para todas. Estas son las publicadas hoy; el estado se comprueba desde el servidor cada cinco minutos.
        </p>
        <div className="hub-grid hub-grid-3">
          {LIVE_APPS.map((a, i) => <AppCard key={a.key} app={a} state={states[i]} />)}
        </div>

        <h2 className="hub-h2" style={{ marginTop: 80 }}>En desarrollo</h2>
        <p className="hub-lead">Prototipos que aún no se publican porque no tienen datos reales conectados. Cuando lo estén, aparecerán arriba con su enlace.</p>
        <div className="hub-grid hub-grid-3">
          {UPCOMING_APPS.map((a) => <AppCard key={a.key} app={a} state="soon" />)}
        </div>
      </div>
    </section>
  );
}
