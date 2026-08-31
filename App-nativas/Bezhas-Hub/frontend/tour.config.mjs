// Recorrido "Cómo usar BeZhas Hub" — contenido de las escenas.
// Genera public/como-usar.html con:  pnpm tour:build
// Motor + mecánica: @bezhas/guided-tour (App-nativas/packages/guided-tour).

export default {
  appName: 'BeZhas Hub',
  subtitle: 'Cómo funciona',
  logo: 'Ⓑ',
  durationMs: 7500,
  theme: {
    primary: '#00E5FF',
    secondary: '#10B981',
    gold: '#D4AF37',
    pink: '#D90429',
    purple: '#7209B7',
    bg: '#0A0B10',
  },
  scenes: [
    {
      label: 'Introducción', kicker: 'BeZhas Hub',
      title: 'El plano de control de todo el ecosistema B2B',
      body: 'Un solo panel para gestionar tu organización, activar Apps Nativas por sector, pagar en $BEZ y conectar todo por API. Pensado para instituciones, holdings y empresas multi-sede.',
      tags: [['c', 'Multi-tenant'], ['g', 'B2B'], ['p', 'Un panel, todo el ecosistema']],
      visual: `
        <div class="phone">
          <div class="bar">{{ico:anchor}}<b>BEZHAS HUB</b><span class="rt">live</span></div>
          <div class="mini pop"><div class="h">{{ico:box}} Organización activa</div><div class="s">Holding Demo · 4 sedes</div></div>
          <div class="mini pop d1"><div class="h">{{ico:radio}} Servicios activos</div><div class="s">CargoLink · Energy · Capital · Compliance</div></div>
          <div class="mini pop d2"><div class="h">{{ico:wallet}} Wallet</div><div class="row" style="margin-top:6px"><span class="chip cyan">1.240 BEZ</span><span class="chip green">Conectada</span></div></div>
          <div class="mini pop d3" style="text-align:center"><div class="float">{{ico:shield}}</div><div class="s">Control central, ejecución distribuida</div></div>
        </div>`,
    },
    {
      label: 'Dashboard', kicker: 'Control · Inicio',
      title: 'Estado del ecosistema de un vistazo',
      body: 'El Dashboard resume el estado de la red, tus servicios activos y la actividad reciente. Es la primera pantalla al entrar: desde aquí navegas a cualquier sección del Hub.',
      tags: [['c', 'Salud de red'], ['', 'Actividad reciente'], ['g', 'Acceso rápido']],
      visual: `
        <div class="phone">
          <div class="bar">{{ico:cpu}}<b>DASHBOARD</b></div>
          <div class="mini pop row"><div class="h">{{ico:radio}} Red</div><span class="chip green" style="margin-left:auto">Operativa</span></div>
          <div class="mini pop d1"><div class="bars"><b class="b1" style="width:92%"></b></div><div class="s" style="margin-top:6px">Throughput 92% · 4 Apps Nativas online</div></div>
          <div class="mini pop d2 row"><span class="chip cyan">CargoLink</span><span class="chip cyan">Energy</span><span class="chip cyan">Capital</span></div>
        </div>`,
    },
    {
      label: 'Organización & Sedes', kicker: 'Control · Business Dashboard',
      title: 'Tu holding, tus filiales, un solo panel',
      body: 'Da de alta sedes/filiales bajo tu organización y cambia entre ellas con el selector de la cabecera. El Hub opera "como" la sede activa: cada llamada viaja ya con su contexto, sin tocar nada más.',
      tags: [['c', 'Holding → filiales'], ['g', 'Selector en cabecera'], ['', 'Contexto automático']],
      visual: `
        <div class="phone">
          <div class="bar">{{ico:box}}<b>ORGANIZACIÓN & SEDES</b><span class="rt">B2B</span></div>
          <div class="mini pop"><div class="h">{{ico:pin}} Holding Demo S.L.</div><div class="s">Empresa matriz</div></div>
          <div class="mini pop d1 row"><span class="chip cyan">Sede Madrid</span><span class="chip green">activa</span></div>
          <div class="mini pop d2 row"><span class="chip cyan">Sede Algeciras</span><span class="chip cyan">Sede Rotterdam</span></div>
        </div>`,
    },
    {
      label: 'Verticales · Apps Nativas', kicker: 'Servicios por sector',
      title: 'Un servicio real por cada sector de tu operación',
      body: 'Activa CargoLink (logística/aduanas), Energy·VPP (energía), RWA (inmobiliario), Vision Scan y PureScan (compliance/antifraude), Prestige (red de socios B2B), Genesis (ERP) y Capital (DeFi/tesorería) desde un mismo lugar.',
      tags: [['c', 'Logística · Energía'], ['g', 'RWA · Compliance'], ['p', 'DeFi · ERP']],
      visual: `
        <div class="phone">
          <div class="bar">{{ico:globe}}<b>VERTICALES</b></div>
          <div class="mini pop d1 row" style="flex-wrap:wrap;gap:6px"><span class="chip cyan">CargoLink</span><span class="chip green">Energy·VPP</span><span class="chip cyan">RWA</span></div>
          <div class="mini pop d2 row" style="flex-wrap:wrap;gap:6px"><span class="chip cyan">Vision Scan</span><span class="chip green">PureScan</span><span class="chip cyan">Prestige</span></div>
          <div class="mini pop d3 row" style="flex-wrap:wrap;gap:6px"><span class="chip green">Genesis·ERP</span><span class="chip cyan">Capital·DeFi</span></div>
        </div>`,
    },
    {
      label: 'BeZhas Pay & Wallet', kicker: 'Finanzas',
      title: 'Cobra y paga en fiat o en $BEZ, con liquidación real',
      body: 'BeZhas Pay procesa cobros fiat/cripto con liquidación SEPA/SWIFT o on-chain. Tu Wallet custodia el BEZ, sirve para gobernanza y activa el gas abstraction (Gas Tank) del resto de Apps Nativas.',
      tags: [['c', 'Fiat + $BEZ'], ['g', 'SEPA · SWIFT'], ['', 'Gas abstraction']],
      visual: `
        <div class="phone">
          <div class="bar">{{ico:coins}}<b>BEZHAS PAY</b><span class="rt">v2.0</span></div>
          <div class="mini pop row"><div class="h">{{ico:wallet}} Balance</div><b style="margin-left:auto;color:var(--gold)">1.240 BEZ</b></div>
          <div class="mini pop d1 row"><span class="chip green">Cobro recibido</span><span class="chip cyan">SEPA</span></div>
          <div class="mini pop d2 row"><span class="chip cyan">Gas Tank</span><span class="chip green">patrocinado</span></div>
        </div>`,
    },
    {
      label: 'API · Sectores de uso', kicker: 'Integración · Developer Console',
      title: 'Una API, todos los sectores de tu operación',
      body: 'La API del Hub conecta Logística, Aduanas, RWA/Inmobiliario, Fintech/Pagos, Energía·VPP, Industria y Legal/Compliance con tu ERP, CRM o WooCommerce — vía SDK, webhooks o el Plugin WordPress.',
      tags: [['c', 'Logística · Aduanas'], ['g', 'RWA · Fintech'], ['p', 'Energía · Compliance']],
      visual: `
        <div class="phone">
          <div class="bar">{{ico:code}}<b>API · SECTORES</b></div>
          <div class="mini pop d1 row" style="flex-wrap:wrap;gap:6px"><span class="chip cyan">Logística</span><span class="chip cyan">Aduanas</span><span class="chip green">RWA</span></div>
          <div class="mini pop d2 row" style="flex-wrap:wrap;gap:6px"><span class="chip green">Fintech</span><span class="chip cyan">Energía·VPP</span><span class="chip cyan">Legal</span></div>
          <div class="mini pop d3" style="text-align:center;color:var(--secondary)"><div class="h" style="justify-content:center">{{ico:globe}} SDK · Webhooks · Plugin WP</div></div>
        </div>`,
    },
    {
      label: 'API · Core, holding y filiales', kicker: 'Integración · API & Sedes',
      title: 'Gestiona el acceso desde la matriz a cada filial',
      body: 'Desde "API & Sedes" la empresa core o holding emite una API Key por sede o filial, con su propio scope (marketplace, logística, pagos...), y ve el uso agregado por sede en un solo panel de facturación B2B.',
      tags: [['c', 'API Key por sede'], ['g', 'Scope propio'], ['', 'Uso agregado B2B']],
      visual: `
        <div class="phone">
          <div class="bar">{{ico:box}}<b>API & SEDES</b></div>
          <div class="mini pop"><div class="h">{{ico:code}} bk_live_madrid…</div><div class="s">Sede Madrid · scope: logistics, payments</div></div>
          <div class="mini pop d1"><div class="h">{{ico:code}} bk_live_algeciras…</div><div class="s">Sede Algeciras · scope: marketplace</div></div>
          <div class="mini pop d2 row"><div class="h">{{ico:chart}} Uso este mes</div><b style="margin-left:auto;color:var(--secondary)">48.2k req</b></div>
        </div>`,
    },
    {
      label: 'Plugin WordPress', kicker: 'Integración · Downloads',
      title: 'Todo el ecosistema, embebido en tu WordPress',
      body: 'Descarga el Plugin WordPress "Embedded Gateway": consola del Hub dentro de wp-admin, suscripción a planes en $BEZ, activación de Apps Nativas y BeZhas-Pay (shortcode + bloque + gateway WooCommerce), sin salir de tu web.',
      tags: [['c', 'wp-admin'], ['g', 'WooCommerce'], ['', 'Shortcode + bloque']],
      visual: `
        <div class="phone">
          <div class="bar">{{ico:globe}}<b>PLUGIN WORDPRESS</b><span class="rt">v2.0</span></div>
          <div class="mini pop"><div class="h">{{ico:box}} bezhas-hub-2.0.0.zip</div><div class="s">Plugins → Añadir nuevo → Subir</div></div>
          <div class="mini pop d1 row"><span class="chip green">Consola embebida</span><span class="chip cyan">Planes en $BEZ</span></div>
          <div class="mini pop d2 float" style="text-align:center;color:var(--secondary)"><div class="h" style="justify-content:center">{{ico:zap}} [bezhas_pay amount="99"]</div></div>
        </div>`,
    },
    {
      label: 'Planes & Suscripción', kicker: 'Finanzas · Cierre',
      title: 'Un plan por organización, Apps Nativas a la carta',
      body: 'Elige el plan de tu organización y activa solo las Apps Nativas que necesitas. Todo se paga en $BEZ, el combustible del ecosistema: cuanto más operas, más eficiente se vuelve tu operación.',
      tags: [['c', '4 planes'], ['g', 'Apps Nativas a la carta'], ['p', 'Pago en $BEZ']],
      visual: `
        <div class="phone">
          <div class="bar">{{ico:gift}}<b>PLANES & SUSCRIPCIÓN</b></div>
          <div class="mini pop row"><span class="chip cyan">Starter</span><span class="chip green">Business</span><span class="chip cyan">Pro</span><span class="chip green">Enterprise</span></div>
          <div class="mini pop d1" style="text-align:center;padding:18px"><div class="float">{{ico:shield}}</div><div class="s" style="margin-top:8px">Un ecosistema, un panel, un token</div></div>
        </div>`,
    },
  ],
};
