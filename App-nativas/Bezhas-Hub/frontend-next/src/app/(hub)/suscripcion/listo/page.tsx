import type { Metadata } from 'next';
import { Suspense } from 'react';
import SubscriptionDone from '../../../../components/account/SubscriptionDone';

export const metadata: Metadata = { title: 'Plan activado — BeZhas Hub', robots: { index: false, follow: false } };

export default function ListoPage() {
  return (
    <section className="hub-section">
      <div className="hub-wrap" style={{ maxWidth: 640 }}>
        <span className="hub-eyebrow">Suscripción</span>
        <h1 className="hub-h2" style={{ marginBottom: 28 }}>Gracias por suscribirte</h1>
        <Suspense fallback={null}><SubscriptionDone /></Suspense>
      </div>
    </section>
  );
}
