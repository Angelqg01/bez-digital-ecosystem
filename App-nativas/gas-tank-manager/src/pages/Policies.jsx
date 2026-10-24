import React, { useCallback, useEffect, useState } from 'react';
import { useGasTank, eur, num } from '../hooks/useGasTank';
import GasTankGate from '../components/GasTankGate';

/**
 * Política de patrocinio del Gas Tank (GET/PUT /gas-tank/policy): qué contratos y funciones
 * paga el tanque, con qué topes, y un simulador que dice si una operación se patrocinaría y
 * cuánto costaría sin reservar saldo. Exigir KYB no se edita aquí: es cumplimiento.
 */

const toEur = (credits, rate) => (credits == null ? '' : String(Math.round(credits * rate * 100) / 100));
const toCredits = (eurValue, rate) => Math.round(Number(eurValue) / rate);
const vacio = () => ({ address: '', selectors: '', label: '', maxFeeBez: '' });

function aFormulario(targets = []) {
  return targets.map((t) => ({ address: t.address, selectors: (t.selectors || []).join(', '), label: t.label || '', maxFeeBez: t.maxFeeBez ?? '' }));
}
function deFormulario(filas) {
  return filas
    .filter((f) => f.address.trim())
    .map((f) => ({
      address: f.address.trim(),
      selectors: f.selectors.split(/[,\n]/).map((s) => s.trim()).filter(Boolean),
      ...(f.label.trim() ? { label: f.label.trim() } : {}),
      ...(String(f.maxFeeBez).trim() !== '' ? { maxFeeBez: Number(f.maxFeeBez) } : {}),
    }));
}

