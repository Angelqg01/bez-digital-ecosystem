/* BeZhas Hub — consola embebida (vanilla JS, sin build step).
 * Hidrata wp-admin?page=bezhas-hub consumiendo /wp-json/bezhas/v1/*.
 */
(function () {
  'use strict';
  var CFG = window.BeZhasHub || {};
  var root = document.getElementById('bezhas-console-root');
  if (!root) return;

  function api(path, opts) {
    opts = opts || {};
    return fetch(CFG.restBase + path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': CFG.nonce },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); });
  }

  function eur(n) { return (Math.round(n * 100) / 100).toFixed(2) + ' €'; }
  function el(id) { return document.getElementById(id); }

  var manifest = null;

  // ── Estado de conexión ────────────────────────────────────────────────────
  function renderStatus() {
    return api('/status').then(function (res) {
      var s = (res.data && res.data.status) || {};
      var box = el('bezhas-status');
      var online = !!s.online, connected = !!s.connected;
      box.className = 'bezhas-status ' + (online ? (connected ? 'is-ok' : 'is-warn') : 'is-down');
      box.querySelector('.label').textContent = online
        ? (connected ? 'Conectado a BeZhas Network' : 'Hub accesible — conecta tu API Key')
        : 'Sin conexión con el Hub';
      toggleConnect(!connected);
      return connected;
    });
  }

  function toggleConnect(showConnect) {
    el('bezhas-connect').hidden = !showConnect;
    el('bezhas-tabs').hidden = showConnect;
    document.querySelectorAll('.bezhas-pane').forEach(function (p) {
      if (showConnect) p.hidden = true;
    });
    if (!showConnect) activateTab('plans');
  }

  // ── Conexión ──────────────────────────────────────────────────────────────
  el('bezhas-connect-btn').addEventListener('click', function () {
    var btn = this; btn.disabled = true;
    api('/connect', { method: 'POST', body: {
      apiKey: el('bezhas-apikey').value.trim(),
      network: el('bezhas-network').value,
    } }).then(function (res) {
      btn.disabled = false;
      if (res.ok) { boot(); } else { alert((res.data && res.data.message) || 'No se pudo conectar.'); }
    });
  });

  // ── Tabs ──────────────────────────────────────────────────────────────────
  document.querySelectorAll('.bezhas-tab').forEach(function (t) {
    t.addEventListener('click', function () { activateTab(t.getAttribute('data-tab')); });
  });
  function activateTab(name) {
    document.querySelectorAll('.bezhas-tab').forEach(function (t) {
      t.classList.toggle('is-active', t.getAttribute('data-tab') === name);
    });
    document.querySelectorAll('.bezhas-pane').forEach(function (p) {
      p.hidden = p.id !== 'pane-' + name;
    });
  }

  // ── Planes ────────────────────────────────────────────────────────────────
  function renderPlans() {
    if (!manifest) return;
    var grid = el('bezhas-plans');
    var payBez = el('bezhas-paybez').checked;
    var annual = el('bezhas-annual').checked;
    var activePlan = (manifest.active && manifest.active.plan) || null;
    grid.innerHTML = '';
    manifest.plans.forEach(function (p) {
      var base = annual ? p.yearlyEUR : p.priceEUR;
      var disc = payBez ? base * (manifest.planMeta.bezDiscountRate || 0.2) : 0;
      var subtotal = base - disc;
      var total = subtotal * (1 + (manifest.planMeta.ivaRate || 0.21));
      var isActive = activePlan === p.id;
      var card = document.createElement('div');
      card.className = 'bezhas-plan' + (p.recommended ? ' is-rec' : '') + (isActive ? ' is-active' : '');
      card.innerHTML =
        (p.badge ? '<span class="bezhas-badge">' + p.badge + '</span>' : '') +
        '<h3>' + p.name + '</h3>' +
        '<p class="bezhas-profile">' + (p.profile || '') + '</p>' +
        '<p class="bezhas-price">' + (base === 0 ? 'Gratis' : eur(total)) + '<span>/' + (annual ? 'año' : 'mes') + ' IVA inc.</span></p>' +
        (p.valueLine ? '<p class="bezhas-value">' + p.valueLine + '</p>' : '') +
        '<button class="button ' + (isActive ? '' : 'button-primary') + '" ' + (isActive ? 'disabled' : '') + ' data-plan="' + p.id + '">' +
          (isActive ? 'Plan actual' : (base === 0 ? 'Activar' : 'Suscribirme')) + '</button>';
      grid.appendChild(card);
    });
    grid.querySelectorAll('button[data-plan]').forEach(function (b) {
      b.addEventListener('click', function () { subscribe(b.getAttribute('data-plan'), b); });
    });
  }
  ['bezhas-paybez', 'bezhas-annual'].forEach(function (id) {
    var node = el(id); if (node) node.addEventListener('change', renderPlans);
  });

  function subscribe(planId, btn) {
    btn.disabled = true; btn.textContent = 'Procesando…';
    api('/subscribe', { method: 'POST', body: {
      planId: planId, payWithBez: el('bezhas-paybez').checked, annual: el('bezhas-annual').checked,
    } }).then(function (res) {
      if (res.ok) {
        if (res.data && res.data.paymentUrl) { window.open(res.data.paymentUrl, '_blank'); }
        manifest.active = manifest.active || {}; manifest.active.plan = planId;
        renderPlans();
      } else {
        btn.disabled = false; btn.textContent = 'Suscribirme';
        alert((res.data && res.data.message) || 'No se pudo completar la suscripción.');
      }
    });
  }

  // ── SubApps ───────────────────────────────────────────────────────────────
  function renderSubapps() {
    if (!manifest) return;
    var grid = el('bezhas-subapps');
    var active = (manifest.active && manifest.active.subapps) || {};
    grid.innerHTML = '';
    manifest.subapps.forEach(function (s) {
      var on = !!active[s.key];
      var card = document.createElement('div');
      card.className = 'bezhas-subapp' + (on ? ' is-on' : '');
      card.innerHTML =
        '<div class="bezhas-subapp-head"><h3>' + s.name + '</h3>' +
        '<label class="bezhas-switch"><input type="checkbox" ' + (on ? 'checked' : '') + ' data-sub="' + s.key + '" data-scope="' + (s.scope || '') + '"><span></span></label></div>' +
        '<p class="bezhas-muted">' + (s.description || '') + '</p>';
      grid.appendChild(card);
    });
    grid.querySelectorAll('input[data-sub]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        cb.disabled = true;
        api('/subapp/toggle', { method: 'POST', body: {
          key: cb.getAttribute('data-sub'), scope: cb.getAttribute('data-scope'), enabled: cb.checked,
        } }).then(function (res) {
          cb.disabled = false;
          manifest.active = manifest.active || {}; manifest.active.subapps = manifest.active.subapps || {};
          if (cb.checked) manifest.active.subapps[cb.getAttribute('data-sub')] = true;
          else delete manifest.active.subapps[cb.getAttribute('data-sub')];
          cb.closest('.bezhas-subapp').classList.toggle('is-on', cb.checked);
          if (!res.ok) alert((res.data && res.data.message) || 'No se pudo cambiar la SubApp.');
        });
      });
    });
  }

  // ── Pago ──────────────────────────────────────────────────────────────────
  el('bezhas-pay-btn').addEventListener('click', function () {
    var btn = this; btn.disabled = true;
    var out = el('bezhas-pay-result'); out.textContent = 'Creando intent…';
    api('/pay/intent', { method: 'POST', body: {
      amount: parseFloat(el('bezhas-pay-amount').value || '0'), currency: el('bezhas-pay-currency').value,
    } }).then(function (res) {
      btn.disabled = false;
      if (res.ok && (res.data.paymentUrl || res.data.url)) {
        var url = res.data.paymentUrl || res.data.url;
        out.innerHTML = 'Cobro creado: <a href="' + url + '" target="_blank" rel="noopener">abrir página de pago</a>';
      } else {
        out.textContent = (res.data && res.data.message) || 'No se pudo crear el cobro.';
      }
    });
  });

  // ── Boot ──────────────────────────────────────────────────────────────────
  function boot() {
    renderStatus().then(function (connected) {
      return api('/manifest').then(function (res) {
        if (res.ok && res.data.manifest) {
          manifest = res.data.manifest;
          renderPlans(); renderSubapps();
        }
      });
    });
  }
  boot();
})();
