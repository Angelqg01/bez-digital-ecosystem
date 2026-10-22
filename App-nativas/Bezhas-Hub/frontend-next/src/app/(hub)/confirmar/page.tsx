import type { Metadata } from 'next';
import { Suspense } from 'react';
import ConfirmEmail from '../../../components/account/ConfirmEmail';

export const metadata: Metadata = { title: 'Confirmar email — BeZhas Hub', robots: { index: false, follow: false } };

export default function ConfirmarPage() {
  return (
    <section className="hub-section">
      <div className="hub-wrap" style={{ maxWidth: 640 }}>
        <span className="hub-eyebrow">BeZhas ID</span>
        <h1 className="hub-h2" style={{ marginBottom: 28 }}>Confirmación de email</h1>
        <Suspense fallback={null}><ConfirmEmail /></Suspense>
      </div>
    </section>
  );
}
