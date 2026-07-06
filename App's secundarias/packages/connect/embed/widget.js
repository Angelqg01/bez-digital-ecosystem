// embed/widget.js — the embeddable browser script.
//
// A 3rd-party platform drops ONE module script + declarative markup; BeZhas
// services render inside their own page. The "VSCode extension" surface for the
// open web — no npm, no PHP, no framework.
//
//   <script type="module"
//     src="https://embed.bez.digital/widget.js"
//     data-bezhas-key="pk_publishable_xxx"
//     data-bezhas-base="https://api.bez.digital"></script>
//
//   <div data-bezhas-widget="pay-button" data-amount="49.9" data-method="card"></div>
//   <div data-bezhas-widget="cargolink-track" data-buid="B-123" data-rolekey="..."></div>
//
// On load it auto-scans the DOM, mounts every [data-bezhas-widget], and wires
// each to the SDK. The publishable key is a PUBLIC, read-mostly key — never the
// server secret (buy() returns a hosted checkoutUrl; tracking is read-only).
//
// Auto-init is skipped when imported in a non-browser env (so core.js logic and
// this module stay importable under `node --test`).

import BeZhasConnect from '../src/client.js';
import { buildWidgetCall, resolveWidget } from './core.js';

const STYLE = `
.bez-w{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#e5e7eb}
.bez-btn{display:inline-flex;align-items:center;gap:.5rem;cursor:pointer;border:0;
  padding:.75rem 1.25rem;border-radius:.6rem;font-weight:700;letter-spacing:.03em;
  background:linear-gradient(90deg,#22d3ee,#a855f7);color:#080911;transition:transform .15s}
.bez-btn:hover{transform:scale(1.03)}
.bez-btn[disabled]{opacity:.6;cursor:wait;transform:none}
.bez-card{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);
  border-radius:.75rem;padding:1rem 1.25rem;backdrop-filter:blur(8px)}
.bez-row{display:flex;gap:.5rem;align-items:center}
.bez-input{flex:1;padding:.6rem .8rem;border-radius:.5rem;border:1px solid rgba(255,255,255,.15);
  background:rgba(0,0,0,.3);color:#fff}
.bez-muted{color:#9ca3af;font-size:.8rem}
.bez-err{color:#fda4af;font-size:.85rem;margin-top:.5rem}
.bez-step{display:flex;gap:.6rem;align-items:flex-start;padding:.35rem 0}
.bez-dot{width:.6rem;height:.6rem;border-radius:50%;background:#22d3ee;margin-top:.4rem;flex:0 0 auto}
`;

let stylesInjected = false;
function injectStyles(doc) {
  if (stylesInjected) return;
  const el = doc.createElement('style');
  el.textContent = STYLE;
  doc.head.appendChild(el);
  stylesInjected = true;
}

/** Read config from the currently-executing <script data-bezhas-*> tag. */
function readScriptConfig(doc) {
  const cur = doc.currentScript
    || [...doc.querySelectorAll('script[data-bezhas-key]')].pop();
  return {
    apiKey: cur?.dataset?.bezhasKey || null,
    baseUrl: cur?.dataset?.bezhasBase || undefined,
  };
}

function el(doc, tag, cls, text) {
  const n = doc.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

// ── Renderers per widget kind ────────────────────────────────────────────────

function renderPayButton(doc, mount, client, def, params) {
  const btn = el(doc, 'button', 'bez-btn', def.label);
  const err = el(doc, 'div', 'bez-err');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    err.textContent = '';
    try {
      const out = await client.service('pay').call('buy', params);
      if (out.checkoutUrl) {
        window.location.href = out.checkoutUrl; // hosted checkout — customer stays in-flow
      } else if (out.bankTransfer) {
        mount.appendChild(renderBankTransfer(doc, out.bankTransfer));
      } else {
        mount.appendChild(el(doc, 'div', 'bez-muted', `Pago iniciado: ${out.paymentId ?? 'OK'}`));
      }
    } catch (e) {
      err.textContent = e.message || 'No se pudo iniciar el pago.';
    } finally {
      btn.disabled = false;
    }
  });
  mount.append(btn, err);
}

