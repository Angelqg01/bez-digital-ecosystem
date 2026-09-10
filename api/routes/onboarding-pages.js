'use strict';

/**
 * routes/onboarding-pages.js — pantallas alojadas del onboarding asistido.
 *
 * Server-rendered y autocontenida, sin build ni recursos externos: la página
 * arranca con el token, consulta el estado público y se actualiza sola. Mismo
 * patrón que routes/checkout.js, del que hereda estilo y comportamiento a
 * propósito — dos mecanismos distintos de pantalla alojada acabarían
 * divergiendo, y uno de los dos se quedaría con el control viejo.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  QUÉ HACE ESTA PÁGINA QUE NO PUEDE HACER EL AGENTE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ésta es la frontera del sistema. Aquí —y sólo aquí— una persona:
 *
 *   · acepta condiciones contractuales,
 *   · escribe un número de cuenta,
 *   · recoge una credencial,
 *   · aprueba qué campos salen de su ERP.
 *
 * El agente conduce hasta esta puerta y espera fuera. Por eso la página no
 * recibe órdenes del MCP: recibe un token, y del token cuelga qué formulario
 * mostrar.
 *
 * Nota sobre los campos sensibles: el marcado los deja fuera del ciclo de esta
 * página. El IBAN lo sirve el proveedor de pagos en su propio formulario y la
 * api-key se revela una vez desde su propio endpoint autenticado. Esta página
 * los enmarca; no los transporta.
 *
 * Montada en /o (onb.bez.digital/o/<token>).
 */

const { Router } = require('express');

const router = Router();

/** Título y copy por tipo de sesión. El token decide cuál se pinta. */
const COPY = {
    signup: {
        titulo: 'Completa tu alta en BeZhas',
        entradilla: 'Tu asistente ya ha rellenado lo que sabía. Revisa, corrige y acepta.',
        pasos: ['Datos de la empresa', 'Condiciones', 'Verificar correo', 'Credenciales de pruebas'],
    },
    connect: {
        titulo: 'Conecta tu IA con BeZhas',
        entradilla: 'Inicia sesión con tu cuenta de BeZhas y elige desde qué organización y entorno '
            + 'va a trabajar tu asistente.',
        pasos: ['Iniciar sesión', 'Elegir organización', 'Elegir entorno', 'Autorizar el conector'],
    },
    sdk_install: {
        titulo: 'Credenciales para el SDK',
        entradilla: 'Copia la clave y pégala en tu gestor de secretos. No vuelve a mostrarse.',
        pasos: ['Elegir entorno', 'Generar clave', 'Guardarla', 'Verificar la instalación'],
    },
    erp_integration: {
        titulo: 'Conectar tu plataforma de gestión',
        entradilla: 'Revisa qué campos van a salir de tu ERP. Nada se sincroniza hasta que lo apruebes.',
        pasos: ['Revisar el mapeo', 'Alcance de campos', 'Credenciales', 'Prueba de conexión'],
    },
    node_provision: {
        titulo: 'Registrar tu nodo',
        entradilla: 'Copia el token de registro y arranca el contenedor en tu máquina.',
        pasos: ['Requisitos', 'Token de registro', 'Arrancar', 'Confirmar el alta'],
    },
    bank_setup: {
        titulo: 'Configurar cobros y pagos',
        entradilla: 'El número de cuenta lo introduces aquí, en el formulario del proveedor de pagos. '
            + 'No pasa por BeZhas ni por ninguna IA.',
        pasos: ['Elegir método', 'Datos de facturación', 'Cuenta bancaria', 'Confirmar'],
    },
};

