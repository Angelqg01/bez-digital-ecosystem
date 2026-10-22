import type { Metadata } from 'next';
import { Suspense } from 'react';
import AccountBanner from '../../../components/account/AccountBanner';
import PlanGrid from '../../../components/hub/PlanGrid';
import { LINKS } from '../../../config/hubData';

export const metadata: Metadata = {
  title: 'Planes y precios — BeZhas Hub',
  description: 'Starter, Creator Pro, Business y Enterprise VIP. Contrata online; pagando con BEZ-Coin, un 20 % de descuento.',
};

export default function PlanesPage() {
  return (
    <section className="hub-section">
      <div className="hub-wrap">
        <span className="hub-eyebrow">Planes y precios</span>
        <h1 className="hub-h2" style={{ fontSize: 'clamp(36px,5vw,64px)' }}>Un plan para cada tamaño de empresa</h1>
        <p className="hub-lead">
          Contrata hoy, sin llamadas previas; cancela cuando quieras. Precios sin IVA. Pagando con BEZ-Coin, un 20 % de descuento.
          OPERANT, la gestión empresarial con agentes de IA, es un módulo opcional de cada plan.
        </p>
        <div style={{ marginTop: 32 }}>
          <Suspense fallback={null}><AccountBanner /></Suspense>
        </div>
        <Suspense fallback={null}><PlanGrid interactive /></Suspense>
        <p className="hub-lead" style={{ marginTop: 40 }}>
          ¿Necesitas condiciones a medida o un piloto? Escribe a <a style={{ color: 'var(--accent)' }} href={LINKS.sales}>ventas@bezhas.com</a> o
          consulta la <a style={{ color: 'var(--accent)' }} href={LINKS.precios}>página completa de precios</a>.
        </p>
      </div>
    </section>
  );
}
