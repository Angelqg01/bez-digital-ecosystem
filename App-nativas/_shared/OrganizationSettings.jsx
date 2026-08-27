/**
 * OrganizationSettings — panel único que conecta las 4 fases del registro
 * extendido con la API que ya existe (routes/organizations.js,
 * organization-tech.js, organization-billing.js): Organización (legal/fiscal
 * + equipo con rol), KYB (documentos + envío a revisión), Blockchain
 * (wallets, RPC/oráculos, contratos) y Facturación (método de pago vía
 * Stripe, contactos, facturas).
 *
 * Vive en _shared/ igual que BezhasAuthProvider — una sola vez, montado donde
 * cada SubApp decida (normalmente una ruta /organization).
 *
 * Cada pestaña gatea su propia escritura con hasOrgRole(): Organización y
 * KYB para owner/admin, Blockchain también para developer, Facturación
 * también para financial — igual que en el backend, así la UI nunca ofrece
 * un botón que la API va a rechazar de todas formas.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './BezhasAuthProvider.jsx';

const ORG_ROLES = ['owner', 'admin', 'developer', 'auditor', 'financial', 'operator'];
const KYB_DOC_TYPES = ['incorporation_certificate', 'tax_id_proof', 'legal_representative_id', 'proof_of_address', 'other'];
const KYB_DOC_LABELS = {
  incorporation_certificate: 'Certificado de constitución',
  tax_id_proof: 'Justificante NIF/CIF',
  legal_representative_id: 'ID del representante legal',
  proof_of_address: 'Prueba de domicilio',
  other: 'Otro',
};
const WALLET_TYPES = ['eoa', 'multisig', 'safe'];
const TOKEN_STANDARDS = ['ERC-20', 'ERC-721', 'ERC-1155', 'ERC-1400', 'other'];
const CONTACT_TYPE_LABELS = { administrative: 'Administrativo', technical: 'Técnico', security: 'Seguridad' };
const VERIFICATION_COLORS = { unverified: '#64748b', pending: '#f59e0b', verified: '#10b981', rejected: '#ef4444' };
const DOC_STATUS_COLORS = { pending: '#f59e0b', approved: '#10b981', rejected: '#ef4444' };

const TABS = [
  { key: 'org', label: 'Organización' },
  { key: 'kyb', label: 'KYB' },
  { key: 'tech', label: 'Blockchain' },
  { key: 'billing', label: 'Facturación' },
];

function envVar(name) {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) return import.meta.env[name];
  } catch { /* no es un entorno de módulos Vite */ }
  return undefined;
}

async function apiFetch(url, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.errors?.[0]?.msg || `Error ${res.status}`);
  }
  return data;
}

let stripeJsPromise = null;
function loadStripeJs() {
  if (typeof window !== 'undefined' && window.Stripe) return Promise.resolve(window.Stripe);
  if (stripeJsPromise) return stripeJsPromise;
  stripeJsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.onload = () => resolve(window.Stripe);
    script.onerror = () => reject(new Error('No se pudo cargar Stripe.js'));
    document.head.appendChild(script);
  });
  return stripeJsPromise;
}

// ── Estilos compartidos por las 4 pestañas ──────────────────────────────────

