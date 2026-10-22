import type { Metadata } from 'next';
import Link from 'next/link';
import Icon from '../../../components/hub/Icon';
import { LIVE_APPS } from '../../../config/hubData';

export const metadata: Metadata = {
  title: 'BeZhas ID — una cuenta para todas las apps nativas',
  description: 'Con un BeZhas ID entras en todas las apps nativas de BeZhas sin volver a registrarte. Cómo se crea, se confirma y se asocia a un plan.',
};

const STEPS = [
  { title: 'Crea tu cuenta', body: 'Elige un usuario, tu email y una contraseña. En ese momento se genera tu BeZhas ID, con formato BZ-XXXXXXXXXX.' },
  { title: 'Confirma tu email', body: 'Te llegará un correo con un botón. Al pulsarlo confirmas que el email es tuyo; hasta entonces no se activa ningún plan.' },
  { title: 'Elige tu plan', body: 'El botón del correo te lleva a la página de planes. Escoges el que necesitas y pagas con Stripe; Starter es gratis.' },
  { title: 'Vuelve a tu app', body: 'Tras el pago de Stripe te devolvemos a la app o plataforma de BeZhas donde estabas trabajando, con el plan ya activo.' },
];

const FAQ = [
  { q: '¿Para qué sirve el BeZhas ID?', a: 'Es tu identidad única dentro de BeZhas: con el mismo usuario y contraseña entras en todas las apps nativas, y tu plan y tu historial te acompañan en cada una.' },
  { q: '¿Funciona fuera de BeZhas?', a: 'No. El BeZhas ID es solo para las apps nativas de BeZhas y para algunos partners seleccionados que se integran con nosotros. No es un inicio de sesión general de Internet.' },
  { q: '¿Cuesta algo?', a: 'Crear el BeZhas ID es gratis. Solo pagas si eliges un plan de pago (Creator Pro, Business o Enterprise VIP); Starter es gratuito.' },
  { q: '¿Y si no confirmo el email?', a: 'La cuenta queda creada, pero no puedes contratar un plan. El enlace caduca a las 24 horas; puedes pedir otro desde la página de planes.' },
  { q: '¿Puedo tener más de un BeZhas ID?', a: 'Cada persona o empresa tiene uno. Si entras con tu wallet, o con email y contraseña, es siempre la misma identidad.' },
];

export default function BezhasIdPage() {
  return (
    <>
      <section className="hub-hero">
        <div className="hub-wrap">
          <span className="hub-eyebrow">BeZhas ID</span>
          <h1>Una sola identidad para <em>todas las apps nativas</em> de BeZhas.</h1>
          <p className="hub-lead">
            Cuando te registras y te suscribes a un plan recibes un BeZhas ID único. Con él entras en cada app nativa sin volver a crear cuenta,
            y tu plan funciona en todas.
          </p>
          <div className="hub-hero-cta">
            <Link className="hub-btn hub-btn-primary" href="/registro">Crear mi BeZhas ID</Link>
            <Link className="hub-btn hub-btn-ghost" href="/entrar">Ya tengo cuenta</Link>
          </div>
          <div className="hub-chips">
            <span className="hub-chip">Formato BZ-XXXXXXXXXX</span>
            <span className="hub-chip">Solo para apps nativas y algunos partners</span>
            <span className="hub-chip">Crearlo es gratis</span>
          </div>
        </div>
      </section>

      <section className="hub-section" style={{ paddingTop: 0 }}>
        <div className="hub-wrap">
          <span className="hub-eyebrow">Cómo funciona</span>
          <h2 className="hub-h2">De la cuenta al plan en cuatro pasos</h2>
          <div className="hub-grid hub-grid-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="hub-card">
                <span className="hub-tag">Paso {i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="hub-section hub-deep">
        <div className="hub-wrap">
          <span className="hub-eyebrow">Dónde vale</span>
          <h2 className="hub-h2">Las apps nativas de BeZhas</h2>
          <p className="hub-lead">Estas apps reconocen tu BeZhas ID. Algunos partners seleccionados también, y se indica en cada integración.</p>
          <div className="hub-grid hub-grid-4">
            {LIVE_APPS.map((a) => (
              <a key={a.key} className="hub-card" href={a.href}>
                <span className="hub-card-ico"><Icon name={a.icon} /></span>
                <h3>{a.name}</h3>
                <span className="hub-tag">{a.tag}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="hub-section">
        <div className="hub-wrap hub-split" style={{ alignItems: 'start' }}>
          <div>
            <span className="hub-eyebrow">Preguntas frecuentes</span>
            <h2 className="hub-h2">Lo que suele preguntarse</h2>
            <div style={{ display: 'grid', gap: 12, marginTop: 28 }}>
              {FAQ.map((f) => (
                <details key={f.q} className="hub-card" style={{ padding: '16px 20px' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{f.q}</summary>
                  <p style={{ marginTop: 10 }}>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
          <div className="hub-card">
            <span className="hub-tag">Para apps y partners</span>
            <h3>Envía a tus usuarios al Hub</h3>
            <p>Si tu app necesita que el usuario tenga BeZhas ID y plan, mándalo a esta dirección con tu URL de vuelta. Al terminar, el Hub lo devuelve a ella.</p>
            <div className="hub-codebox"><span className="hub-mono">https://hub.bezhas.com/registro?return=https%3A%2F%2Ftu-app.bezhas.com%2F</span></div>
            <p style={{ fontSize: 13.5 }}>Solo se aceptan destinos https en bezhas.com y sus subdominios.</p>
          </div>
        </div>
      </section>
    </>
  );
}
