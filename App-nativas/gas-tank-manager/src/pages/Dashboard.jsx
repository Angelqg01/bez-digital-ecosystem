import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useGasTank, eur, num } from '../hooks/useGasTank';
import GasTankGate from '../components/GasTankGate';

export default function Dashboard() {
  const navigate = useNavigate();
  const gas = useGasTank({ withActivity: true });
  const b = gas.balance;
  const charges = gas.activity.filter((a) => a.kind === 'charge');
  const spent = charges.reduce((s, a) => s - a.credits, 0);

  return (
    <div>
      <div className="page-header animate-in">
        <h1 className="page-title">Gas Tank{gas.orgName ? ` · ${gas.orgName}` : ''}</h1>
        <p className="page-subtitle">Gestión centralizada de gas — tu equipo nunca toca crypto</p>
      </div>

      <GasTankGate gas={gas}>
        {b && (
          <>
            <div className="card animate-in-d1" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem', marginBottom: '1.5rem' }}>
              <div className="tank-gauge">
                <div className="tank-gauge-circle" style={{ '--fill-deg': `${b.balanceCredits > 0 ? 360 : 0}deg` }}>
                  <div className="tank-gauge-inner">
                    <div className="tank-gauge-value">{eur(b.balanceEur)}</div>
                    <div className="tank-gauge-label">Saldo disponible</div>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--bezhas-text-secondary)' }}>
                {num(b.balanceCredits)} créditos{b.reservedCredits > 0 ? ` · ${num(b.reservedCredits)} reservados en operaciones en curso` : ''}
              </div>
              {b.status === 'suspended' && <div role="alert" style={{ marginTop: '0.5rem', color: 'var(--bezhas-warning)' }}>Cuenta suspendida: contacta con soporte.</div>}
              {gas.canRecharge && (
                <button className="btn-primary" style={{ marginTop: '1rem', maxWidth: '240px' }} onClick={() => navigate('/recharge')}>
                  💳 Recargar
                </button>
              )}
            </div>

            <div className="stats-row animate-in-d2">
              <div className="stat-card">
                <div className="stat-label">Operaciones recientes</div>
                <div className="stat-value">{num(charges.length)}</div>
                <div className="stat-sub">últimos {gas.activity.length} movimientos</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Gastado (recientes)</div>
                <div className="stat-value">{eur(spent * b.eurPerCredit)}</div>
                <div className="stat-sub">{num(spent)} créditos</div>
              </div>
            </div>

            <div className="card animate-in-d3" style={{ marginTop: '1.5rem' }}>
              <div className="card-header">
                <span className="card-title">Últimos movimientos</span>
                <button className="btn-secondary" onClick={() => navigate('/analytics')}>Ver todos</button>
              </div>
              {gas.activity.length === 0 ? (
                <p style={{ color: 'var(--bezhas-text-muted)' }}>Aún no hay movimientos. Recarga para empezar.</p>
              ) : (
                <table className="usage-table">
                  <thead><tr><th>Fecha</th><th>Tipo</th><th>Créditos</th><th>Saldo</th></tr></thead>
                  <tbody>
                    {gas.activity.slice(0, 5).map((a) => (
                      <tr key={a.id}>
                        <td>{new Date(a.created_at).toLocaleString('es-ES')}</td>
                        <td>{a.op_type || a.kind}</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{a.credits > 0 ? '+' : ''}{num(a.credits)}</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{num(a.balance_after)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </GasTankGate>
    </div>
  );
}
