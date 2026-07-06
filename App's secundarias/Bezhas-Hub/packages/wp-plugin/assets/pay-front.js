/* BeZhas-Pay — botón de pago en el front público (shortcode / bloque). */
(function () {
  'use strict';
  var CFG = window.BeZhasPay || {};
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.bezhas-pay-btn');
    if (!btn) return;
    e.preventDefault();
    btn.disabled = true;
    var original = btn.textContent;
    btn.textContent = 'Redirigiendo…';
    fetch(CFG.restBase + '/pay/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': CFG.nonce },
      body: JSON.stringify({
        amount: parseFloat(btn.getAttribute('data-amount') || '0'),
        currency: btn.getAttribute('data-currency') || 'EUR',
      }),
    }).then(function (r) { return r.json(); }).then(function (d) {
      var url = d && (d.paymentUrl || d.url);
      if (url) { window.location.href = url; }
      else { btn.disabled = false; btn.textContent = original; alert((d && d.message) || 'No se pudo iniciar el pago.'); }
    }).catch(function () { btn.disabled = false; btn.textContent = original; });
  });
})();