const S = {
  page: { padding: 24, maxWidth: 960, margin: '0 auto', color: '#e2e8f0' },
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 20, marginBottom: 16 },
  label: { display: 'block', fontSize: 10, textTransform: 'uppercase', color: '#64748b', fontWeight: 800, marginBottom: 6, letterSpacing: 0.5 },
  input: { width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '9px 12px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', padding: '8px 10px', color: '#64748b', fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.08)' },
  td: { padding: '10px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  btnGhost: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#e2e8f0', padding: '7px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' },
  btnDanger: { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, color: '#ef4444', padding: '7px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' },
  h3: { fontSize: 14, fontWeight: 800, color: '#fff', margin: '0 0 14px' },
};
const btn = (accent, disabled) => ({
  background: accent, border: 'none', borderRadius: 10, color: '#04070f',
  padding: '9px 18px', fontSize: 12, fontWeight: 800,
  cursor: disabled ? 'wait' : 'pointer', opacity: disabled ? 0.6 : 1,
});
const badge = (color) => ({
  fontSize: 10, fontWeight: 800, textTransform: 'uppercase', padding: '3px 10px',
  borderRadius: 20, background: `${color}22`, color,
});
const notice = (ok) => ({
  background: ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
  border: `1px solid ${ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
  color: ok ? '#10b981' : '#ef4444',
  padding: '10px 14px', borderRadius: 10, fontSize: 11, marginBottom: 12, fontWeight: 600,
});

function Field({ label, value, onChange, disabled, type = 'text', placeholder, textarea }) {
  const shared = {
    value: value || '', onChange: (e) => onChange(e.target.value), disabled,
    placeholder, style: { ...S.input, opacity: disabled ? 0.6 : 1 },
  };
  return (
    <div>
      <label style={S.label}>{label}</label>
      {textarea ? <textarea {...shared} rows={3} /> : <input type={type} {...shared} />}
    </div>
  );
}

// ── Pestaña: Organización (legal/fiscal + equipo) ───────────────────────────

function pickOrgFields(org) {
  return {
    name: org.name || '', legal_name: org.legal_name || '', tax_id: org.tax_id || '',
    country: org.country || '', fiscal_address: org.fiscal_address || '',
    legal_representative_name: org.legal_representative_name || '',
    legal_representative_id: org.legal_representative_id || '',
  };
}

function OrgTab({ org, orgId, apiBase, authHeaders, accent, canWrite, refreshOrganizations }) {
  const [form, setForm] = useState(() => pickOrgFields(org));
  const [members, setMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('operator');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => { setForm(pickOrgFields(org)); }, [org]);

  const loadMembers = useCallback(async () => {
    try {
      const data = await apiFetch(`${apiBase}/api/organizations/${orgId}/members`, { headers: authHeaders() });
      setMembers(data.members || []);
    } catch (e) { setError(e.message); }
  }, [apiBase, orgId, authHeaders]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const saveOrg = async (e) => {
    e.preventDefault();
    setError(''); setSaved(false); setBusy('save');
    try {
      await apiFetch(`${apiBase}/api/organizations/${orgId}`, { method: 'PATCH', headers: authHeaders(), body: form });
      await refreshOrganizations();
      setSaved(true);
    } catch (e) { setError(e.message); } finally { setBusy(''); }
  };

  const invite = async (e) => {
    e.preventDefault();
    setError(''); setBusy('invite');
    try {
      await apiFetch(`${apiBase}/api/organizations/${orgId}/members`, { method: 'POST', headers: authHeaders(), body: { email: inviteEmail, role: inviteRole } });
      setInviteEmail('');
      await loadMembers();
    } catch (e) { setError(e.message); } finally { setBusy(''); }
  };

  const changeRole = async (memberId, role) => {
    try {
      await apiFetch(`${apiBase}/api/organizations/${orgId}/members/${memberId}`, { method: 'PATCH', headers: authHeaders(), body: { role } });
      await loadMembers();
    } catch (e) { setError(e.message); }
  };

  const removeMember = async (memberId) => {
    try {
      await apiFetch(`${apiBase}/api/organizations/${orgId}/members/${memberId}`, { method: 'DELETE', headers: authHeaders() });
      await loadMembers();
    } catch (e) { setError(e.message); }
  };

  return (
    <div>
      {error && <div style={notice(false)}>{error}</div>}
      {saved && <div style={notice(true)}>Guardado.</div>}

      <div style={S.card}>
        <h3 style={S.h3}>Datos legales y fiscales</h3>
        <form onSubmit={saveOrg} style={{ display: 'grid', gap: 12 }}>
          <Field label="Nombre comercial" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} disabled={!canWrite} />
          <div style={S.row}>
            <Field label="Razón social" value={form.legal_name} onChange={(v) => setForm((f) => ({ ...f, legal_name: v }))} disabled={!canWrite} />
            <Field label="NIF/CIF" value={form.tax_id} onChange={(v) => setForm((f) => ({ ...f, tax_id: v }))} disabled={!canWrite} />
          </div>
          <div style={S.row}>
            <Field label="País (ISO-2)" value={form.country} onChange={(v) => setForm((f) => ({ ...f, country: v.toUpperCase().slice(0, 2) }))} disabled={!canWrite} />
            <Field label="Representante legal" value={form.legal_representative_name} onChange={(v) => setForm((f) => ({ ...f, legal_representative_name: v }))} disabled={!canWrite} />
          </div>
          <div style={S.row}>
            <Field label="ID del representante (DNI/NIE/pasaporte)" value={form.legal_representative_id} onChange={(v) => setForm((f) => ({ ...f, legal_representative_id: v }))} disabled={!canWrite} />
            <div />
          </div>
          <Field label="Dirección fiscal" value={form.fiscal_address} onChange={(v) => setForm((f) => ({ ...f, fiscal_address: v }))} disabled={!canWrite} textarea />
          {canWrite && <button type="submit" disabled={busy === 'save'} style={btn(accent, busy === 'save')}>{busy === 'save' ? 'Guardando…' : 'Guardar'}</button>}
        </form>
      </div>

      <div style={S.card}>
        <h3 style={S.h3}>Equipo ({members.length})</h3>
        <table style={S.table}>
          <thead>
            <tr><th style={S.th}>Usuario</th><th style={S.th}>Rol</th>{canWrite && <th style={S.th} />}</tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td style={S.td}>{m.username || m.email}</td>
                <td style={S.td}>
                  {canWrite ? (
                    <select value={m.role} onChange={(e) => changeRole(m.id, e.target.value)} style={{ ...S.input, padding: '4px 8px' }}>
                      {ORG_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  ) : m.role}
                </td>
                {canWrite && <td style={S.td}><button onClick={() => removeMember(m.id)} style={S.btnDanger}>Quitar</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
        {canWrite && (
          <form onSubmit={invite} style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <input placeholder="email@empresa.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} style={{ ...S.input, flex: 1, minWidth: 180 }} />
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} style={S.input}>
              {ORG_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button type="submit" disabled={busy === 'invite'} style={btn(accent, busy === 'invite')}>Invitar</button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Pestaña: KYB ─────────────────────────────────────────────────────────

function KybTab({ org, orgId, apiBase, authHeaders, accent, canWrite }) {
  const [docs, setDocs] = useState([]);
  const [docType, setDocType] = useState(KYB_DOC_TYPES[0]);
  const [fileName, setFileName] = useState('');
  const [storageUrl, setStorageUrl] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(`${apiBase}/api/organizations/${orgId}/documents`, { headers: authHeaders() });
      setDocs(data.documents || []);
    } catch (e) { setError(e.message); }
  }, [apiBase, orgId, authHeaders]);

  useEffect(() => { load(); }, [load]);

  const upload = async (e) => {
    e.preventDefault();
    setError('');
    if (!fileName || !storageUrl) return setError('Nombre de archivo y URL requeridos.');
    setBusy('upload');
    try {
      await apiFetch(`${apiBase}/api/organizations/${orgId}/documents`, { method: 'POST', headers: authHeaders(), body: { docType, fileName, storageUrl } });
      setFileName(''); setStorageUrl('');
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(''); }
  };

  const removeDoc = async (id) => {
    try {
      await apiFetch(`${apiBase}/api/organizations/${orgId}/documents/${id}`, { method: 'DELETE', headers: authHeaders() });
      await load();
    } catch (e) { setError(e.message); }
  };

  const submit = async () => {
    setError(''); setOkMsg(''); setBusy('submit');
    try {
      await apiFetch(`${apiBase}/api/organizations/${orgId}/kyb/submit`, { method: 'POST', headers: authHeaders() });
      setOkMsg('Enviado a revisión.');
    } catch (e) { setError(e.message); } finally { setBusy(''); }
  };

  const canSubmit = canWrite && !['verified', 'pending'].includes(org.verification_status);

  return (
    <div>
      {error && <div style={notice(false)}>{error}</div>}
      {okMsg && <div style={notice(true)}>{okMsg}</div>}

      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={S.h3}>Estado de verificación</h3>
          <span style={badge(VERIFICATION_COLORS[org.verification_status] || '#64748b')}>{org.verification_status}</span>
        </div>
        {org.verification_notes && <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>{org.verification_notes}</p>}
        {canSubmit && (
          <button onClick={submit} disabled={busy === 'submit'} style={{ ...btn(accent, busy === 'submit'), marginTop: 12 }}>
            {busy === 'submit' ? 'Enviando…' : 'Enviar a revisión'}
          </button>
        )}
      </div>

      <div style={S.card}>
        <h3 style={S.h3}>Documentos ({docs.length})</h3>
        <table style={S.table}>
          <thead>
            <tr><th style={S.th}>Tipo</th><th style={S.th}>Archivo</th><th style={S.th}>Estado</th>{canWrite && <th style={S.th} />}</tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td style={S.td}>{KYB_DOC_LABELS[d.doc_type] || d.doc_type}</td>
                <td style={S.td}>{d.file_name}</td>
                <td style={S.td}><span style={badge(DOC_STATUS_COLORS[d.status] || '#64748b')}>{d.status}</span></td>
                {canWrite && <td style={S.td}>{d.status === 'pending' && <button onClick={() => removeDoc(d.id)} style={S.btnDanger}>Quitar</button>}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {canWrite && (
          <form onSubmit={upload} style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            <div style={S.row}>
              <div>
                <label style={S.label}>Tipo de documento</label>
                <select value={docType} onChange={(e) => setDocType(e.target.value)} style={S.input}>
                  {KYB_DOC_TYPES.map((t) => <option key={t} value={t}>{KYB_DOC_LABELS[t]}</option>)}
                </select>
              </div>
              <Field label="Nombre del archivo" value={fileName} onChange={setFileName} />
            </div>
            <Field label="URL del archivo (ya subido a tu storage)" value={storageUrl} onChange={setStorageUrl} placeholder="https://..." />
            <button type="submit" disabled={busy === 'upload'} style={btn(accent, busy === 'upload')}>{busy === 'upload' ? 'Adjuntando…' : 'Adjuntar documento'}</button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Pestaña: Blockchain (wallets, RPC/oráculos, contratos) ─────────────────

function TechTab({ orgId, apiBase, authHeaders, accent, canWrite }) {
  const [wallets, setWallets] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const [walletForm, setWalletForm] = useState({ address: '', chainId: '137', walletType: 'eoa', label: '' });
  const [credForm, setCredForm] = useState({ category: 'rpc_provider', provider: '', chainId: '', label: '', secret: '' });
  const [contractForm, setContractForm] = useState({ tokenStandard: 'ERC-20', name: '', chainId: '137', address: '', notes: '' });

  const load = useCallback(async () => {
    try {
      const [w, c, k] = await Promise.all([
        apiFetch(`${apiBase}/api/organizations/${orgId}/wallets`, { headers: authHeaders() }),
        apiFetch(`${apiBase}/api/organizations/${orgId}/credentials`, { headers: authHeaders() }),
        apiFetch(`${apiBase}/api/organizations/${orgId}/contract-configs`, { headers: authHeaders() }),
      ]);
      setWallets(w.wallets || []); setCredentials(c.credentials || []); setContracts(k.contractConfigs || []);
    } catch (e) { setError(e.message); }
  }, [apiBase, orgId, authHeaders]);

  useEffect(() => { load(); }, [load]);

  const addWallet = async (e) => {
    e.preventDefault(); setError(''); setBusy('wallet');
    try {
      await apiFetch(`${apiBase}/api/organizations/${orgId}/wallets`, { method: 'POST', headers: authHeaders(), body: { ...walletForm, chainId: Number(walletForm.chainId) } });
      setWalletForm({ address: '', chainId: '137', walletType: 'eoa', label: '' });
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(''); }
  };
  const setPrimary = async (id) => {
    try { await apiFetch(`${apiBase}/api/organizations/${orgId}/wallets/${id}/primary`, { method: 'PATCH', headers: authHeaders() }); await load(); }
    catch (e) { setError(e.message); }
  };
  const removeWallet = async (id) => {
    try { await apiFetch(`${apiBase}/api/organizations/${orgId}/wallets/${id}`, { method: 'DELETE', headers: authHeaders() }); await load(); }
    catch (e) { setError(e.message); }
  };

  const addCred = async (e) => {
    e.preventDefault(); setError(''); setBusy('cred');
    try {
      await apiFetch(`${apiBase}/api/organizations/${orgId}/credentials`, {
        method: 'POST', headers: authHeaders(),
        body: { ...credForm, chainId: credForm.chainId ? Number(credForm.chainId) : undefined },
      });
      setCredForm({ category: 'rpc_provider', provider: '', chainId: '', label: '', secret: '' });
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(''); }
  };
  const toggleCred = async (id, isActive) => {
    try { await apiFetch(`${apiBase}/api/organizations/${orgId}/credentials/${id}`, { method: 'PATCH', headers: authHeaders(), body: { isActive } }); await load(); }
    catch (e) { setError(e.message); }
  };
  const removeCred = async (id) => {
    try { await apiFetch(`${apiBase}/api/organizations/${orgId}/credentials/${id}`, { method: 'DELETE', headers: authHeaders() }); await load(); }
    catch (e) { setError(e.message); }
  };

  const addContract = async (e) => {
    e.preventDefault(); setError(''); setBusy('contract');
    try {
      await apiFetch(`${apiBase}/api/organizations/${orgId}/contract-configs`, {
        method: 'POST', headers: authHeaders(),
        body: { ...contractForm, chainId: Number(contractForm.chainId), address: contractForm.address || undefined },
      });
      setContractForm({ tokenStandard: 'ERC-20', name: '', chainId: '137', address: '', notes: '' });
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(''); }
  };
  const removeContract = async (id) => {
    try { await apiFetch(`${apiBase}/api/organizations/${orgId}/contract-configs/${id}`, { method: 'DELETE', headers: authHeaders() }); await load(); }
    catch (e) { setError(e.message); }
  };

  return (
    <div>
      {error && <div style={notice(false)}>{error}</div>}

      <div style={S.card}>
        <h3 style={S.h3}>Wallets corporativas</h3>
        <table style={S.table}>
          <thead>
            <tr><th style={S.th}>Dirección</th><th style={S.th}>Red</th><th style={S.th}>Tipo</th>{canWrite && <th style={S.th} />}</tr>
          </thead>
          <tbody>
            {wallets.map((w) => (
              <tr key={w.id}>
                <td style={S.td}>
                  {w.address.slice(0, 6)}…{w.address.slice(-4)}{' '}
                  {w.is_primary && <span style={badge(accent)}>primaria</span>}
                </td>
                <td style={S.td}>{w.chain_id}</td>
                <td style={S.td}>{w.wallet_type}</td>
                {canWrite && (
                  <td style={S.td}>
                    {!w.is_primary && <button onClick={() => setPrimary(w.id)} style={{ ...S.btnGhost, marginRight: 6 }}>Marcar primaria</button>}
                    <button onClick={() => removeWallet(w.id)} style={S.btnDanger}>Quitar</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {canWrite && (
          <form onSubmit={addWallet} style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            <div style={S.row}>
              <Field label="Dirección (0x…)" value={walletForm.address} onChange={(v) => setWalletForm((f) => ({ ...f, address: v }))} />
              <Field label="Chain ID" value={walletForm.chainId} onChange={(v) => setWalletForm((f) => ({ ...f, chainId: v }))} />
            </div>
            <div style={S.row}>
              <div>
                <label style={S.label}>Tipo</label>
                <select value={walletForm.walletType} onChange={(e) => setWalletForm((f) => ({ ...f, walletType: e.target.value }))} style={S.input}>
                  {WALLET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <Field label="Etiqueta" value={walletForm.label} onChange={(v) => setWalletForm((f) => ({ ...f, label: v }))} />
            </div>
            <button type="submit" disabled={busy === 'wallet'} style={btn(accent, busy === 'wallet')}>Registrar wallet</button>
          </form>
        )}
      </div>

      <div style={S.card}>
        <h3 style={S.h3}>RPC y oráculos</h3>
        <table style={S.table}>
          <thead>
            <tr><th style={S.th}>Etiqueta</th><th style={S.th}>Proveedor</th><th style={S.th}>Categoría</th><th style={S.th}>Secreto</th><th style={S.th}>Estado</th>{canWrite && <th style={S.th} />}</tr>
          </thead>
          <tbody>
            {credentials.map((c) => (
              <tr key={c.id}>
                <td style={S.td}>{c.label}</td>
                <td style={S.td}>{c.provider}</td>
                <td style={S.td}>{c.category === 'rpc_provider' ? 'RPC' : 'Oráculo'}</td>
                <td style={S.td}><code>{c.secretPreview}</code></td>
                <td style={S.td}><span style={badge(c.is_active ? '#10b981' : '#64748b')}>{c.is_active ? 'activa' : 'inactiva'}</span></td>
                {canWrite && (
                  <td style={S.td}>
                    <button onClick={() => toggleCred(c.id, !c.is_active)} style={{ ...S.btnGhost, marginRight: 6 }}>{c.is_active ? 'Desactivar' : 'Activar'}</button>
                    <button onClick={() => removeCred(c.id)} style={S.btnDanger}>Borrar</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {canWrite && (
          <form onSubmit={addCred} style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            <div style={S.row}>
              <div>
                <label style={S.label}>Categoría</label>
                <select value={credForm.category} onChange={(e) => setCredForm((f) => ({ ...f, category: e.target.value }))} style={S.input}>
                  <option value="rpc_provider">RPC provider</option>
                  <option value="oracle">Oráculo</option>
                </select>
              </div>
              <Field label="Proveedor (alchemy, infura, chainlink…)" value={credForm.provider} onChange={(v) => setCredForm((f) => ({ ...f, provider: v }))} />
            </div>
            <div style={S.row}>
              <Field label="Etiqueta" value={credForm.label} onChange={(v) => setCredForm((f) => ({ ...f, label: v }))} />
              <Field label="Chain ID (opcional)" value={credForm.chainId} onChange={(v) => setCredForm((f) => ({ ...f, chainId: v }))} />
            </div>
            <Field label="API key / URL con key" value={credForm.secret} onChange={(v) => setCredForm((f) => ({ ...f, secret: v }))} type="password" />
            <button type="submit" disabled={busy === 'cred'} style={btn(accent, busy === 'cred')}>Guardar credencial</button>
          </form>
        )}
      </div>

      <div style={S.card}>
        <h3 style={S.h3}>Smart contracts</h3>
        <table style={S.table}>
          <thead>
            <tr><th style={S.th}>Nombre</th><th style={S.th}>Estándar</th><th style={S.th}>Red</th><th style={S.th}>Dirección</th>{canWrite && <th style={S.th} />}</tr>
          </thead>
          <tbody>
            {contracts.map((c) => (
              <tr key={c.id}>
                <td style={S.td}>{c.name}</td>
                <td style={S.td}>{c.token_standard}</td>
                <td style={S.td}>{c.chain_id}</td>
                <td style={S.td}>{c.address ? `${c.address.slice(0, 6)}…${c.address.slice(-4)}` : '—'}</td>
                {canWrite && <td style={S.td}><button onClick={() => removeContract(c.id)} style={S.btnDanger}>Borrar</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
        {canWrite && (
          <form onSubmit={addContract} style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            <div style={S.row}>
              <Field label="Nombre" value={contractForm.name} onChange={(v) => setContractForm((f) => ({ ...f, name: v }))} />
              <div>
                <label style={S.label}>Estándar</label>
                <select value={contractForm.tokenStandard} onChange={(e) => setContractForm((f) => ({ ...f, tokenStandard: e.target.value }))} style={S.input}>
                  {TOKEN_STANDARDS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div style={S.row}>
              <Field label="Chain ID" value={contractForm.chainId} onChange={(v) => setContractForm((f) => ({ ...f, chainId: v }))} />
              <Field label="Dirección desplegada (opcional)" value={contractForm.address} onChange={(v) => setContractForm((f) => ({ ...f, address: v }))} />
            </div>
            <Field label="Notas" value={contractForm.notes} onChange={(v) => setContractForm((f) => ({ ...f, notes: v }))} />
            <button type="submit" disabled={busy === 'contract'} style={btn(accent, busy === 'contract')}>Registrar contrato</button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Pestaña: Facturación ─────────────────────────────────────────────────

function BillingTab({ orgId, apiBase, authHeaders, accent, canWrite }) {
  const [profile, setProfile] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [contactForm, setContactForm] = useState({ contactType: 'administrative', name: '', email: '', phone: '' });
  const [cardCapture, setCardCapture] = useState(false);
  const elementRef = useRef(null);
  const stripeRef = useRef(null);
  const elementsRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const [p, c, inv] = await Promise.all([
        apiFetch(`${apiBase}/api/organizations/${orgId}/billing`, { headers: authHeaders() }),
        apiFetch(`${apiBase}/api/organizations/${orgId}/billing/contacts`, { headers: authHeaders() }),
        apiFetch(`${apiBase}/api/organizations/${orgId}/billing/invoices`, { headers: authHeaders() }),
      ]);
      setProfile(p.billingProfile); setContacts(c.contacts || []); setInvoices(inv.invoices || []);
    } catch (e) { setError(e.message); }
  }, [apiBase, orgId, authHeaders]);

  useEffect(() => { load(); }, [load]);

  const saveProfile = async (e) => {
    e.preventDefault(); setError(''); setOkMsg(''); setBusy('profile');
    try {
      await apiFetch(`${apiBase}/api/organizations/${orgId}/billing`, {
        method: 'PATCH', headers: authHeaders(),
        body: {
          billingEmail: profile.billing_email || undefined,
          einvoicingEnabled: profile.einvoicing_enabled,
          einvoicingFormat: profile.einvoicing_enabled ? (profile.einvoicing_format || 'facturae') : undefined,
        },
      });
      setOkMsg('Guardado.');
    } catch (e) { setError(e.message); } finally { setBusy(''); }
  };

  const startCardCapture = async () => {
    setError(''); setBusy('setup');
    try {
      const publishableKey = envVar('VITE_STRIPE_PUBLISHABLE_KEY');
      if (!publishableKey) throw new Error('Falta VITE_STRIPE_PUBLISHABLE_KEY en esta app.');
      const data = await apiFetch(`${apiBase}/api/organizations/${orgId}/billing/setup-intent`, {
        method: 'POST', headers: authHeaders(), body: { billingEmail: profile?.billing_email || undefined },
      });
      const StripeCtor = await loadStripeJs();
      const stripe = StripeCtor(publishableKey);
      const elements = stripe.elements({ clientSecret: data.clientSecret });
      const paymentElement = elements.create('payment');
      stripeRef.current = stripe; elementsRef.current = elements;
      setCardCapture(true);
      setTimeout(() => paymentElement.mount(elementRef.current), 0);
    } catch (e) { setError(e.message); } finally { setBusy(''); }
  };

  const confirmCard = async () => {
    setError(''); setBusy('confirm');
    try {
      const { setupIntent, error: stripeError } = await stripeRef.current.confirmSetup({
        elements: elementsRef.current,
        redirect: 'if_required',
        confirmParams: { return_url: window.location.href },
      });
      if (stripeError) throw new Error(stripeError.message);
      await apiFetch(`${apiBase}/api/organizations/${orgId}/billing/payment-method/confirm`, {
        method: 'POST', headers: authHeaders(), body: { paymentMethodId: setupIntent.payment_method },
      });
      setCardCapture(false);
      await load();
      setOkMsg('Método de pago guardado.');
    } catch (e) { setError(e.message); } finally { setBusy(''); }
  };

  const removePaymentMethod = async () => {
    setError(''); setBusy('remove');
    try {
      await apiFetch(`${apiBase}/api/organizations/${orgId}/billing/payment-method`, { method: 'DELETE', headers: authHeaders() });
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(''); }
  };

  const addContact = async (e) => {
    e.preventDefault(); setError(''); setBusy('contact');
    try {
      await apiFetch(`${apiBase}/api/organizations/${orgId}/billing/contacts`, { method: 'POST', headers: authHeaders(), body: contactForm });
      setContactForm({ contactType: 'administrative', name: '', email: '', phone: '' });
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(''); }
  };
  const removeContact = async (id) => {
    try { await apiFetch(`${apiBase}/api/organizations/${orgId}/billing/contacts/${id}`, { method: 'DELETE', headers: authHeaders() }); await load(); }
    catch (e) { setError(e.message); }
  };

  if (!profile) return error ? <div style={notice(false)}>{error}</div> : null;

  return (
    <div>
      {error && <div style={notice(false)}>{error}</div>}
      {okMsg && <div style={notice(true)}>{okMsg}</div>}

      <div style={S.card}>
        <h3 style={S.h3}>Método de pago</h3>
        {profile.hasPaymentMethod ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={badge('#10b981')}>{profile.payment_method_type}</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>termina en {profile.payment_method_last4}</span>
            {canWrite && <button onClick={removePaymentMethod} disabled={busy === 'remove'} style={S.btnDanger}>Quitar</button>}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>No hay ningún método de pago guardado.</p>
        )}
        {canWrite && !profile.hasPaymentMethod && !cardCapture && (
          <button onClick={startCardCapture} disabled={busy === 'setup'} style={{ ...btn(accent, busy === 'setup'), marginTop: 12 }}>
            {busy === 'setup' ? 'Preparando…' : 'Añadir tarjeta o SEPA'}
          </button>
        )}
        {cardCapture && (
          <div style={{ marginTop: 14 }}>
            <div ref={elementRef} style={{ marginBottom: 12 }} />
            <button onClick={confirmCard} disabled={busy === 'confirm'} style={btn(accent, busy === 'confirm')}>
              {busy === 'confirm' ? 'Guardando…' : 'Confirmar método de pago'}
            </button>
          </div>
        )}
      </div>

      <div style={S.card}>
        <h3 style={S.h3}>Facturación electrónica</h3>
        <form onSubmit={saveProfile} style={{ display: 'grid', gap: 12 }}>
          <Field label="Email de facturación" value={profile.billing_email} onChange={(v) => setProfile((p) => ({ ...p, billing_email: v }))} disabled={!canWrite} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <input type="checkbox" checked={!!profile.einvoicing_enabled} onChange={(e) => setProfile((p) => ({ ...p, einvoicing_enabled: e.target.checked }))} disabled={!canWrite} />
            Activar facturación electrónica
          </label>
          {profile.einvoicing_enabled && (
            <div>
              <label style={S.label}>Formato</label>
              <select value={profile.einvoicing_format || 'facturae'} onChange={(e) => setProfile((p) => ({ ...p, einvoicing_format: e.target.value }))} disabled={!canWrite} style={S.input}>
                <option value="facturae">Facturae</option>
                <option value="sii">SII</option>
                <option value="other">Otro</option>
              </select>
            </div>
          )}
          {canWrite && <button type="submit" disabled={busy === 'profile'} style={btn(accent, busy === 'profile')}>Guardar</button>}
        </form>
      </div>

      <div style={S.card}>
        <h3 style={S.h3}>Contactos</h3>
        <table style={S.table}>
          <thead>
            <tr><th style={S.th}>Tipo</th><th style={S.th}>Nombre</th><th style={S.th}>Email</th>{canWrite && <th style={S.th} />}</tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id}>
                <td style={S.td}>{CONTACT_TYPE_LABELS[c.contact_type]}</td>
                <td style={S.td}>{c.name}</td>
                <td style={S.td}>{c.email}</td>
                {canWrite && <td style={S.td}><button onClick={() => removeContact(c.id)} style={S.btnDanger}>Quitar</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
        {canWrite && (
          <form onSubmit={addContact} style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            <div style={S.row}>
              <div>
                <label style={S.label}>Tipo</label>
                <select value={contactForm.contactType} onChange={(e) => setContactForm((f) => ({ ...f, contactType: e.target.value }))} style={S.input}>
                  <option value="administrative">Administrativo</option>
                  <option value="technical">Técnico</option>
                  <option value="security">Seguridad</option>
                </select>
              </div>
              <Field label="Nombre" value={contactForm.name} onChange={(v) => setContactForm((f) => ({ ...f, name: v }))} />
            </div>
            <div style={S.row}>
              <Field label="Email" value={contactForm.email} onChange={(v) => setContactForm((f) => ({ ...f, email: v }))} />
              <Field label="Teléfono (opcional)" value={contactForm.phone} onChange={(v) => setContactForm((f) => ({ ...f, phone: v }))} />
            </div>
            <button type="submit" disabled={busy === 'contact'} style={btn(accent, busy === 'contact')}>Añadir contacto</button>
          </form>
        )}
      </div>

      <div style={S.card}>
        <h3 style={S.h3}>Facturas</h3>
        {invoices.length === 0 ? (
          <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>Sin facturas todavía.</p>
        ) : (
          <table style={S.table}>
            <thead>
              <tr><th style={S.th}>Nº</th><th style={S.th}>Estado</th><th style={S.th}>Importe</th><th style={S.th} /></tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id}>
                  <td style={S.td}>{i.number || i.id}</td>
                  <td style={S.td}>{i.status}</td>
                  <td style={S.td}>{(i.amountDue / 100).toFixed(2)} {i.currency?.toUpperCase()}</td>
                  <td style={S.td}>{i.hostedInvoiceUrl && <a href={i.hostedInvoiceUrl} target="_blank" rel="noreferrer" style={{ color: accent }}>Ver</a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Panel principal ─────────────────────────────────────────────────────

export function OrganizationSettingsPage() {
  const {
    isAuthenticated, isLoading, accent, apiBase, authHeaders,
    organizations, activeOrganization, switchOrganization, hasOrgRole, refreshOrganizations,
  } = useAuth();
  const [tab, setTab] = useState('org');

  if (isLoading) return null;

  if (!isAuthenticated) {
    return <div style={S.page}><div style={S.card}>Inicia sesión para gestionar tu organización.</div></div>;
  }
  if (!activeOrganization) {
    return <div style={S.page}><div style={S.card}>Crea una organización primero — botón "+ Crear empresa" en la cabecera.</div></div>;
  }

  const orgId = activeOrganization.id;
  const canWriteOrg = hasOrgRole('owner', 'admin');
  const canWriteTech = hasOrgRole('owner', 'admin', 'developer');
  const canWriteBilling = hasOrgRole('owner', 'admin', 'financial');

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0 }}>{activeOrganization.name}</h2>
        {organizations.length > 1 && (
          <select value={orgId} onChange={(e) => switchOrganization(e.target.value)} style={{ ...S.input, width: 'auto' }}>
            {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              background: tab === t.key ? accent : 'rgba(255,255,255,0.05)',
              color: tab === t.key ? '#04070f' : '#94a3b8',
              border: 'none', borderRadius: 20, padding: '8px 16px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'org' && (
        <OrgTab org={activeOrganization} orgId={orgId} apiBase={apiBase} authHeaders={authHeaders} accent={accent} canWrite={canWriteOrg} refreshOrganizations={refreshOrganizations} />
      )}
      {tab === 'kyb' && (
        <KybTab org={activeOrganization} orgId={orgId} apiBase={apiBase} authHeaders={authHeaders} accent={accent} canWrite={canWriteOrg} />
      )}
      {tab === 'tech' && (
        <TechTab orgId={orgId} apiBase={apiBase} authHeaders={authHeaders} accent={accent} canWrite={canWriteTech} />
      )}
      {tab === 'billing' && (
        <BillingTab orgId={orgId} apiBase={apiBase} authHeaders={authHeaders} accent={accent} canWrite={canWriteBilling} />
      )}
    </div>
  );
}

export default OrganizationSettingsPage;