function renderBankTransfer(doc, bt) {
  const card = el(doc, 'div', 'bez-card');
  card.append(el(doc, 'div', null, 'Transferencia bancaria (SEPA/SWIFT):'));
  for (const [k, v] of Object.entries(bt)) {
    card.append(el(doc, 'div', 'bez-muted', `${k}: ${v}`));
  }
  return card;
}

async function renderPrice(doc, mount, client, params) {
  const card = el(doc, 'div', 'bez-card bez-w', 'Cargando precio…');
  mount.append(card);
  try {
    const out = await client.service('pay').call('tokenomics', params);
    card.textContent = '';
    const price = out.priceUSD ?? out.bezPriceUSD ?? out.price;
    if (price != null) card.append(el(doc, 'div', null, `1 BEZ ≈ $${price}`));
    if (out.amountBEZ != null) card.append(el(doc, 'div', 'bez-muted', `≈ ${out.amountBEZ} BEZ`));
    if (out.feeBEZ != null) card.append(el(doc, 'div', 'bez-muted', `fee: ${out.feeBEZ} BEZ`));
  } catch (e) {
    card.textContent = e.message || 'No se pudo obtener el precio.';
  }
}

function renderTracker(doc, mount, client, params) {
  const card = el(doc, 'div', 'bez-card bez-w');
  const row = el(doc, 'div', 'bez-row');
  const input = el(doc, 'input', 'bez-input');
  input.placeholder = 'B-UID del envío';
  if (params.bUid) input.value = params.bUid;
  const btn = el(doc, 'button', 'bez-btn', 'Rastrear');
  const out = el(doc, 'div');
  const err = el(doc, 'div', 'bez-err');
  row.append(input, btn);
  card.append(row, out, err);
  mount.append(card);

  const run = async () => {
    out.textContent = '';
    err.textContent = '';
    btn.disabled = true;
    try {
      const tx = await client.service('cargolink', { roleKey: params.roleKey })
        .call('getTx', { bUid: input.value.trim() });
      out.append(el(doc, 'div', null, `Estado: ${tx.status ?? tx.state ?? '—'}`));
      const history = tx.history || tx.validations || [];
      for (const h of history) {
        const step = el(doc, 'div', 'bez-step');
        step.append(el(doc, 'span', 'bez-dot'));
        step.append(el(doc, 'span', null, `${h.status ?? h.state ?? ''} ${h.at ?? h.timestamp ?? ''}`.trim()));
        out.append(step);
      }
    } catch (e) {
      err.textContent = e.message || 'No se pudo rastrear el envío.';
    } finally {
      btn.disabled = false;
    }
  };
  btn.addEventListener('click', run);
  if (params.bUid) run();
}

/**
 * Mount a single widget element. Exposed for manual/programmatic mounting and
 * for tests that pass a fake document + fetch-backed client.
 */
export function mountWidget(mountEl, { client, doc = document } = {}) {
  injectStyles(doc);
  const type = mountEl.dataset.bezhasWidget;
  let call;
  try {
    call = buildWidgetCall(type, mountEl.dataset);
  } catch (e) {
    mountEl.append(el(doc, 'div', 'bez-err bez-w', e.message));
    return;
  }
  const def = call.def;
  if (def.render === 'button') return renderPayButton(doc, mountEl, client, def, call.params);
  if (def.render === 'price') return renderPrice(doc, mountEl, client, call.params);
  if (def.render === 'tracker') return renderTracker(doc, mountEl, client, call.params);
  mountEl.append(el(doc, 'div', 'bez-err bez-w', `Renderer "${def.render}" no implementado.`));
}

/** Scan the document and mount every [data-bezhas-widget]. */
export function autoMount({ doc = document } = {}) {
  const cfg = readScriptConfig(doc);
  if (!cfg.apiKey) {
    console.warn('[bezhas] No data-bezhas-key on the embed <script>; widgets are read-only/disabled.');
  }
  const client = new BeZhasConnect({ apiKey: cfg.apiKey, baseUrl: cfg.baseUrl });
  const nodes = doc.querySelectorAll('[data-bezhas-widget]');
  nodes.forEach((n) => {
    try {
      mountWidget(n, { client, doc });
    } catch (e) {
      console.error('[bezhas] widget mount failed:', e);
    }
  });
  return { client, mounted: nodes.length };
}

// Auto-init only in a real browser. Guarded so importing under Node (tests) is a no-op.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => autoMount());
  } else {
    autoMount();
  }
}

export { resolveWidget };
