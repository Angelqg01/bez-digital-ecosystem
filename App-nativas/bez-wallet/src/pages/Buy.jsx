import React, { useEffect, useMemo, useState } from 'react';
import { C, Card, Btn, Input, Chip } from '../components/ui/DesignSystem';
import { useAuth } from '../context/AuthProvider';
import { fetchBezPrice } from '../../../_shared/bez-price.js';

// Compra de BEZ-Coin con fiat contra el Gateway (/payments/buy).
//
// Antes esta página simulaba el pago con un setTimeout, anunciaba «+X BEZ has
// been added to your wallet» sin cobrar nada, calculaba con 0,07 USD/BEZ y
// enseñaba un IBAN lituano (LT82…, REVOLT21, «BeZhas Corporate Ltd.») que no es
// la cuenta de BeZhas y una dirección de depósito inventada. Ahora cada compra
// es un pedido real y los datos de pago los da la API.

const GATEWAY = '/api/gateway/v1';
const FEE = 0.025; // config/tokenomics.js: 250 bps sobre el neto

const usd = (v) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(v);
const precioUsd = (v) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', maximumFractionDigits: 6 }).format(v);
const fmtBez = (v) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(v);

function idempotencyKey() {
  const r = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `wallet-${r.replace(/[^A-Za-z0-9_-]/g, '')}`.slice(0, 80);
}

export default function Buy() {
  const { token, apiBase, authHeaders, openLoginModal } = useAuth();
  const [method, setMethod] = useState('card'); // card | bank
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState(null);

  // Oráculo público: el precio se ve sin iniciar sesión (antes se pedía a /token/price, que exige api-key con plan).
  useEffect(() => {
    const ctrl = new AbortController();
    fetchBezPrice(apiBase, fetch, { signal: ctrl.signal }).then((p) => setPrice(p ? p.priceUSD : null));
    return () => ctrl.abort();
  }, [apiBase]);

  const net = parseFloat(amount);
  const valid = Number.isFinite(net) && net >= 1;
  const fee = valid ? Math.round(net * FEE * 100) / 100 : 0;
  const estBez = useMemo(() => (valid && price ? net / price : null), [valid, net, price]);

  const handlePurchase = async () => {
    if (!token) { openLoginModal(); return; }
    if (!valid) return;
    setBusy(true);
    setError('');
    setOrder(null);
    try {
      const res = await fetch(`${apiBase}${GATEWAY}/payments/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey(), ...authHeaders() },
        body: JSON.stringify({ amountUSD: net, paymentMethod: method }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === 'KYC_REQUIRED') {
          throw new Error('Has alcanzado el límite de compra sin verificación de identidad (KYC).');
        }
        throw new Error(data.error || `Error ${res.status}`);
      }
      if (method === 'card' && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      setOrder(data);
      setAmount('');
    } catch (e) {
      setError(e.message || 'No se pudo crear el pedido.');
    } finally {
      setBusy(false);
    }
  };

  const statusUrl = order?.hostedCheckoutUrl
    ? (order.hostedCheckoutUrl.startsWith('/') ? `${apiBase}${order.hostedCheckoutUrl}` : order.hostedCheckoutUrl)
    : null;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="page-header animate-in">
        <h1 className="page-title">Comprar BEZ-Coin</h1>
        <p className="page-subtitle">Con tarjeta (Stripe) o transferencia SEPA. Los BEZ se entregan en tu wallet al confirmarse el pago.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }} className="animate-in-delay-1">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            <MethodCard title="Tarjeta" icon="💳" desc="Página segura de Stripe" active={method === 'card'} onClick={() => setMethod('card')} />
            <MethodCard title="Transferencia" icon="🏦" desc="SEPA · 1-3 días" active={method === 'bank'} onClick={() => setMethod('bank')} />
          </div>

          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ color: C.text, fontSize: '1.2rem', fontWeight: 600 }}>
                {method === 'card' ? 'Pago con tarjeta' : 'Transferencia bancaria'}
              </h3>
              <Chip color={C.primary}>{method === 'card' ? 'Stripe' : 'SEPA'}</Chip>
            </div>

            <Input
              label="Importe (USD)"
              sym="$"
              value={amount}
              onChange={setAmount}
              usd={estBez != null ? `≈ ${fmtBez(estBez)} BEZ` : undefined}
            />

            {error && (
              <div role="alert" style={{ color: C.red || '#FF6B9D', fontSize: 13, marginTop: '1rem' }}>{error}</div>
            )}

            <Btn
              full
              color={C.gold}
              style={{ marginTop: '1.5rem' }}
              disabled={busy || (token && !valid)}
              onClick={handlePurchase}
            >
              {busy ? 'Creando pedido…'
                : !token ? 'Inicia sesión para comprar'
                : method === 'card' ? `Pagar ${valid ? usd(net + fee) : ''} con tarjeta`
                : 'Obtener datos de transferencia'}
            </Btn>

            {order && (
              <div style={{ marginTop: '1.5rem', background: C.card2, borderRadius: 12, padding: '1rem', border: `1px solid ${C.border2}` }}>
                <div style={{ color: C.primary, fontWeight: 600, marginBottom: 8 }}>Pedido #{order.paymentId} · pendiente de pago</div>
                <Row label="Total" value={usd(order.amountUSD)} />
                {order.bankTransfer && (
                  <>
                    <Row label="Beneficiario" value={order.bankTransfer.beneficiaryAlias} />
                    <Row label="IBAN" value={order.bankTransfer.iban} />
                    <Row label="BIC" value={order.bankTransfer.bic} />
                    <Row label="Referencia" value={order.bankTransfer.reference} />
                    <p style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>Usa la referencia exacta para que se concilie con tu pedido.</p>
                  </>
                )}
                {statusUrl && (
                  <a href={statusUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 12, color: C.primary, fontSize: 13 }}>
                    Ver estado del pago ↗
                  </a>
                )}
              </div>
            )}
          </Card>
        </div>

        <div>
          <Card>
            <h4 style={{ color: C.text, fontSize: 14, fontWeight: 600, marginBottom: '1rem' }}>Resumen</h4>
            <Summary label="Importe" value={valid ? usd(net) : '-'} />
            <Summary label="Comisión (2,5 %)" value={valid ? usd(fee) : '-'} />
            <Summary label="Precio" value={price ? `1 BEZ = ${precioUsd(price)}` : '-'} />
            <div style={{ borderTop: `1px solid ${C.border}`, margin: '1rem 0' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: C.gold, fontSize: 14, fontWeight: 600 }}>
              <span>Recibes</span>
              <span>{estBez != null ? `${fmtBez(estBez)} BEZ` : '-'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: C.text, fontSize: 13, marginTop: 8 }}>
              <span>Total a pagar</span>
              <span>{valid ? usd(net + fee) : '-'}</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

const MethodCard = ({ title, icon, desc, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    style={{
      textAlign: 'left',
      background: active ? `${C.primary}11` : C.card,
      border: `1px solid ${active ? C.primary : C.border}`,
      borderRadius: 12,
      padding: '1rem',
      cursor: 'pointer',
      transition: 'all 0.2s',
    }}
  >
    <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>{icon}</div>
    <div style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>{title}</div>
    <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>{desc}</div>
  </button>
);

const Row = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
    <span style={{ color: C.muted, fontSize: 12 }}>{label}</span>
    <span style={{ color: C.text, fontFamily: C.mono, fontSize: 12, textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
  </div>
);

const Summary = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: C.muted, fontSize: 12 }}>
    <span>{label}</span>
    <span>{value}</span>
  </div>
);
