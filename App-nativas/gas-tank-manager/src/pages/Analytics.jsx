import React from 'react';
import { useGasTank, num } from '../hooks/useGasTank';
import GasTankGate from '../components/GasTankGate';

const EXPLORER = { 137: 'https://polygonscan.com/tx/', 80002: 'https://amoy.polygonscan.com/tx/' };
const LABEL = { recharge: 'Recarga', charge: 'Consumo', refund: 'Devolución', adjustment: 'Ajuste', bonus: 'Bono' };

export default function Analytics() {
  const gas = useGasTank({ withActivity: true });

  return (
    <div>
      <div className="page-header animate-in">
        <h1 className="page-title">Actividad</h1>
        <p className="page-subtitle">Movimientos del Gas Tank: recargas y consumo por operación</p>
      </div>
      <GasTankGate gas={gas}>
        <div className="card animate-in-d1">
          {gas.activity.length === 0 ? (
            <p style={{ color: 'var(--bezhas-text-muted)' }}>Sin movimientos todavía.</p>
          ) : (
            <table className="usage-table">
              <thead><tr><th>Fecha</th><th>Tipo</th><th>Operación</th><th>App</th><th>Créditos</th><th>Saldo</th><th>Tx</th></tr></thead>
              <tbody>
                {gas.activity.map((a) => (
                  <tr key={a.id}>
                    <td>{new Date(a.created_at).toLocaleString('es-ES')}</td>
                    <td>{LABEL[a.kind] || a.kind}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{a.op_type || '—'}</td>
                    <td>{a.app_id || '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{a.credits > 0 ? '+' : ''}{num(a.credits)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{num(a.balance_after)}</td>
                    <td>
                      {a.tx_hash && EXPLORER[a.chain_id]
                        ? <a href={`${EXPLORER[a.chain_id]}${a.tx_hash}`} target="_blank" rel="noreferrer">ver</a>
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </GasTankGate>
    </div>
  );
}