function pageHtml(token) {
    // El token viene validado por la expresión regular de la ruta; interpolarlo
    // como literal JSON es seguro y evita reconstruirlo en el cliente.
    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="referrer" content="no-referrer">
<title>BeZhas — Alta guiada</title>
<style>
  :root { --teal:#00D4AA; --gold:#FFD700; --pink:#FF6B9D; --bg:#0b0f14; --card:#121821; --line:#1e2732; --txt:#e8edf2; --dim:#8b98a5; }
  * { box-sizing:border-box; margin:0; }
  body { background:var(--bg); color:var(--txt); font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;
         min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:18px; padding:28px; width:100%; max-width:520px; }
  .brand { display:flex; align-items:center; gap:10px; margin-bottom:18px; }
  .dot { width:14px; height:14px; border-radius:50%; background:linear-gradient(135deg,var(--teal),var(--pink)); }
  .brand b { letter-spacing:.4px; }
  h1 { font-size:19px; margin-bottom:6px; }
  .dim { color:var(--dim); font-size:13px; }
  .box { background:#0e131a; border:1px solid var(--line); border-radius:12px; padding:12px 14px; margin:14px 0; }
  .box label { display:block; font-size:11px; text-transform:uppercase; letter-spacing:.6px; color:var(--dim); margin-bottom:4px; }
  .mono { font-family:ui-monospace,Consolas,monospace; font-size:13px; word-break:break-all; }
  ol.pasos { list-style:none; counter-reset:p; margin:16px 0; }
  ol.pasos li { counter-increment:p; position:relative; padding:9px 0 9px 34px; border-bottom:1px solid var(--line); font-size:14px; }
  ol.pasos li:last-child { border-bottom:0; }
  ol.pasos li::before { content:counter(p); position:absolute; left:0; top:8px; width:22px; height:22px;
      border-radius:50%; border:1px solid var(--line); color:var(--dim); font-size:12px;
      display:flex; align-items:center; justify-content:center; }
  ol.pasos li.hecho::before { content:'✓'; background:var(--teal); color:#06251e; border-color:var(--teal); }
  ol.pasos li.actual::before { border-color:var(--teal); color:var(--teal); }
  .status { display:flex; align-items:center; gap:9px; margin-top:16px; padding:11px 14px; border-radius:12px;
            background:#0e131a; border:1px solid var(--line); font-size:13px; }
  .spinner { width:14px; height:14px; border:2px solid var(--line); border-top-color:var(--teal);
             border-radius:50%; animation:spin 1s linear infinite; flex:none; }
  @keyframes spin { to { transform:rotate(360deg); } }
  .big { font-size:42px; text-align:center; margin:18px 0 6px; }
  .aviso { border-left:3px solid var(--gold); padding:10px 14px; margin:14px 0; background:#0e131a;
           border-radius:0 12px 12px 0; font-size:13px; color:var(--dim); }
  .campo { margin-bottom:12px; }
  .campo label { display:block; font-size:11px; text-transform:uppercase; letter-spacing:.6px; color:var(--dim); margin-bottom:5px; }
  input, select { width:100%; background:#0e131a; border:1px solid var(--line); color:var(--txt);
                  border-radius:10px; padding:11px 12px; font-size:14px; font-family:inherit; }
  input:focus, select:focus { outline:none; border-color:var(--teal); }
  button.emitir { width:100%; background:var(--teal); color:#06251e; font-weight:700; border:0;
                  padding:13px; border-radius:12px; font-size:15px; cursor:pointer; }
  button.emitir:disabled { opacity:.5; cursor:default; }
  .row { display:flex; align-items:center; gap:8px; }
  .row .mono { flex:1; }
  button.copy { background:transparent; border:1px solid var(--line); color:var(--teal); border-radius:8px;
                padding:5px 10px; font-size:12px; cursor:pointer; }
  button.copy:hover { border-color:var(--teal); }
  .foot { margin-top:18px; font-size:11px; color:var(--dim); text-align:center; }
  [hidden] { display:none !important; }
</style>
</head>
<body>
<div class="card">
  <div class="brand"><div class="dot"></div><b>BeZhas</b></div>

  <div id="loading"><div class="status"><div class="spinner"></div>Cargando tu sesión…</div></div>

  <div id="activo" hidden>
    <h1 id="a-titulo"></h1>
    <p class="dim" id="a-entradilla"></p>
    <ol class="pasos" id="a-pasos"></ol>
    <div class="box" id="a-datos" hidden><label>Datos que trae tu asistente</label><div id="a-prefill" class="dim"></div></div>
    <div class="aviso" id="a-aviso" hidden></div>

    <div id="a-login" hidden>
      <form id="form-login" autocomplete="on">
        <div class="campo">
          <label for="l-email">Correo</label>
          <input type="email" id="l-email" name="email" autocomplete="username" required>
        </div>
        <div class="campo">
          <label for="l-pass">Contraseña</label>
          <input type="password" id="l-pass" name="password" autocomplete="current-password" required>
        </div>
        <button class="emitir" type="submit" id="btn-login">Entrar</button>
      </form>
      <p class="dim" style="margin-top:8px">Tu contraseña se envía a BeZhas por esta pantalla cifrada. Nunca la escribas en el chat.</p>
    </div>

    <div id="a-orgs" hidden>
      <div class="box"><label>Organización</label>
        <select id="o-select"></select>
      </div>
      <div class="box"><label>Entorno</label>
        <select id="o-entorno">
          <option value="sandbox">Pruebas (recomendado para empezar)</option>
          <option value="produccion">Producción</option>
        </select>
      </div>
      <p class="dim" id="o-aviso" hidden></p>
      <button class="emitir" id="btn-conectar">Conectar y mostrar la clave</button>
    </div>

    <div id="a-emitir" hidden>
      <button class="emitir" id="btn-emitir">Generar y mostrar</button>
      <p class="dim" style="margin-top:8px">Se muestra una sola vez. Tenlo a mano dónde guardarlo antes de pulsar.</p>
    </div>

    <div id="a-secreto" hidden>
      <div class="box"><label id="s-label">Credencial</label>
        <div class="row"><div class="mono" id="s-valor"></div><button class="copy" data-copy="s-valor">Copiar</button></div>
      </div>
      <div class="aviso">Esto no vuelve a mostrarse. Si cierras la pantalla sin copiarlo, hay que emitir otro.</div>
      <ul class="dim" id="s-instrucciones" style="padding-left:18px"></ul>
    </div>

    <div class="status"><div class="spinner"></div><span id="a-status">Esta pantalla se actualiza sola.</span></div>
    <p class="dim" id="a-caduca" style="margin-top:10px"></p>
  </div>

  <div id="hecho" hidden>
    <div class="big">✅</div>
    <h1 style="text-align:center">Listo</h1>
    <p class="dim" style="text-align:center" id="h-detalle">Vuelve a tu asistente: ya puede continuar.</p>
  </div>

  <div id="muerto" hidden>
    <div class="big" id="x-icono">⚠️</div>
    <h1 style="text-align:center" id="x-titulo"></h1>
    <p class="dim" style="text-align:center" id="x-detalle"></p>
  </div>

  <div class="foot">Pantalla segura de BeZhas · no compartas esta URL</div>
</div>
<script>
(function () {
  var TOKEN = ${JSON.stringify(token)};
  var API = '/api/gateway/v1/onboarding/' + TOKEN;
  var COPY = ${JSON.stringify(COPY)};
  var timer = null;

  function show(id) {
    ['loading','activo','hecho','muerto'].forEach(function (s) {
      document.getElementById(s).hidden = s !== id;
    });
  }
  function txt(id, v) { document.getElementById(id).textContent = v; }

  function pintarPasos(copy, actual) {
    var ol = document.getElementById('a-pasos');
    ol.innerHTML = '';
    var idx = copy.pasos.indexOf(actual);
    copy.pasos.forEach(function (p, i) {
      var li = document.createElement('li');
      li.textContent = p;
      if (idx >= 0 && i < idx) li.className = 'hecho';
      else if (i === (idx < 0 ? 0 : idx)) li.className = 'actual';
      ol.appendChild(li);
    });
  }

  function pintarPrefill(prefill) {
    var claves = Object.keys(prefill || {}).filter(function (k) {
      return prefill[k] !== null && prefill[k] !== undefined && prefill[k] !== '';
    });
    if (claves.length === 0) return;
    document.getElementById('a-datos').hidden = false;
    document.getElementById('a-prefill').textContent = claves.map(function (k) {
      var v = prefill[k];
      return k + ': ' + (Array.isArray(v) ? v.join(', ') : v);
    }).join(' · ');
  }

  function render(o) {
    var copy = COPY[o.tipo] || { titulo: 'Sesión de BeZhas', entradilla: '', pasos: [] };

    if (o.estado === 'completado') {
      show('hecho');
      clearInterval(timer);
      return;
    }
    if (o.estado === 'caducado' || o.estado === 'cancelado') {
      show('muerto');
      txt('x-icono', o.estado === 'caducado' ? '⏰' : '✋');
      txt('x-titulo', o.estado === 'caducado' ? 'El enlace ha caducado' : 'Sesión cancelada');
      txt('x-detalle', o.siguienteAccion || 'Pide otro enlace a tu asistente: se genera al momento.');
      clearInterval(timer);
      return;
    }

    show('activo');
    txt('a-titulo', copy.titulo);
    txt('a-entradilla', copy.entradilla);
    pintarPasos(copy, o.pasoActual);
    pintarPrefill(o.prefill);

    if (o.tipo === 'bank_setup') {
      var av = document.getElementById('a-aviso');
      av.hidden = false;
      av.textContent = 'Tu número de cuenta se introduce en el formulario del proveedor de pagos. '
        + 'No lo escribas nunca en el chat: acabaría en el historial de la conversación y en el contexto del modelo.';
    }
    // Sólo los flujos que entregan algo enseñan el botón. El resto se limita a
    // guiar: no hay nada que emitir en un alta o en una configuración de banco.
    if ((o.tipo === 'sdk_install' || o.tipo === 'node_provision') && !yaEmitido) {
      document.getElementById('a-emitir').hidden = false;
    }

    // El flujo connect tiene dos pasos antes de emitir: identificarse y elegir dónde.
    // Cuál toca lo decide lo que ya ha ocurrido en ESTA pestaña, no el servidor:
    // el servidor no manda de vuelta quién eres, y así no hay nada que
    // interceptar en el sondeo.
    if (o.tipo === 'connect' && !yaEmitido) {
      document.getElementById('a-login').hidden = Boolean(organizaciones);
      document.getElementById('a-orgs').hidden = !organizaciones;
    }

    if (o.siguienteAccion) txt('a-status', o.siguienteAccion);
    if (o.caduca) txt('a-caduca', 'Este enlace caduca el ' + new Date(o.caduca).toLocaleString());
  }

  // El valor emitido vive en esta variable y en ningún otro sitio del
  // navegador: nada de localStorage ni de la URL. Si la pestaña se cierra, se
  // ha perdido — que es exactamente lo que se le advierte al usuario.
  var yaEmitido = false;

  function pintarSecreto(e) {
    yaEmitido = true;
    clearInterval(timer);                        // deja de sondear: ya está
    document.getElementById('a-emitir').hidden = true;
    document.getElementById('a-login').hidden = true;
    document.getElementById('a-orgs').hidden = true;
    document.getElementById('a-secreto').hidden = false;
    txt('s-label', e.tipo === 'api_key' ? 'Tu api-key' : 'Token de registro del nodo');
    txt('s-valor', e.valor);
    var ul = document.getElementById('s-instrucciones');
    ul.innerHTML = '';
    (e.instrucciones || []).forEach(function (i) {
      var li = document.createElement('li'); li.textContent = i; ul.appendChild(li);
    });
  }

  // Las organizaciones que devolvió el login viven aquí y en ningún otro sitio.
  var organizaciones = null;

  function pintarOrganizaciones(lista) {
    organizaciones = lista;
    var sel = document.getElementById('o-select');
    sel.innerHTML = '';
    lista.forEach(function (o) {
      var opt = document.createElement('option');
      opt.value = o.id;
      // Se listan TODAS, marcando las que el papel no permite, en vez de
      // esconderlas: una lista vacía haría pensar que el alta está mal.
      opt.textContent = o.nombre + (o.puedeConectar ? '' : ' — sin permiso (' + o.papel + ')');
      opt.disabled = !o.puedeConectar;
      sel.appendChild(opt);
    });
    var conectables = lista.filter(function (o) { return o.puedeConectar; });
    var aviso = document.getElementById('o-aviso');
    if (conectables.length === 0) {
      aviso.hidden = false;
      aviso.textContent = 'Ninguna de tus organizaciones te permite conectar integraciones con tu papel actual. '
        + 'Pídeselo a quien sea owner o admin.';
      document.getElementById('btn-conectar').disabled = true;
    } else {
      sel.value = conectables[0].id;
    }
    document.getElementById('a-login').hidden = true;
    document.getElementById('a-orgs').hidden = false;
  }

  document.getElementById('form-login').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var b = document.getElementById('btn-login');
    b.disabled = true; b.textContent = 'Comprobando…';
    fetch(API + '/login', {
      method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: document.getElementById('l-email').value,
        password: document.getElementById('l-pass').value,
      }),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        b.disabled = false; b.textContent = 'Entrar';
        if (!res.ok) { txt('a-status', res.d.error || 'No se pudo entrar.'); return; }
        // La contraseña se borra del formulario en cuanto deja de hacer falta:
        // no tiene por qué seguir en el DOM el resto de la sesión.
        document.getElementById('l-pass').value = '';
        pintarOrganizaciones(res.d.organizaciones || []);
      })
      .catch(function () {
        b.disabled = false; b.textContent = 'Entrar';
        txt('a-status', 'Fallo de red. Vuelve a intentarlo.');
      });
  });

  document.getElementById('btn-conectar').addEventListener('click', function () {
    var b = this;
    b.disabled = true; b.textContent = 'Conectando…';
    emitir({
      organizationId: document.getElementById('o-select').value,
      entorno: document.getElementById('o-entorno').value,
    }, b, 'Conectar y mostrar la clave');
  });

  /** Pide la emisión. Común a los tres flujos que entregan algo. */
  function emitir(cuerpo, boton, textoBoton) {
    fetch(API + '/issue', {
      method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo || {}),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) {
          boton.disabled = false;
          boton.textContent = textoBoton;
          txt('a-status', res.d.error || 'No se pudo generar.');
          return;
        }
        pintarSecreto(res.d.emitido);
      })
      .catch(function () {
        boton.disabled = false;
        boton.textContent = textoBoton;
        txt('a-status', 'Fallo de red. Vuelve a intentarlo.');
      });
  }

  document.getElementById('btn-emitir').addEventListener('click', function () {
    var b = this;
    b.disabled = true;
    b.textContent = 'Generando…';
    emitir({}, b, 'Generar y mostrar');
  });

  function poll() {
    fetch(API, { cache: 'no-store' })
      .then(function (r) {
        if (r.status === 404) throw new Error('notfound');
        return r.json();
      })
      .then(function (d) { if (!yaEmitido) render(d.onboarding); })
      .catch(function (err) {
        if (err.message === 'notfound') {
          show('muerto');
          txt('x-icono', '🔍');
          txt('x-titulo', 'Enlace no válido');
          txt('x-detalle', 'La sesión no existe o ya se cerró. Pide otra a tu asistente.');
          clearInterval(timer);
        }
        // Fallo de red transitorio: el siguiente tick reintenta.
      });
  }

  poll();
  timer = setInterval(poll, 5000);
})();
</script>
</body>
</html>`;
}

router.get('/:token([0-9a-f]{64})', (req, res) => {
    // La página no revela nada por sí sola: todo lo que pinta lo pide después
    // al endpoint público, que es quien valida el token y su caducidad.
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex');
    res.type('html').send(pageHtml(req.params.token));
});

/** Un token con otra forma no llega ni a consultarse. */
router.get('/:resto', (_req, res) => {
    res.status(404).type('html').send('<!doctype html><meta charset="utf-8"><p>Enlace no válido.</p>');
});

module.exports = router;
