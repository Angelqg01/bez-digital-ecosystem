/**
 * routes/checkout.js — hosted checkout page (pay.bez.digital/c/<token>).
 *
 * Server-rendered, self-contained HTML (no build step, no external assets):
 * the page bootstraps with the token and polls the PUBLIC status endpoint
 * (/api/gateway/v1/checkout/:token) every 5s until the order settles, fails
 * or expires. The merchant redirects/embeds this URL from its own checkout —
 * same model as Stripe Checkout.
 *
 * Mounted at /c in index.js.
 */
const { Router } = require('express');

const router = Router();

function pageHtml(token) {
    // Token validated by the route regex; safe to interpolate.
    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>BeZhas Pay — Checkout</title>
<style>
  :root { --teal:#00D4AA; --gold:#FFD700; --pink:#FF6B9D; --bg:#0b0f14; --card:#121821; --line:#1e2732; --txt:#e8edf2; --dim:#8b98a5; }
  * { box-sizing:border-box; margin:0; }
  body { background:var(--bg); color:var(--txt); font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;
         min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:18px; padding:28px; width:100%; max-width:440px; }
  .brand { display:flex; align-items:center; gap:10px; margin-bottom:18px; }
  .dot { width:14px; height:14px; border-radius:50%; background:linear-gradient(135deg,var(--teal),var(--pink)); }
  .brand b { letter-spacing:.4px; }
  h1 { font-size:17px; margin-bottom:4px; }
  .amount { font-size:34px; font-weight:700; margin:10px 0 2px; }
  .amount span { font-size:15px; color:var(--dim); font-weight:400; }
  .dim { color:var(--dim); font-size:13px; }
  .box { background:#0e131a; border:1px solid var(--line); border-radius:12px; padding:12px 14px; margin:14px 0; }
  .box label { display:block; font-size:11px; text-transform:uppercase; letter-spacing:.6px; color:var(--dim); margin-bottom:4px; }
  .mono { font-family:ui-monospace,Consolas,monospace; font-size:13px; word-break:break-all; }
  .row { display:flex; align-items:center; gap:8px; }
  .row .mono { flex:1; }
  button.copy { background:transparent; border:1px solid var(--line); color:var(--teal); border-radius:8px;
                padding:5px 10px; font-size:12px; cursor:pointer; }
  button.copy:hover { border-color:var(--teal); }
  .status { display:flex; align-items:center; gap:9px; margin-top:16px; padding:11px 14px; border-radius:12px;
            background:#0e131a; border:1px solid var(--line); font-size:13px; }
  .spinner { width:14px; height:14px; border:2px solid var(--line); border-top-color:var(--teal);
             border-radius:50%; animation:spin 1s linear infinite; flex:none; }
  @keyframes spin { to { transform:rotate(360deg); } }
  .ok { color:var(--teal); } .bad { color:var(--pink); } .warn { color:var(--gold); }
  .big { font-size:42px; text-align:center; margin:18px 0 6px; }
  a.stripe { display:block; text-align:center; background:var(--teal); color:#06251e; font-weight:700;
             padding:13px; border-radius:12px; text-decoration:none; margin-top:14px; }
  .foot { margin-top:18px; font-size:11px; color:var(--dim); text-align:center; }
  [hidden] { display:none !important; }
</style>
</head>
<body>
<div class="card">
  <div class="brand"><div class="dot"></div><b>BeZhas&nbsp;Pay</b></div>
  <div id="loading"><div class="status"><div class="spinner"></div>Cargando tu pedido…</div></div>

  <div id="pending" hidden>
    <h1>Completa tu pago</h1>
    <div class="amount" id="p-amount"></div>
    <p class="dim" id="p-sub"></p>

    <div id="p-onchain" hidden>
      <div class="box"><label>Envía exactamente</label>
        <div class="row"><div class="mono" id="p-bez"></div><button class="copy" data-copy="p-bez">Copiar</button></div>
      </div>
      <div class="box"><label>A la dirección (Treasury BeZhas)</label>
        <div class="row"><div class="mono" id="p-treasury"></div><button class="copy" data-copy="p-treasury">Copiar</button></div>
      </div>
      <p class="dim">Envíalo desde la wallet <span class="mono" id="p-from"></span> — así casamos tu pago automáticamente.</p>
    </div>

    <div id="p-bank" hidden>
      <div class="box"><label>IBAN</label>
        <div class="row"><div class="mono" id="p-iban"></div><button class="copy" data-copy="p-iban">Copiar</button></div>
      </div>
      <div class="box"><label>Concepto (obligatorio)</label>
        <div class="row"><div class="mono" id="p-ref"></div><button class="copy" data-copy="p-ref">Copiar</button></div>
      </div>
      <p class="dim" id="p-beneficiary"></p>
    </div>

    <div id="p-card" hidden>
      <a class="stripe" id="p-stripe" href="#" rel="noopener">Pagar con tarjeta →</a>
    </div>

    <div class="status"><div class="spinner"></div><span id="p-status">Esperando tu pago — esta página se actualiza sola.</span></div>
    <p class="dim" id="p-expiry" style="margin-top:10px"></p>
  </div>

  <div id="done" hidden>
    <div class="big">✅</div>
    <h1 style="text-align:center">Pago confirmado</h1>
    <p class="dim" style="text-align:center" id="d-detail"></p>
    <div class="box" id="d-txbox" hidden><label>Transacción</label><div class="mono" id="d-tx"></div></div>
  </div>

  <div id="dead" hidden>
    <div class="big" id="x-icon">⚠️</div>
    <h1 style="text-align:center" id="x-title"></h1>
    <p class="dim" style="text-align:center" id="x-detail"></p>
  </div>

  <div class="foot">Liquidación on-chain por BeZhas Network · no compartas esta URL</div>
</div>
<script>
(function () {
  var TOKEN = ${JSON.stringify(token)};
  var API = '/api/gateway/v1/checkout/' + TOKEN;
  var timer = null;

  function show(id) {
    ['loading','pending','done','dead'].forEach(function (s) {
      document.getElementById(s).hidden = s !== id;
    });
  }
  function txt(id, value) { document.getElementById(id).textContent = value; }

  document.addEventListener('click', function (e) {
    var src = e.target.getAttribute && e.target.getAttribute('data-copy');
    if (!src) return;
    navigator.clipboard.writeText(document.getElementById(src).textContent).then(function () {
      e.target.textContent = '¡Copiado!';
      setTimeout(function () { e.target.textContent = 'Copiar'; }, 1200);
    });
  });

  function render(c) {
    if (c.status === 'completed') {
      show('done');
      txt('d-detail', c.amountUSD + ' USD liquidados en BEZ.');
      if (c.txHash) { document.getElementById('d-txbox').hidden = false; txt('d-tx', c.txHash); }
      clearInterval(timer);
      return;
    }
    if (c.status === 'failed' || c.status === 'expired') {
      show('dead');
      txt('x-icon', c.status === 'expired' ? '⏰' : '❌');
      txt('x-title', c.status === 'expired' ? 'Pedido caducado' : 'Pago fallido');
      txt('x-detail', c.status === 'expired'
        ? 'Este checkout expiró sin recibir el pago. Vuelve a la tienda y crea un pedido nuevo.'
        : 'El pago no pudo completarse. Vuelve a la tienda e inténtalo de nuevo.');
      clearInterval(timer);
      return;
    }
    // pending / processing
    show('pending');
    txt('p-amount', c.amountUSD + ' USD');
    if (c.onchain) {
      document.getElementById('p-onchain').hidden = false;
      txt('p-sub', 'Pago en $BEZ (red Polygon)');
      txt('p-bez', c.onchain.expectedBez + ' BEZ');
      txt('p-treasury', c.onchain.treasury || '');
      txt('p-from', c.onchain.sendFrom || 'tu wallet del pedido');
    } else if (c.bank) {
      document.getElementById('p-bank').hidden = false;
      txt('p-sub', 'Transferencia bancaria (SEPA)');
      txt('p-iban', c.bank.iban || '');
      txt('p-ref', c.bank.reference || '');
      txt('p-beneficiary', c.bank.beneficiary ? 'Beneficiario: ' + c.bank.beneficiary : '');
    } else if (c.stripeUrl) {
      document.getElementById('p-card').hidden = false;
      txt('p-sub', 'Pago con tarjeta');
      document.getElementById('p-stripe').href = c.stripeUrl;
    } else {
      txt('p-sub', 'Método: ' + (c.method || ''));
    }
    if (c.status === 'processing') txt('p-status', 'Pago detectado — confirmando en la red…');
    if (c.expiresAt) txt('p-expiry', 'Este checkout caduca el ' + new Date(c.expiresAt).toLocaleString());
  }

  function poll() {
    fetch(API, { cache: 'no-store' })
      .then(function (r) {
        if (r.status === 404) throw new Error('notfound');
        return r.json();
      })
      .then(function (data) { render(data.checkout); })
      .catch(function (err) {
        if (err.message === 'notfound') {
          show('dead');
          txt('x-icon', '🔍');
          txt('x-title', 'Checkout no encontrado');
          txt('x-detail', 'El enlace no es válido o el pedido ya no existe.');
          clearInterval(timer);
        }
        // Errores de red transitorios: el siguiente tick reintenta.
      });
  }

  poll();
  timer = setInterval(poll, 5000);
})();
</script>
</body>
</html>`;
}

router.get('/:token([0-9a-f]{32})', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.type('html').send(pageHtml(req.params.token));
});

module.exports = router;
