import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthProvider';

// Historial real de la wallet de la sesión: pedidos de compra/venta/pago del
// Gateway y transacciones indexadas. Antes era una lista fija de diez
// operaciones inventadas (con hashes y bloques de relleno) igual para todos.

const GATEWAY = '/api/gateway/v1';
const FILTERS = [
  { id: 'all', label: 'Todo' },
  { id: 'orders', label: 'Pedidos' },
  { id: 'chain', label: 'On-chain' },
];

const ESTADOS = { pending: 'Pendiente', processing: 'En proceso', completed: 'Completado', failed: 'Fallido', expired: 'Caducado', refunded: 'Reembolsado' };
const TIPOS = { buy: 'Compra de BEZ', sell: 'Venta de BEZ', payment: 'Pago BezPay' };

/**
 * Dirección propia. Primero la del JWT: es la única que requireAddressAccess
 * deja consultar (el perfil puede traer la EOA de alta y el JWT la Safe).
 */
function sessionAddress(user, token) {
  try {
    const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const a = claims.address || claims.wallet_address || claims.primary_wallet_address;
    if (a) return a;
  } catch { /* no es un JWT */ }
  return user?.walletAddress || user?.wallet_address || user?.primary_wallet_address || null;
}

const short = (a) => (a && a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || '—');
const fecha = (d) => (d ? new Date(d).toLocaleString('es-ES') : '');
const num = (v, max = 2) => Number(v || 0).toLocaleString('es-ES', { maximumFractionDigits: max });

export default function History() {
  const { token, user, apiBase, authHeaders } = useAuth();
  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const address = token ? sessionAddress(user, token) : null;

  useEffect(() => {
    if (!address) return undefined;
    let alive = true;
    setLoading(true);
    setError('');
    const get = (path) => fetch(`${apiBase}${GATEWAY}${path}`, { headers: authHeaders() })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || `Error ${r.status}`);
        return d;
      });

    Promise.allSettled([
      get(`/payments/history/${address}?limit=50`),
      get(`/wallet/history/${address}?limit=50`),
    ]).then(([pagos, txs]) => {
      if (!alive) return;
      const lista = [];
      if (pagos.status === 'fulfilled') {
        // /payments/history devuelve amount ya formateado («41.00 USD» / «250 BEZ»).
        for (const p of pagos.value.payments || []) {
          const esBuy = p.type === 'buy';
          lista.push({
            key: `p-${p.id}`,
            kind: 'orders',
            dir: esBuy ? 'in' : 'out',
            titulo: `${TIPOS[p.type] || p.type} #${p.id}`,
            detalle: [p.method, ESTADOS[p.status] || p.status].filter(Boolean).join(' · '),
            importe: p.amount || '',
            hash: p.txHash,
            at: p.date,
          });
        }
      }
      if (txs.status === 'fulfilled') {
        for (const t of txs.value.transactions || []) {
          const entra = t.to_address?.toLowerCase() === address.toLowerCase();
          lista.push({
            key: `t-${t.tx_hash}`,
            kind: 'chain',
            dir: entra ? 'in' : 'out',
            titulo: entra ? 'Recibido' : 'Enviado',
            detalle: `${entra ? 'De' : 'A'} ${short(entra ? t.from_address : t.to_address)} · ${t.status}`,
            importe: t.value_wei ? `${entra ? '+' : '−'}${num(Number(t.value_wei) / 1e18, 4)}` : '',
            hash: t.tx_hash,
            at: t.created_at,
          });
        }
      }
      lista.sort((a, b) => new Date(b.at) - new Date(a.at));
      setItems(lista);
      if (pagos.status === 'rejected' && txs.status === 'rejected') setError(pagos.reason.message);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [address, apiBase, authHeaders]);

  const filtered = items.filter((i) => filter === 'all' || i.kind === filter);

  return (
    <div>
      <div className="page-header animate-in">
        <h1 className="page-title">Historial</h1>
        <p className="page-subtitle">{address ? `Operaciones de ${short(address)}` : 'Inicia sesión para ver tus operaciones'}</p>
      </div>

      <div className="animate-in-delay-1" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className="btn-secondary"
            onClick={() => setFilter(f.id)}
            style={{
              background: filter === f.id ? 'rgba(var(--bezhas-primary-rgb), 0.1)' : undefined,
              borderColor: filter === f.id ? 'var(--bezhas-primary)' : undefined,
              color: filter === f.id ? 'var(--bezhas-primary)' : undefined,
              fontSize: '0.8rem', padding: '0.4rem 0.85rem',
            }}
          >
            {f.label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--bezhas-text-muted)', alignSelf: 'center' }}>
          {loading ? 'Cargando…' : `${filtered.length} operaciones`}
        </span>
      </div>

      {error && <div className="card" style={{ color: 'var(--bezhas-danger, #EF4444)', marginBottom: '1rem' }}>{error}</div>}

      {filtered.length > 0 && (
        <div className="card animate-in-delay-2" style={{ padding: '0.75rem' }}>
          <div className="tx-list">
            {filtered.map((tx) => (
              <div key={tx.key} className="tx-item">
                <div className={`tx-icon ${tx.dir}`}>{tx.dir === 'in' ? '↙️' : '↗️'}</div>
                <div className="tx-info">
                  <div className="tx-type">{tx.titulo}</div>
                  <div className="tx-address">{tx.detalle}</div>
                </div>
                <div style={{ flex: '0 0 auto', textAlign: 'right' }}>
                  <div className={`tx-amount-value ${tx.dir}`}>{tx.importe}</div>
                  <div className="tx-time">{fecha(tx.at)}</div>
                </div>
                {tx.hash && (
                  <a
                    href={`https://polygonscan.com/tx/${tx.hash}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ marginLeft: '1rem', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--bezhas-primary)' }}
                  >
                    {short(tx.hash)}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔍</div>
          <p style={{ color: 'var(--bezhas-text-muted)' }}>{address ? 'Todavía no hay operaciones' : 'Inicia sesión para ver tu historial'}</p>
        </div>
      )}
    </div>
  );
}
