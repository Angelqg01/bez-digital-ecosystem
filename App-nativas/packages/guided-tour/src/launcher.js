// @bezhas/guided-tour — vanilla in-app launcher
// Framework-agnostic, zero dependencies. Mounts a modal that plays the generated
// `public/como-usar.html` inside an <iframe>. Works in React, Vue, or plain apps:
// the host only needs to fire a window CustomEvent to open it.
//
//   import { mountGuidedTour } from '@bezhas/guided-tour'
//   mountGuidedTour({ appName: 'BZ CargoLink' })            // once, at startup
//   // open from anywhere (e.g. a header button):
//   window.dispatchEvent(new CustomEvent('guided-tour:open'))

const STYLE_ID = 'bez-guided-tour-style';

const CSS = `
.bez-gt-overlay{position:fixed;inset:0;z-index:2000;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;background:rgba(4,6,12,.82);backdrop-filter:blur(10px);opacity:0;transition:opacity .25s ease}
.bez-gt-overlay.open{opacity:1}
.bez-gt-modal{width:min(1000px,100%);max-height:92vh;display:flex;flex-direction:column;transform:translateY(24px) scale(.98);transition:transform .3s cubic-bezier(.16,1,.3,1)}
.bez-gt-overlay.open .bez-gt-modal{transform:none}
.bez-gt-head{display:flex;align-items:center;gap:10px;margin-bottom:10px;color:#fff;font-family:'Space Grotesk',system-ui,sans-serif}
.bez-gt-title{font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:1px}
.bez-gt-play{color:#00F0FF;font-size:16px}
.bez-gt-open{margin-left:auto;font-size:11px;color:#9aa4a6;text-decoration:none;border:1px solid #2a2a30;border-radius:8px;padding:5px 10px}
.bez-gt-close{background:#1b1b21;border:1px solid #2a2a30;border-radius:8px;color:#fff;width:32px;height:32px;display:grid;place-items:center;cursor:pointer;font-size:16px;line-height:1}
.bez-gt-frame-wrap{flex:1;border-radius:18px;overflow:hidden;border:1px solid #2a2a30;box-shadow:0 30px 90px rgba(0,0,0,.6);background:#0A0A0C}
.bez-gt-frame{width:100%;height:min(640px,82vh);border:none;display:block}
`;

function injectStyle() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}

/**
 * Mount the guided-tour launcher.
 * @param {object} [opts]
 * @param {string} [opts.src='/como-usar.html'] - URL of the generated walkthrough
 * @param {string} [opts.appName='BeZhas']      - shown in the modal header
 * @param {string} [opts.eventName='guided-tour:open'] - window event that opens it
 * @param {string} [opts.seenKey='bez_tour_seen_v1']   - localStorage flag for auto-show
 * @param {boolean}[opts.autoShow=true]          - auto-open on first visit
 * @param {number} [opts.delayMs=1200]           - delay before the first auto-open
 * @returns {{open:Function, close:Function, destroy:Function}}
 */
export function mountGuidedTour(opts = {}) {
  const {
    src = '/como-usar.html',
    appName = 'BeZhas',
    eventName = 'guided-tour:open',
    seenKey = 'bez_tour_seen_v1',
    autoShow = true,
    delayMs = 1200,
  } = opts;

  if (typeof document === 'undefined') return { open() {}, close() {}, destroy() {} };
  injectStyle();

  const overlay = document.createElement('div');
  overlay.className = 'bez-gt-overlay';
  overlay.style.display = 'none';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML =
    '<div class="bez-gt-modal">' +
      '<div class="bez-gt-head">' +
        '<span class="bez-gt-play">▶</span>' +
        '<span class="bez-gt-title">Cómo usar ' + appName.replace(/</g, '') + '</span>' +
        '<a class="bez-gt-open" target="_blank" rel="noopener noreferrer" href="' + src + '">Abrir en pestaña ↗</a>' +
        '<button class="bez-gt-close" aria-label="Cerrar recorrido">✕</button>' +
      '</div>' +
      '<div class="bez-gt-frame-wrap"><iframe class="bez-gt-frame" title="Recorrido ' + appName.replace(/</g, '') + '"></iframe></div>' +
    '</div>';

  const iframe = overlay.querySelector('.bez-gt-frame');
  const modal = overlay.querySelector('.bez-gt-modal');
  let rafId = 0;

  function markSeen() { try { localStorage.setItem(seenKey, '1'); } catch (_) { /* ignore */ } }

  function open() {
    if (!iframe.src) iframe.src = src; // lazy-load on first open
    overlay.style.display = 'flex';
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => overlay.classList.add('open'));
  }
  function close() {
    overlay.classList.remove('open');
    markSeen();
    setTimeout(() => { overlay.style.display = 'none'; }, 260);
  }

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  modal.addEventListener('click', (e) => e.stopPropagation());
  overlay.querySelector('.bez-gt-close').addEventListener('click', close);
  const onKey = (e) => { if (e.key === 'Escape' && overlay.classList.contains('open')) close(); };
  const onEvent = () => open();
  document.addEventListener('keydown', onKey);
  window.addEventListener(eventName, onEvent);
  document.body.appendChild(overlay);

  let autoTimer = 0;
  if (autoShow) {
    let seen = false;
    try { seen = !!localStorage.getItem(seenKey); } catch (_) { /* ignore */ }
    if (!seen) autoTimer = setTimeout(open, delayMs);
  }

  function destroy() {
    clearTimeout(autoTimer);
    cancelAnimationFrame(rafId);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener(eventName, onEvent);
    overlay.remove();
  }

  return { open, close, destroy };
}

/** Fire the open event from anywhere (e.g. a header button's onClick). */
export function openGuidedTour(eventName = 'guided-tour:open') {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(eventName));
}

export default { mountGuidedTour, openGuidedTour };
