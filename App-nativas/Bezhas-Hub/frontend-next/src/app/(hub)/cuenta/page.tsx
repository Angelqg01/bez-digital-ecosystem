import type { Metadata } from 'next';
import AccountUsage from '../../../components/account/AccountUsage';

export const metadata: Metadata = { title: 'Mi cuenta — BeZhas Hub', robots: { index: false, follow: false } };

export default function CuentaPage() {
  return (
    <section className="hub-section">
      <div className="hub-wrap" style={{ maxWidth: 920 }}>
        <span className="hub-eyebrow">Mi cuenta</span>
        <h1 className="hub-h2" style={{ marginBottom: 28 }}>Tu BeZhas ID, tu plan y tu consumo</h1>
        <AccountUsage />
      </div>
    </section>
  );
}
