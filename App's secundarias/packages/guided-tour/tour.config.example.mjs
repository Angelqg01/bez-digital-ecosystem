// Plantilla de configuración de recorrido para una SubApp BeZhas.
// Copia este archivo a la raíz de tu SubApp como `tour.config.mjs`, cámbialo por
// las funciones REALES de tu app y genera el HTML con:
//
//   node "../packages/guided-tour/bin/generate.mjs" tour.config.mjs public/como-usar.html
//
// Referencias de icono en cualquier texto/visual: {{ico:NAME}}
// Iconos disponibles: map finger box globe radio shield scale anchor wallet cpu
//   pin code play scan zap coins users chart lock gift  (añade propios en `icons`)
// Clases de etiqueta (tags): '' (neutra) · 'c' (primario) · 'g' (verde) · 'p' (rosa)

export default {
  appName: 'BZ Ejemplo',
  subtitle: 'Cómo funciona',
  logo: '◆',               // emoji o carácter del badge
  durationMs: 7000,         // ms por escena

  // Sobrescribe solo lo que quieras; el resto usa el tema BeZhas por defecto.
  theme: {
    primary: '#00F0FF',
    secondary: '#79ff5b',
    // gold, pink, purple, bg, surface, card, border, text, muted, danger…
  },

  // (opcional) iconos propios: { miIcono: '<path d="..."/>' }
  icons: {},

  scenes: [
    {
      label: 'Introducción',
      kicker: 'BZ Ejemplo',
      title: 'Una frase que engancha sobre tu SubApp',
      body: 'Explica en 1–2 frases qué resuelve la app y por qué importa. Contenido real, nada de relleno.',
      tags: [['c', 'Beneficio 1'], ['g', 'Beneficio 2'], ['p', 'Beneficio 3']],
      visual: `
        <div class="phone">
          <div class="bar">{{ico:anchor}}<b>MI SUBAPP</b><span class="rt">live</span></div>
          <div class="mini pop"><div class="h">{{ico:radio}} Una función</div><div class="s">breve descripción</div></div>
          <div class="mini pop d1"><div class="h">{{ico:scale}} Otra función</div><div class="row" style="margin-top:6px"><span class="chip cyan">dato</span><span class="chip green">estado</span></div></div>
          <div class="mini pop d2 float" style="text-align:center;color:var(--secondary)"><div class="h" style="justify-content:center">{{ico:shield}} Cierre</div></div>
        </div>`,
    },
    {
      label: 'Pantalla 1',
      kicker: 'Pestaña · Nombre',
      title: 'Qué hace esta pantalla',
      body: 'Cómo la usa el usuario, paso a paso, en lenguaje claro.',
      tags: [['c', 'Acción'], ['', 'Detalle']],
      visual: `
        <div class="phone">
          <div class="bar">{{ico:box}}<b>PANTALLA 1</b></div>
          <div class="mini pop"><div class="h">Elemento</div><div class="s">estado</div></div>
          <div class="mini pop d1 row"><span class="chip green">OK</span><span class="chip cyan">info</span></div>
        </div>`,
    },
    // … una escena por función principal (6–10 en total).
  ],
};
