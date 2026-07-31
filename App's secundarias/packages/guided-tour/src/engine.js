// @bezhas/guided-tour — engine
// Framework-agnostic. Turns a tour config ({ appName, theme, scenes }) into a
// single self-contained HTML document (the animated "Cómo usar" walkthrough).
// No DOM, no dependencies — pure string building, so it runs at build time in Node
// and the OUTPUT is CSP-safe (everything inline, no external resources).

/** Shared lucide-style icon paths. Referenced from scenes via `{{ico:NAME}}`. */
export const ICONS = {
  map: '<path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3Z"/><path d="M9 3v15"/><path d="M15 6v15"/>',
  finger: '<path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M2 12a10 10 0 0 1 18-6"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/>',
  box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 0 1 0 20a15 15 0 0 1 0-20"/><path d="M2 12h20"/>',
  radio: '<path d="M4.9 19.1A10 10 0 0 1 4.9 4.9"/><path d="M7.8 16.2a6 6 0 0 1 0-8.4"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4"/><path d="M19.1 4.9a10 10 0 0 1 0 14.2"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z"/><path d="m9 12 2 2 4-4"/>',
  scale: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  anchor: '<path d="M12 22V8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/><circle cx="12" cy="5" r="3"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  cpu: '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"/>',
  pin: '<path d="M20 10c0 4.4-8 12-8 12s-8-7.6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8M16.5 8a2.5 2.5 0 0 0 0-5C13 3 12 8 12 8"/>',
};

const DEFAULT_THEME = {
  primary: '#00F0FF',
  secondary: '#79ff5b',
  gold: '#FFD700',
  pink: '#FF6B9D',
  purple: '#a855f7',
  bg: '#0A0A0C',
  surface: '#131316',
  card: '#17171b',
  border: '#2a2a30',
  text: '#e9e6e4',
  muted: '#9aa4a6',
  danger: '#f87171',
};

