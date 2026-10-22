import type { Metadata } from 'next';
import { Suspense } from 'react';
import AuthForm from '../../../components/account/AuthForm';

export const metadata: Metadata = { title: 'Entrar — BeZhas Hub', description: 'Entra con tu BeZhas ID.' };

export default function EntrarPage() {
  return (
    <section className="hub-section">
      <div className="hub-wrap hub-split" style={{ alignItems: 'start' }}>
        <div>
          <span className="hub-eyebrow">BeZhas ID</span>
          <h1 className="hub-h2" style={{ fontSize: 'clamp(34px,4.6vw,56px)' }}>Entra con tu BeZhas ID</h1>
          <p className="hub-lead">El mismo usuario y contraseña te sirven en todas las apps nativas de BeZhas.</p>
        </div>
        <Suspense fallback={null}><AuthForm mode="entrar" /></Suspense>
      </div>
    </section>
  );
}
