/*
 * bz-chat.js — asistente público de BeZhas, para bezhas.com y todas las SubApps.
 *
 * Uso en cualquier página (una línea):
 *   <script src="https://bezhas.com/bz-chat.js" defer></script>
 * Opcional: data-api="https://api.bezhas.com" para apuntar a otra API.
 *
 * Sin dependencias y sin estilos que se filtren: vive en un Shadow DOM. Todo el
 * texto se pinta con textContent (nunca innerHTML) y los enlaces sólo se abren
 * si son https. No guarda nada del usuario.
 */
(function () {
  'use strict';
  if (window.__bzChat) return;
  window.__bzChat = true;

  var script = document.currentScript;
  var API = (script && script.getAttribute('data-api')) || 'https://api.bezhas.com';
  var ENDPOINT = API.replace(/\/+$/, '') + '/api/public-chat';

  var host = document.createElement('div');
  host.setAttribute('data-bz-chat', '');
  var root = host.attachShadow({ mode: 'open' });
  root.innerHTML = [
    '<style>',
    ':host{all:initial}',
    '*{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}',
    '.fab{position:fixed;right:20px;bottom:20px;z-index:2147483000;width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;',
    'background:#00D4AA;color:#04110e;box-shadow:0 6px 24px rgba(0,0,0,.35);font-size:26px;line-height:1}',
    '.fab:focus-visible,.send:focus-visible,.close:focus-visible,input:focus-visible{outline:2px solid #FFD700;outline-offset:2px}',
    '.panel{position:fixed;right:20px;bottom:88px;z-index:2147483000;width:min(380px,calc(100vw - 32px));height:min(520px,calc(100vh - 120px));',
    'display:none;flex-direction:column;background:#0b1514;color:#e8f3f1;border:1px solid #1c3a36;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.5)}',
    '.panel.open{display:flex}',
    '.head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#0f1f1d;border-bottom:1px solid #1c3a36;font-weight:600}',
    '.head small{display:block;font-weight:400;color:#8fb3ad;font-size:12px}',
    '.close{background:none;border:0;color:#8fb3ad;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px}',
    '.log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}',
    '.msg{max-width:88%;padding:9px 12px;border-radius:12px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}',
    '.bot{align-self:flex-start;background:#13302c}',
    '.me{align-self:flex-end;background:#00D4AA;color:#04110e}',
    '.src{display:block;margin-top:6px;font-size:12px;color:#7fe3cd}',
    '.src a{color:inherit}',
    '.form{display:flex;gap:8px;padding:10px;border-top:1px solid #1c3a36;background:#0f1f1d}',
    'input{flex:1;min-width:0;background:#0b1514;color:#e8f3f1;border:1px solid #1c3a36;border-radius:10px;padding:10px 12px;font-size:14px}',
    '.send{background:#00D4AA;color:#04110e;border:0;border-radius:10px;padding:0 14px;font-weight:600;cursor:pointer}',
    '.send[disabled]{opacity:.5;cursor:default}',
    '@media (prefers-reduced-motion:no-preference){.panel.open{animation:up .18s ease-out}@keyframes up{from{opacity:0;transform:translateY(8px)}}}',
    '</style>',
    '<button class="fab" type="button" aria-label="Abrir asistente de BeZhas" aria-expanded="false">💬</button>',
    '<section class="panel" role="dialog" aria-label="Asistente de BeZhas">',
    '<div class="head"><div>Asistente BeZhas<small>Responde con información pública</small></div>',
    '<button class="close" type="button" aria-label="Cerrar">×</button></div>',
    '<div class="log" role="log" aria-live="polite"></div>',
    '<form class="form"><input type="text" maxlength="300" placeholder="Pregunta sobre BeZhas…" aria-label="Tu pregunta" autocomplete="off">',
    '<button class="send" type="submit">Enviar</button></form>',
    '</section>'
  ].join('');

  var fab = root.querySelector('.fab');
  var panel = root.querySelector('.panel');
  var log = root.querySelector('.log');
  var form = root.querySelector('.form');
  var input = root.querySelector('input');
  var send = root.querySelector('.send');
  var busy = false;

  function add(text, who, sources) {
    var el = document.createElement('div');
    el.className = 'msg ' + who;
    el.textContent = text;
    (sources || []).forEach(function (s) {
      if (!s || typeof s.enlace !== 'string' || s.enlace.indexOf('https://') !== 0) return;
      var line = document.createElement('span');
      line.className = 'src';
      var a = document.createElement('a');
      a.href = s.enlace;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = '→ ' + (s.titulo || s.enlace);
      line.appendChild(a);
      el.appendChild(line);
    });
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function toggle(open) {
    panel.classList.toggle('open', open);
    fab.setAttribute('aria-expanded', String(open));
    if (open) {
      if (!log.children.length) add('Hola, soy el asistente de BeZhas. Pregúntame por planes, el token BEZ, el conector MCP o las SubApps.', 'bot');
      input.focus();
    } else {
      fab.focus();
    }
  }

  fab.addEventListener('click', function () { toggle(!panel.classList.contains('open')); });
  root.querySelector('.close').addEventListener('click', function () { toggle(false); });
  root.addEventListener('keydown', function (e) { if (e.key === 'Escape') toggle(false); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (busy || text.length < 2) return;
    busy = true;
    send.disabled = true;
    input.value = '';
    add(text, 'me');
    var pending = add('…', 'bot');

    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, 15000);
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: text }),
      signal: ctl.signal,
      credentials: 'omit'
    }).then(function (r) {
      return r.json().then(function (j) { return { ok: r.ok, j: j }; });
    }).then(function (res) {
      pending.remove();
      if (res.ok && res.j && typeof res.j.reply === 'string') add(res.j.reply, 'bot', res.j.sources);
      else add((res.j && res.j.error) || 'No he podido responder ahora mismo. Inténtalo de nuevo.', 'bot');
    }).catch(function () {
      pending.remove();
      add('No he podido conectar con BeZhas. Inténtalo de nuevo en un momento.', 'bot');
    }).then(function () {
      clearTimeout(timer);
      busy = false;
      send.disabled = false;
      input.focus();
    });
  });

  function mount() { document.body.appendChild(host); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