// Inline noise texture (SVG fractal noise as a data: URI — no network request,
// CSP-safe). Same technique used by the BeZhas Hub landing (`.bez-noise`).
const NOISE_DATA_URI = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** SVG markup for a shared/custom icon name. */
function svgFor(name, icons) {
  const paths = icons[name];
  if (!paths) return '';
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

/** Replace `{{ico:NAME}}` tokens anywhere in a string with inline SVG. */
function resolveTokens(str, icons) {
  return String(str == null ? '' : str).replace(/\{\{ico:([a-zA-Z0-9_]+)\}\}/g, (_, n) => svgFor(n, icons));
}

/**
 * Render a scene config into the walkthrough HTML.
 * @param {object} cfg
 * @param {string} cfg.appName       - shown in the top bar (e.g. "BZ CargoLink")
 * @param {string} [cfg.subtitle]    - top-bar subtitle (default "Cómo funciona")
 * @param {string} [cfg.logo]        - single emoji/char for the logo badge (default "◆")
 * @param {string} [cfg.title]       - <title> of the document
 * @param {string} [cfg.lang]        - html lang (default "es")
 * @param {number} [cfg.durationMs]  - ms per scene autoplay (default 7000)
 * @param {object} [cfg.theme]       - palette overrides (see DEFAULT_THEME)
 * @param {object} [cfg.icons]       - extra `{ name: '<path.../>' }` merged into ICONS
 * @param {Array}  cfg.scenes        - [{ label, kicker, title, body, tags:[[cls,txt]], visual }]
 * @returns {string} full self-contained HTML document
 */
export function renderTourHTML(cfg = {}) {
  const {
    appName = 'BeZhas',
    subtitle = 'Cómo funciona',
    logo = '◆',
    title = `Cómo usar ${appName} — Recorrido animado`,
    lang = 'es',
    durationMs = 7000,
    theme = {},
    icons = {},
    scenes = [],
  } = cfg;

  if (!Array.isArray(scenes) || scenes.length === 0) {
    throw new Error('renderTourHTML: `scenes` must be a non-empty array');
  }

  const palette = { ...DEFAULT_THEME, ...theme };
  const iconSet = { ...ICONS, ...icons };

  // Bake icon tokens into scene strings so the browser player only injects innerHTML.
  // `label` is rendered via textContent (auto-escaped), so keep it raw — escaping
  // here would double-escape (e.g. "&" → "&amp;" shown literally).
  const baked = scenes.map((s) => ({
    label: String(s.label || ''),
    kicker: resolveTokens(s.kicker, iconSet),
    title: resolveTokens(s.title, iconSet),
    body: resolveTokens(s.body, iconSet),
    tags: Array.isArray(s.tags) ? s.tags.map((t) => [t[0] || '', resolveTokens(t[1], iconSet)]) : [],
    visual: resolveTokens(s.visual || '', iconSet),
  }));

  const rootVars = Object.entries(palette).map(([k, v]) => `--${k}: ${v};`).join(' ');

  return `<!DOCTYPE html>
<html lang="${esc(lang)}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<style>
  :root { ${rootVars} }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { height: 100%; background: var(--bg); color: var(--text); font-family: 'Space Grotesk', system-ui, -apple-system, Segoe UI, Roboto, sans-serif; overflow: hidden; }
  body { display: flex; align-items: center; justify-content: center;
    background: radial-gradient(1100px 600px at 78% -10%, color-mix(in srgb, var(--primary) 10%, transparent), transparent 60%), radial-gradient(900px 600px at 10% 110%, color-mix(in srgb, var(--purple) 10%, transparent), transparent 55%), var(--bg); }

  .stage { --mx: 50%; --my: 50%; width: min(960px, 96vw); height: min(640px, 94vh); background: linear-gradient(160deg, color-mix(in srgb, var(--surface) 92%, #fff 0%), var(--bg)); border: 1px solid var(--border); border-radius: 22px; box-shadow: 0 30px 90px rgba(0,0,0,0.6); display: flex; flex-direction: column; overflow: hidden; position: relative; }

  /* Animated mesh-gradient backdrop, same language as the Hub landing hero */
  .mesh { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
  .mesh i { position: absolute; border-radius: 50%; filter: blur(60px); opacity: .5; }
  .mesh .m1 { width: 320px; height: 320px; left: -70px; top: -110px; background: var(--primary); animation: meshA 17s ease-in-out infinite; }
  .mesh .m2 { width: 300px; height: 300px; right: -90px; top: 36%; background: var(--purple); animation: meshB 21s ease-in-out infinite; }
  .mesh .m3 { width: 260px; height: 260px; left: 28%; bottom: -130px; background: var(--pink); animation: meshC 19s ease-in-out infinite; }
  @keyframes meshA { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(46px,32px) scale(1.15); } }
  @keyframes meshB { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-34px,22px) scale(.9); } }
  @keyframes meshC { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(22px,-30px) scale(1.1); } }

  /* Subtle noise texture over the whole card, like GlassCard's .bez-noise */
  .noise { position: absolute; inset: 0; z-index: 2; pointer-events: none; opacity: .05; mix-blend-mode: overlay; background-image: url("${NOISE_DATA_URI}"); }

  /* Cursor-tracked spotlight border glow (mask-composite ring trick) */
  .stage::after { content: ''; position: absolute; inset: 0; z-index: 3; pointer-events: none; border-radius: 22px; padding: 1px;
    background: radial-gradient(240px circle at var(--mx) var(--my), color-mix(in srgb, var(--primary) 60%, transparent), transparent 70%);
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor; mask-composite: exclude;
    opacity: 0; transition: opacity .3s ease; }
  .stage:hover::after { opacity: 1; }

  .topbar { position: relative; z-index: 1; display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.015); }
  .brand { display: flex; align-items: center; gap: 10px; }
  .logo { width: 30px; height: 30px; border-radius: 9px; background: conic-gradient(from 210deg, var(--primary), var(--purple), var(--pink), var(--primary)); display: grid; place-items: center; color: #04121a; font-weight: 900; font-size: 15px; box-shadow: 0 0 22px color-mix(in srgb, var(--primary) 35%, transparent); }
  .brand b { font-size: 14px; letter-spacing: 1px; }
  .brand span { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 2px; }
  .step-pill { margin-left: auto; font-size: 11px; font-weight: 800; color: var(--primary); background: color-mix(in srgb, var(--primary) 8%, transparent); border: 1px solid color-mix(in srgb, var(--primary) 25%, transparent); padding: 5px 12px; border-radius: 20px; box-shadow: 0 0 18px color-mix(in srgb, var(--primary) 22%, transparent); }

  .progress { position: relative; z-index: 1; display: flex; gap: 6px; padding: 12px 20px 4px; }
  .progress i { flex: 1; height: 4px; border-radius: 3px; background: #23232a; overflow: hidden; position: relative; cursor: pointer; }
  .progress i > b { position: absolute; inset: 0; width: 0; background: linear-gradient(90deg, var(--primary), var(--purple)); border-radius: 3px; }
  .progress i.done > b { width: 100%; }
  .progress i.active > b { animation: fill var(--dur) linear forwards; }
  .stage:hover .progress i.active > b { animation-play-state: paused; }
  @keyframes fill { from { width: 0; } to { width: 100%; } }

  /* Clickable scene rail — jump straight to any step, doubles as a mini table of contents */
  .rail { position: relative; z-index: 1; display: flex; gap: 7px; padding: 2px 20px 12px; overflow-x: auto; scrollbar-width: none; }
  .rail::-webkit-scrollbar { display: none; }
  .railItem { flex: 0 0 auto; display: flex; align-items: center; gap: 6px; font-size: 10.5px; font-weight: 700; color: var(--muted); background: color-mix(in srgb, var(--card) 85%, transparent); border: 1px solid var(--border); padding: 6px 11px; border-radius: 20px; cursor: pointer; white-space: nowrap; transition: color .15s, border-color .15s, background .15s, transform .15s; }
  .railItem:hover { color: var(--text); border-color: color-mix(in srgb, var(--primary) 45%, var(--border)); transform: translateY(-1px); }
  .railItem.active { color: #04121a; background: linear-gradient(120deg, var(--primary), var(--purple)); border-color: transparent; }
  .railItem .n { font-size: 9px; opacity: .7; }

  .scenes { position: relative; z-index: 1; flex: 1; }
  .scene { position: absolute; inset: 0; display: grid; grid-template-columns: 1.05fr 1fr; gap: 8px; padding: 22px 26px; opacity: 0; transform: translateY(14px) scale(0.99); filter: blur(6px); pointer-events: none; transition: opacity .5s ease, transform .5s ease, filter .5s ease; }
  .scene.active { opacity: 1; transform: none; filter: blur(0); pointer-events: auto; }
  .copy { align-self: center; padding-right: 8px; }
  .kicker { display: inline-flex; align-items: center; gap: 7px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: var(--primary); margin-bottom: 12px; }
  .kicker .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--primary); box-shadow: 0 0 10px var(--primary); }
  .scene h2 { font-size: clamp(22px, 3.2vw, 30px); font-weight: 900; line-height: 1.08; margin-bottom: 12px;
    background: linear-gradient(120deg, var(--secondary), var(--primary) 45%, var(--purple) 85%);
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }
  .scene p { font-size: 13.5px; color: var(--muted); line-height: 1.65; max-width: 40ch; }
  .scene .tags { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 16px; }
  .tag { font-size: 10.5px; font-weight: 700; color: var(--text); background: color-mix(in srgb, var(--card) 80%, #fff 0%); border: 1px solid var(--border); padding: 5px 10px; border-radius: 8px; }
  .tag.g { color: var(--secondary); border-color: color-mix(in srgb, var(--secondary) 30%, transparent); }
  .tag.c { color: var(--primary); border-color: color-mix(in srgb, var(--primary) 30%, transparent); }
  .tag.p { color: var(--pink); border-color: color-mix(in srgb, var(--pink) 30%, transparent); }
  .visual { position: relative; display: grid; place-items: center; }
  .phone { width: 300px; max-width: 100%; height: 400px; border-radius: 24px; background: linear-gradient(180deg, var(--card), var(--bg)); border: 1px solid #2c2c34; box-shadow: 0 20px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04); padding: 14px; overflow: hidden; position: relative; }
  .phone .bar { display: flex; align-items: center; gap: 6px; margin-bottom: 12px; }
  .phone .bar b { font-size: 10px; letter-spacing: 1px; color: var(--primary); font-weight: 800; }
  .phone .bar .rt { margin-left: auto; font-size: 9px; color: var(--muted); }
  .mini { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; margin-bottom: 9px; }
  .mini .h { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 800; }
  .mini .s { font-size: 9px; color: var(--muted); margin-top: 3px; }
  .row { display: flex; align-items: center; gap: 8px; }
  .chip { font-size: 8.5px; font-weight: 800; padding: 2px 7px; border-radius: 6px; }
  .chip.red { background: color-mix(in srgb, var(--danger) 15%, transparent); color: var(--danger); }
  .chip.green { background: color-mix(in srgb, var(--secondary) 15%, transparent); color: var(--secondary); }
  .chip.amber { background: color-mix(in srgb, var(--gold) 14%, transparent); color: var(--gold); }
  .chip.cyan { background: color-mix(in srgb, var(--primary) 14%, transparent); color: var(--primary); }
  .icon { width: 16px; height: 16px; display: inline-block; }
  .scene.active .float { animation: floaty 3s ease-in-out infinite; }
  @keyframes floaty { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
  .scene.active .pop { animation: pop .6s cubic-bezier(.2,1.2,.3,1) both; }
  .scene.active .pop.d1 { animation-delay: .15s; } .scene.active .pop.d2 { animation-delay: .3s; }
  .scene.active .pop.d3 { animation-delay: .45s; } .scene.active .pop.d4 { animation-delay: .6s; }
  @keyframes pop { from { opacity: 0; transform: translateY(10px) scale(.96); } to { opacity: 1; transform: none; } }
  .scene.active .draw { stroke-dasharray: 260; stroke-dashoffset: 260; animation: draw 2s ease forwards .3s; }
  @keyframes draw { to { stroke-dashoffset: 0; } }
  .scene.active .ping { animation: ping 1.8s ease-out infinite; }
  @keyframes ping { 0% { transform: scale(.6); opacity: .9; } 100% { transform: scale(2.4); opacity: 0; } }
  .bars b { display:block; height:6px; border-radius:4px; background:linear-gradient(90deg,var(--primary),var(--purple)); margin-top:6px; }
  .scene.active .bars b { animation: grow 1.2s ease forwards; transform-origin:left; transform:scaleX(0); }
  @keyframes grow { to { transform: scaleX(1); } }

  .controls { position: relative; z-index: 1; display: flex; align-items: center; gap: 10px; padding: 12px 20px; border-top: 1px solid var(--border); background: rgba(255,255,255,0.015); }
  .controls button { background: color-mix(in srgb, var(--card) 85%, #fff 0%); border: 1px solid var(--border); color: var(--text); border-radius: 10px; padding: 9px 14px; font-size: 12px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; transition: transform .15s ease, border-color .15s, color .15s; }
  .controls button:hover { border-color: var(--primary); color: var(--primary); }
  .controls .primary { background: linear-gradient(135deg, var(--primary), var(--purple)); color: #05121a; border: none; }
  .controls .spacer { flex: 1; }
  .controls .label { font-size: 11px; color: var(--muted); }
  .hint { position: relative; z-index: 1; text-align: center; font-size: 9.5px; color: var(--muted); opacity: .55; padding: 0 20px 10px; }
  @media (max-width: 720px) { .scene { grid-template-columns: 1fr; padding: 16px; } .visual { display: none; } .scene h2 { font-size: 22px; } .rail { display: none; } }
  @media (prefers-reduced-motion: reduce) { .mesh i { animation: none; } .scene { transition: opacity .3s ease; filter: none; } .scene.active .float, .scene.active .pop, .scene.active .draw, .scene.active .ping, .scene.active .bars b { animation: none; } }
</style>
</head>
<body>
  <div class="stage" id="stage">
    <div class="mesh" aria-hidden="true"><i class="m1"></i><i class="m2"></i><i class="m3"></i></div>
    <div class="topbar">
      <div class="brand">
        <div class="logo">${esc(logo)}</div>
        <div><b>${esc(appName)}</b><br><span>${esc(subtitle)}</span></div>
      </div>
      <div class="step-pill" id="stepPill">1 / ${baked.length}</div>
    </div>
    <div class="progress" id="progress"></div>
    <div class="rail" id="rail"></div>
    <div class="scenes" id="scenes"></div>
    <div class="controls">
      <button id="prevBtn" title="Anterior">‹ Anterior</button>
      <button id="playBtn" class="primary">⏸ Pausa</button>
      <button id="nextBtn" title="Siguiente">Siguiente ›</button>
      <div class="spacer"></div>
      <span class="label" id="sceneLabel"></span>
      <button id="replayBtn" title="Reiniciar">↻ Reiniciar</button>
    </div>
    <div class="hint">Pasa el cursor para pausar · ← → para navegar · espacio para pausar · clic en un paso para saltar</div>
    <div class="noise" aria-hidden="true"></div>
  </div>
<script>
const DUR = ${Number(durationMs) || 7000};
const SCENES = ${JSON.stringify(baked)};
document.documentElement.style.setProperty('--dur', DUR + 'ms');
const stageEl = document.getElementById('stage');
const scenesEl = document.getElementById('scenes');
const progressEl = document.getElementById('progress');
const railEl = document.getElementById('rail');
SCENES.forEach((s, i) => {
  const el = document.createElement('div');
  el.className = 'scene';
  el.innerHTML = '<div class="copy"><div class="kicker"><span class="dot"></span>' + s.kicker + '</div>' +
    '<h2>' + s.title + '</h2><p>' + s.body + '</p>' +
    '<div class="tags">' + s.tags.map(t => '<span class="tag ' + t[0] + '">' + t[1] + '</span>').join('') + '</div></div>' +
    '<div class="visual">' + s.visual + '</div>';
  scenesEl.appendChild(el);

  const p = document.createElement('i');
  p.innerHTML = '<b></b>';
  p.addEventListener('click', () => goTo(i));
  progressEl.appendChild(p);

  const r = document.createElement('div');
  r.className = 'railItem';
  const n = document.createElement('span');
  n.className = 'n';
  n.textContent = String(i + 1).padStart(2, '0');
  const label = document.createElement('span');
  label.textContent = s.label; // textContent, never innerHTML — labels may contain raw "&"
  r.appendChild(n);
  r.appendChild(label);
  r.addEventListener('click', () => goTo(i));
  railEl.appendChild(r);
});
const sceneEls = [...scenesEl.children];
const progEls = [...progressEl.children];
const railEls = [...railEl.children];
let idx = 0, playing = true, hovering = false, timer = null;
const stepPill = document.getElementById('stepPill');
const sceneLabel = document.getElementById('sceneLabel');
const playBtn = document.getElementById('playBtn');
function render() {
  sceneEls.forEach((el, i) => el.classList.toggle('active', i === idx));
  progEls.forEach((el, i) => {
    el.classList.toggle('done', i < idx);
    el.classList.toggle('active', i === idx && playing);
    if (i !== idx) el.querySelector('b').style.width = i < idx ? '100%' : '0';
  });
  railEls.forEach((el, i) => {
    el.classList.toggle('active', i === idx);
    if (i === idx) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  });
  stepPill.textContent = (idx + 1) + ' / ' + SCENES.length;
  sceneLabel.textContent = SCENES[idx].label;
}
function schedule() { clearTimeout(timer); if (playing && !hovering) timer = setTimeout(() => goTo((idx + 1) % SCENES.length), DUR); }
function goTo(i) { idx = (i + SCENES.length) % SCENES.length; render(); schedule(); }
function setPlaying(v) { playing = v; playBtn.innerHTML = playing ? '⏸ Pausa' : '▶ Reproducir'; render(); schedule(); }
document.getElementById('nextBtn').onclick = () => goTo(idx + 1);
document.getElementById('prevBtn').onclick = () => goTo(idx - 1);
document.getElementById('replayBtn').onclick = () => { setPlaying(true); goTo(0); };
playBtn.onclick = () => setPlaying(!playing);
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') goTo(idx + 1);
  else if (e.key === 'ArrowLeft') goTo(idx - 1);
  else if (e.key === ' ') { e.preventDefault(); setPlaying(!playing); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(timer); else schedule(); });
// Pause autoplay while the cursor is over the stage — resumes automatically on leave.
stageEl.addEventListener('mouseenter', () => { hovering = true; clearTimeout(timer); });
stageEl.addEventListener('mouseleave', () => { hovering = false; schedule(); });
// Cursor-tracked spotlight border glow.
stageEl.addEventListener('mousemove', (e) => {
  const r = stageEl.getBoundingClientRect();
  stageEl.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
  stageEl.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
});
// Subtle magnetic hover on the control buttons.
[...document.querySelectorAll('.controls button')].forEach((btn) => {
  btn.addEventListener('mousemove', (e) => {
    const r = btn.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) * 0.25;
    const y = (e.clientY - r.top - r.height / 2) * 0.35;
    btn.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  });
  btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
});
render(); schedule();
</script>
</body>
</html>
`;
}

export default { renderTourHTML, ICONS };