export default function Policies() {
  const gas = useGasTank();
  const [datos, setDatos] = useState(null);
  const [filas, setFilas] = useState([]);
  const [activa, setActiva] = useState(false);
  const [porOp, setPorOp] = useState('5');
  const [diario, setDiario] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [apps, setApps] = useState([]);

  const cargar = useCallback(async () => {
    if (gas.reason) return;
    try {
      const [p, a] = await Promise.all([gas.call('policy'), gas.call('apps')]);
      setDatos(p);
      setApps(a.apps || []);
      setFilas(aFormulario(p.policy.allowedTargets));
      setActiva(p.policy.active);
      setPorOp(toEur(p.policy.maxCostCreditsPerOp, p.eurPerCredit));
      setDiario(toEur(p.policy.dailyCapCredits, p.eurPerCredit));
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
  }, [gas.reason, gas.call]);

  useEffect(() => { cargar(); }, [cargar]);

  const rate = datos?.eurPerCredit || 0.001;
  const editable = gas.canEditPolicy;
  const kyb = datos?.policy?.verificationStatus;

  const usarPlantilla = (t) => {
    const ya = new Set(filas.map((f) => f.address.toLowerCase()));
    setFilas([...filas, ...aFormulario(t.targets.filter((x) => !ya.has(x.address.toLowerCase())))]);
  };
  const cambiar = (i, campo, v) => setFilas(filas.map((f, j) => (j === i ? { ...f, [campo]: v } : f)));

  const guardar = async () => {
    setBusy(true); setMsg(null);
    try {
      const body = {
        active: activa,
        allowedTargets: deFormulario(filas),
        maxCostCreditsPerOp: toCredits(porOp, rate),
        dailyCapCredits: diario === '' ? null : toCredits(diario, rate),
      };
      const r = await gas.call('policy', { method: 'PUT', body: JSON.stringify(body) });
      setDatos({ ...datos, policy: r.policy });
      setFilas(aFormulario(r.policy.allowedTargets));
      setMsg({ ok: true, text: 'Política guardada.' });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="page-header animate-in">
        <h1 className="page-title">Políticas de patrocinio</h1>
        <p className="page-subtitle">Qué operaciones paga el Gas Tank de tu organización, con qué topes, y cuánto costarían</p>
      </div>

      <GasTankGate gas={gas}>
        {!datos ? (
          <div className="card">{msg ? <span role="alert">{msg.text}</span> : 'Cargando…'}</div>
        ) : (
          <>
            {kyb !== 'verified' && (
              <div role="status" className="card animate-in" style={{ borderColor: 'var(--bezhas-warning)' }}>
                Tu organización aún no tiene el KYB verificado ({kyb || 'sin iniciar'}). Puedes preparar la política,
                pero no se patrocinará nada hasta completar la verificación en el Hub.
              </div>
            )}

            <div className="card animate-in-d1">
              <div className="card-header">
                <span className="card-title">Política {activa ? 'activa' : 'inactiva'}</span>
                <button className={`toggle ${activa ? 'on' : ''}`} disabled={!editable} aria-pressed={activa}
                  aria-label="Activar la política" onClick={() => setActiva(!activa)}><div className="toggle-knob" /></button>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--bezhas-text-muted)' }}>
                Sin política activa no se patrocina nada. Cada llamada de una operación tiene que estar en esta lista:
                si una no lo está, se rechaza la operación entera.
              </p>

              <div className="card-title" style={{ margin: '1rem 0 0.5rem' }}>Plantillas</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {datos.templates.map((t) => (
                  <button key={t.id} className="btn-secondary" disabled={!editable} title={t.descripcion}
                    aria-label={`Añadir plantilla: ${t.nombre}`} onClick={() => usarPlantilla(t)}>
                    + {t.nombre}
                  </button>
                ))}
              </div>

              <div className="card-title" style={{ margin: '1rem 0 0.5rem' }}>Contratos y funciones permitidos</div>
              {filas.length === 0 && <p style={{ fontSize: '0.85rem' }}>Ninguno todavía. Empieza por una plantilla o añade un contrato.</p>}
              {filas.map((f, i) => (
                <div key={i} className="card" style={{ marginBottom: '0.5rem' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor={`addr-${i}`}>Contrato</label>
                    <input id={`addr-${i}`} className="form-input" value={f.address} disabled={!editable} placeholder="0x…" onChange={(e) => cambiar(i, 'address', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor={`sel-${i}`}>Funciones (selector 0x12345678 o firma, separadas por comas)</label>
                    <input id={`sel-${i}`} className="form-input" value={f.selectors} disabled={!editable} placeholder="tokenizeAsset(string,uint8,…)" onChange={(e) => cambiar(i, 'selectors', e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div className="form-group" style={{ flex: 2 }}>
                      <label className="form-label" htmlFor={`lab-${i}`}>Etiqueta</label>
                      <input id={`lab-${i}`} className="form-input" value={f.label} disabled={!editable} onChange={(e) => cambiar(i, 'label', e.target.value)} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label" htmlFor={`fee-${i}`}>Comisión máx. (BEZ)</label>
                      <input id={`fee-${i}`} className="form-input" type="number" min="0" value={f.maxFeeBez} disabled={!editable} onChange={(e) => cambiar(i, 'maxFeeBez', e.target.value)} />
                    </div>
                  </div>
                  {editable && <button className="btn-secondary" onClick={() => setFilas(filas.filter((_, j) => j !== i))}>Quitar</button>}
                </div>
              ))}
              {editable && <button className="btn-secondary" onClick={() => setFilas([...filas, vacio()])}>+ Añadir contrato</button>}

              <div className="card-title" style={{ margin: '1rem 0 0.5rem' }}>Presupuestos</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
                  <label className="form-label" htmlFor="porop">Tope por operación (€)</label>
                  <input id="porop" className="form-input" type="number" min="0.01" step="0.01" value={porOp} disabled={!editable} onChange={(e) => setPorOp(e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
                  <label className="form-label" htmlFor="diario">Tope diario (€, vacío = sin tope)</label>
                  <input id="diario" className="form-input" type="number" min="0.01" step="0.01" value={diario} disabled={!editable} onChange={(e) => setDiario(e.target.value)} />
                </div>
              </div>

              {msg && <div role={msg.ok ? 'status' : 'alert'} style={{ margin: '0.5rem 0', color: msg.ok ? 'var(--bezhas-success)' : 'var(--bezhas-warning)' }}>{msg.text}</div>}
              {editable
                ? <button className="btn-primary" disabled={busy} onClick={guardar}>{busy ? 'Guardando…' : 'Guardar política'}</button>
                : <p style={{ fontSize: '0.85rem' }}>Sólo el propietario o un administrador pueden cambiar la política.</p>}
            </div>

            <Simulador gas={gas} filas={filas} rate={rate} />
            <Apps apps={apps} />
          </>
        )}
      </GasTankGate>
    </div>
  );
}

function Simulador({ gas, filas, rate }) {
  const primera = filas[0];
  const [target, setTarget] = useState('');
  const [selector, setSelector] = useState('');
  const [gasUsed, setGasUsed] = useState('350000');
  const [gwei, setGwei] = useState('50');
  const [fee, setFee] = useState('0');
  const [res, setRes] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (primera && !target) {
      setTarget(primera.address);
      setSelector(primera.selectors.split(',')[0]?.trim() || '');
      if (primera.maxFeeBez !== '') setFee(String(primera.maxFeeBez));
    }
  }, [primera, target]);

  const simular = async () => {
    setError(null); setRes(null);
    try {
      setRes(await gas.call('simulate', {
        method: 'POST',
        body: JSON.stringify({ calls: [{ target: target.trim(), selector: selector.trim() }], gasUsed: Number(gasUsed), gasPriceGwei: Number(gwei), protocolFeeBez: Number(fee) }),
      }));
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="card animate-in-d2">
      <div className="card-header"><span className="card-title">Simulador</span></div>
      <p style={{ fontSize: '0.85rem', color: 'var(--bezhas-text-muted)' }}>
        Comprueba una operación contra la política guardada. No reserva saldo ni firma nada.
      </p>
      <div className="form-group">
        <label className="form-label" htmlFor="sim-t">Contrato</label>
        <input id="sim-t" className="form-input" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="0x…" />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="sim-s">Función</label>
        <input id="sim-s" className="form-input" value={selector} onChange={(e) => setSelector(e.target.value)} placeholder="0x12345678 o nombre(tipos)" />
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
          <label className="form-label" htmlFor="sim-g">Gas estimado</label>
          <input id="sim-g" className="form-input" type="number" min="0" value={gasUsed} onChange={(e) => setGasUsed(e.target.value)} />
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
          <label className="form-label" htmlFor="sim-p">Precio del gas (gwei)</label>
          <input id="sim-p" className="form-input" type="number" min="0" value={gwei} onChange={(e) => setGwei(e.target.value)} />
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
          <label className="form-label" htmlFor="sim-f">Comisión (BEZ)</label>
          <input id="sim-f" className="form-input" type="number" min="0" value={fee} onChange={(e) => setFee(e.target.value)} />
        </div>
      </div>
      <button className="btn-primary" disabled={!target || !selector} onClick={simular}>Simular</button>

      {error && <div role="alert" style={{ marginTop: '0.75rem', color: 'var(--bezhas-warning)' }}>{error}</div>}
      {res && (
        <div role="status" style={{ marginTop: '0.75rem' }}>
          <strong style={{ color: res.patrocinable ? 'var(--bezhas-success)' : 'var(--bezhas-warning)' }}>
            {res.patrocinable ? 'Se patrocinaría' : 'No se patrocinaría'}
          </strong>
          {res.coste && <> · coste estimado {eur(res.coste.eur)} ({num(res.coste.credits)} créditos, margen {Math.round(res.coste.supuestos.markup * 100)} %)</>}
          {res.saldoCredits != null && <> · saldo {eur(res.saldoCredits * rate)}</>}
          {res.motivos.length > 0 && (
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem', fontSize: '0.85rem' }}>
              {res.motivos.map((m, i) => <li key={i}>{m.mensaje}</li>)}
            </ul>
          )}
          <p style={{ fontSize: '0.8rem', color: 'var(--bezhas-text-muted)', marginTop: '0.5rem' }}>{res.nota}</p>
        </div>
      )}
    </div>
  );
}

function Apps({ apps }) {
  return (
    <div className="card animate-in-d3">
      <div className="card-header"><span className="card-title">Apps y URL del paymaster (ERC-7677)</span></div>
      <p style={{ fontSize: '0.85rem', color: 'var(--bezhas-text-muted)' }}>
        Pon esta URL como paymaster service en tu SDK (viem, permissionless, AppKit) con la api-key de la app en la cabecera
        <code> x-api-key</code>, o al final de la URL si tu wallet no permite cabeceras. La app necesita el permiso <code>gas</code>.
      </p>
      {apps.length === 0 ? (
        <p style={{ fontSize: '0.85rem' }}>Tu organización todavía no tiene apps. Créalas desde la consola de desarrolladores del Hub.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
        <table className="usage-table">
          <thead><tr><th>App</th><th>Permiso gas</th><th>URL</th></tr></thead>
          <tbody>
            {apps.map((a) => (
              <tr key={a.id}>
                <td>{a.nombre}{!a.activa && ' (inactiva)'}</td>
                <td>{a.scopeGas ? 'Sí' : 'No: pídelo a BeZhas'}</td>
                <td><code title={a.paymasterUrlConClave}>{a.paymasterUrl}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
