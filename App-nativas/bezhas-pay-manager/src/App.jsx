import React, { useEffect, useMemo, useState } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { CreditCard, Landmark, ShieldCheck, ArrowRight, Loader2, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { HeaderAuthButton, useAuth } from '../../_shared/BezhasAuthProvider.jsx';

// Compra de BEZ-Coin con fiat contra el Gateway (/payments/buy).
//
// Antes esto era una maqueta: 142.509,32 BEZ fijos, un «Processing» de 4 s con
// setTimeout y un «Payment Successful» con un hash inventado, sin llamar a nada.
// Desplegada en pay.bezhas.com habría confirmado pagos que nunca existieron.

const GATEWAY = '/api/gateway/v1';
const METODOS = [
  { id: 'card', titulo: 'Tarjeta (Stripe)', desc: 'Pago con tarjeta en la página segura de Stripe', icon: CreditCard },
  { id: 'bank', titulo: 'Transferencia SEPA', desc: 'IBAN y referencia para conciliar el pedido', icon: Landmark },
];

const usd = (v) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(v);
// El precio semilla es 0,0075 USD: con 2 decimales salía «0,01 US$».
const precioUsd = (v) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', maximumFractionDigits: 6 }).format(v);
const bez = (v) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(v);

function idempotencyKey() {
  const r = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `pay-${r.replace(/[^A-Za-z0-9_-]/g, '')}`.slice(0, 80);
}

async function gateway(apiBase, path, { headers, ...init } = {}) {
  const res = await fetch(`${apiBase}${GATEWAY}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || data.message || `Error ${res.status}`);
    err.code = data.code;
    err.status = res.status;
    throw err;
  }
  return data;
}

function mensajeError(e) {
  if (e.code === 'KYC_REQUIRED') {
    return 'Has alcanzado el límite de compra sin verificación de identidad (KYC). Completa el KYC para seguir comprando.';
  }
  if (e.status === 401 || (e.status === 403 && !e.code)) return 'Tu sesión ha caducado: vuelve a iniciar sesión.';
  return e.message || 'No se pudo crear el pedido.';
}

function Comprar() {
  const { token, apiBase, authHeaders, openLoginModal } = useAuth();
  const [importe, setImporte] = useState('');
  const [metodo, setMetodo] = useState('card');
  const [precio, setPrecio] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [pedido, setPedido] = useState(null);

  useEffect(() => {
    if (!token) { setPrecio(null); return; }
    let vivo = true;
    gateway(apiBase, '/token/price', { headers: authHeaders() })
      .then((d) => { if (vivo && d.priceUSD > 0) setPrecio(d.priceUSD); })
      .catch(() => { if (vivo) setPrecio(null); });
    return () => { vivo = false; };
  }, [token, apiBase, authHeaders]);

  const neto = parseFloat(importe);
  const valido = Number.isFinite(neto) && neto >= 1;
  // Comisión de plataforma del Gateway (config/tokenomics.js): 2,5 % sobre el neto.
  const comision = valido ? Math.round(neto * 0.025 * 100) / 100 : 0;
  const recibes = useMemo(() => (valido && precio ? neto / precio : null), [valido, neto, precio]);

  async function comprar() {
    if (!token) { openLoginModal(); return; }
    if (!valido) return;
    setEnviando(true);
    setError('');
    setPedido(null);
    try {
      const orden = await gateway(apiBase, '/payments/buy', {
        method: 'POST',
        headers: { ...authHeaders(), 'Idempotency-Key': idempotencyKey() },
        body: JSON.stringify({ amountUSD: neto, paymentMethod: metodo }),
      });
      if (metodo === 'card' && orden.checkoutUrl) {
        window.location.href = orden.checkoutUrl;
        return;
      }
      setPedido(orden);
      setImporte('');
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  }

  const estadoUrl = pedido?.hostedCheckoutUrl
    ? (pedido.hostedCheckoutUrl.startsWith('/') ? `${apiBase}${pedido.hostedCheckoutUrl}` : pedido.hostedCheckoutUrl)
    : null;

  return (
    <div className="pay-container animate-in">
      <div className="pay-header">
        <div className="logo-badge">BZ</div>
        <h2>BeZhas Pay</h2>
        <p className="pay-subtitle">Compra BEZ-Coin con tarjeta o transferencia</p>
      </div>

      <label className="pay-subtitle" htmlFor="importe" style={{ display: 'block', marginBottom: 6 }}>Importe (USD)</label>
      <input
        id="importe"
        type="number"
        min="1"
        step="0.01"
        inputMode="decimal"
        placeholder="100"
        value={importe}
        onChange={(e) => setImporte(e.target.value)}
        style={{
          width: '100%', padding: '14px 16px', borderRadius: 12, fontSize: 22, fontWeight: 700,
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff',
        }}
      />

      <div className="payment-details" style={{ marginTop: 16 }}>
        <div className="detail-row">
          <span>Recibes</span>
          <strong>{recibes != null ? `≈ ${bez(recibes)} BEZ` : '—'}</strong>
        </div>
        <div className="detail-row">
          <span>Precio</span>
          <strong>{precio ? `1 BEZ = ${precioUsd(precio)}` : (token ? '—' : 'Inicia sesión para verlo')}</strong>
        </div>
        <div className="detail-row">
          <span>Comisión (2,5 %)</span>
          <strong>{valido ? usd(comision) : '—'}</strong>
        </div>
        <div className="detail-row">
          <span>Total a pagar</span>
          <strong>{valido ? usd(neto + comision) : '—'}</strong>
        </div>
        <div className="detail-row">
          <span>Red</span>
          <strong>Polygon (BEZ-Coin)</strong>
        </div>
      </div>

      <div className="payment-methods">
        <h3>Método de pago</h3>
        {METODOS.map(({ id, titulo, desc, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`method-btn${metodo === id ? ' active' : ''}`}
            onClick={() => setMetodo(id)}
            aria-pressed={metodo === id}
          >
            <div className="method-icon"><Icon /></div>
            <div className="method-info">
              <span className="method-title">{titulo}</span>
              <span className="method-desc">{desc}</span>
            </div>
            <div className={`method-radio${metodo === id ? '' : ' empty'}`}></div>
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: '#FF6B9D', fontSize: 13, marginTop: 12 }}>
          <AlertCircle size={16} style={{ flex: 'none', marginTop: 2 }} /> {error}
        </div>
      )}

      <button className="btn-primary mt-4" onClick={comprar} disabled={enviando || (token && !valido)}>
        {enviando ? <><Loader2 size={18} className="spin" /> Creando pedido…</>
          : token ? <>Comprar BEZ <ArrowRight size={18} /></>
          : <>Inicia sesión para comprar <ArrowRight size={18} /></>}
      </button>

      {pedido && (
        <div className="receipt-card mt-6" style={{ border: '1px solid rgba(0,212,170,0.3)', borderRadius: 14, padding: 16 }}>
          <div className="detail-row"><span><CheckCircle size={14} className="inline-icon" /> Pedido</span><strong>#{pedido.paymentId} · pendiente de pago</strong></div>
          <div className="detail-row"><span>Total</span><strong>{usd(pedido.amountUSD)}</strong></div>
          {pedido.bankTransfer && (
            <>
              <div className="detail-row"><span>Beneficiario</span><strong>{pedido.bankTransfer.beneficiaryAlias}</strong></div>
              <div className="detail-row"><span>IBAN</span><strong style={{ fontFamily: 'monospace' }}>{pedido.bankTransfer.iban}</strong></div>
              <div className="detail-row"><span>BIC</span><strong style={{ fontFamily: 'monospace' }}>{pedido.bankTransfer.bic}</strong></div>
              <div className="detail-row"><span>Referencia</span><strong style={{ fontFamily: 'monospace' }}>{pedido.bankTransfer.reference}</strong></div>
              <p className="pay-subtitle" style={{ marginTop: 8 }}>Usa la referencia exacta: así se concilia la transferencia con tu pedido.</p>
            </>
          )}
          {estadoUrl && (
            <a className="btn-secondary mt-4 w-full" href={estadoUrl} target="_blank" rel="noopener noreferrer"
               style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
              Ver estado del pago <ExternalLink size={16} />
            </a>
          )}
        </div>
      )}

      <div className="security-footer">
        <ShieldCheck size={16} /> Pedidos registrados en el Gateway de BeZhas · KYC según MiCA
      </div>
    </div>
  );
}

/** Enlaces de cobro pay.bezhas.com/c/<token>: la página real la sirve la API. */
function CheckoutRedirect() {
  const { token } = useParams();
  const { apiBase } = useAuth();
  const valido = /^[0-9a-f]{32}$/.test(token || '');
  useEffect(() => {
    if (valido) window.location.replace(`${apiBase}/c/${token}`);
  }, [valido, apiBase, token]);
  if (!valido) return <Navigate to="/" replace />;
  return (
    <div className="pay-container text-center animate-in">
      <Loader2 size={32} className="spin" />
      <p className="pay-subtitle">Abriendo el pago…</p>
    </div>
  );
}

export default function App() {
  return (
    <div className="pay-app-wrapper">
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px' }}>
        <HeaderAuthButton />
      </div>
      <Routes>
        <Route path="/" element={<Comprar />} />
        <Route path="/c/:token" element={<CheckoutRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
