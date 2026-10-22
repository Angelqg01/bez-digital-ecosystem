import type { Metadata } from 'next';
import { Suspense } from 'react';
import AuthForm from '../../../components/account/AuthForm';

export const metadata: Metadata = { title: 'Crear mi BeZhas ID — BeZhas Hub', description: 'Crea tu BeZhas ID: usuario, email y contraseña.' };

export default function RegistroPage() {
  return (
    <section className="hub-section">
      <div className="hub-wrap hub-split" style={{ alignItems: 'start' }}>
        <div>
          <span className="hub-eyebrow">BeZhas ID</span>
          <h1 className="hub-h2" style={{ fontSize: 'clamp(34px,4.6vw,56px)' }}>Una sola cuenta para todas las apps nativas</h1>
          <p className="hub-lead">Elige un usuario, tu email y una contraseña. Te enviaremos un correo para confirmarlo y desde ahí eliges plan.</p>
          <ol className="hub-steps" style={{ marginTop: 28 }}>
            <li>Creas tu cuenta y recibes tu BeZhas ID.</li>
            <li>Confirmas tu email con el botón del correo.</li>
            <li>Eliges tu plan y pagas con Stripe.</li>
            <li>Vuelves a la app donde estabas trabajando.</li>
          </ol>
        </div>
        <Suspense fallback={null}><AuthForm mode="registro" /></Suspense>
      </div>
    </section>
  );
}
