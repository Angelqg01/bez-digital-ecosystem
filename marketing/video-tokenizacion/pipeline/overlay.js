// Capa de recorrido para las escenas de pantalla: cursor, marca de paso, anillos de resalte y aviso de demostración.
// No toca la página: vive en un nodo propio fuera del <body>, con pointer-events:none.
(() => {
  if (window.__ov) return;
  const css = `
  #bz-ov{position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:'Syne','Inter',system-ui,sans-serif}
  #bz-ov *{box-sizing:border-box}
  .ov-cur{position:fixed;left:0;top:0;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;border:2px solid #00D4AA;background:rgba(0,212,170,.16);box-shadow:0 0 18px rgba(0,212,170,.55);transition:transform .02s linear}
  .ov-cur.click{animation:ovclick .45s ease-out}
  @keyframes ovclick{0%{box-shadow:0 0 0 0 rgba(255,215,0,.7);background:rgba(255,215,0,.5)}100%{box-shadow:0 0 0 26px rgba(255,215,0,0);background:rgba(0,212,170,.16)}}
  .ov-badge{position:fixed;left:50%;top:14px;transform:translate(-50%,-30px);opacity:0;display:flex;align-items:center;gap:10px;padding:8px 18px 8px 8px;border-radius:999px;
    background:rgba(7,11,20,.82);backdrop-filter:blur(10px);border:1px solid rgba(0,212,170,.45);color:#fff;font-weight:700;font-size:15px;letter-spacing:.2px;box-shadow:0 8px 30px rgba(0,0,0,.45);transition:all .5s cubic-bezier(.2,.8,.2,1)}
  .ov-badge.on{transform:translate(-50%,0);opacity:1}
  .ov-badge b{display:grid;place-items:center;min-width:30px;height:30px;padding:0 8px;border-radius:999px;background:linear-gradient(135deg,#00D4AA,#FFD700);color:#07101a !important;-webkit-text-fill-color:#07101a;font-size:13px}
  .ov-badge i{font-style:normal;font-weight:500;color:#9fb4c7;font-size:13px}
  .ov-ring{position:fixed;border-radius:14px;border:2px solid #FFD700;box-shadow:0 0 0 4px rgba(255,215,0,.14),0 0 28px rgba(255,215,0,.45);opacity:0;transition:all .45s ease}
  .ov-ring.on{opacity:1}
  .ov-tag{position:fixed;opacity:0;transform:translateY(6px);padding:6px 12px;border-radius:10px;background:#FFD700;color:#07101a !important;-webkit-text-fill-color:#07101a;font-weight:800;font-size:13px;white-space:nowrap;box-shadow:0 6px 20px rgba(0,0,0,.4);transition:all .4s ease}
  .ov-tag.on{opacity:1;transform:none}
  .ov-demo{position:fixed;left:14px;bottom:30px;padding:5px 12px;border-radius:999px;background:rgba(255,107,157,.16);border:1px solid rgba(255,107,157,.6);color:#ff9fbf;font-weight:800;font-size:11px;letter-spacing:1.4px;text-transform:uppercase}
  .ov-legal{position:fixed;left:0;right:0;bottom:6px;text-align:center;font:500 11px 'Inter',system-ui,sans-serif;color:rgba(190,205,220,.78);padding:0 40px;text-shadow:0 1px 3px #000}
  .ov-fade{position:fixed;inset:0;background:#070b14;opacity:0;transition:opacity .45s ease}
  .ov-fade.on{opacity:1}
  `;
  const st = document.createElement('style'); st.textContent = css; document.documentElement.appendChild(st);
  const root = document.createElement('div'); root.id = 'bz-ov'; document.documentElement.appendChild(root);
  const mk = (cls, html = '') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; root.appendChild(d); return d; };
  const cur = mk('ov-cur'); cur.style.transform = 'translate(-100px,-100px)';
  addEventListener('mousemove', (e) => { cur.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; }, true);
  addEventListener('mousedown', () => { cur.classList.remove('click'); void cur.offsetWidth; cur.classList.add('click'); }, true);
  const badge = mk('ov-badge'); const ring = mk('ov-ring'); const tag = mk('ov-tag'); const fade = mk('ov-fade on');
  let demo = null, legal = null;
  window.__ov = {
    badge(n, text, sub = '') { badge.innerHTML = `<b>${n}</b>${text}${sub ? ` <i>${sub}</i>` : ''}`; badge.classList.add('on'); },
    hideBadge() { badge.classList.remove('on'); },
    ring(x, y, w, h, label = '', labelDy = -40) {
      Object.assign(ring.style, { left: `${x - 8}px`, top: `${y - 8}px`, width: `${w + 16}px`, height: `${h + 16}px` }); ring.classList.add('on');
      if (label) {
        tag.textContent = label; tag.style.left = '0px';
        // el rótulo no puede salirse del encuadre por la derecha (p. ej. cuando el elemento está pegado al borde)
        Object.assign(tag.style, { left: `${Math.max(8, Math.min(x, innerWidth - tag.offsetWidth - 14))}px`, top: `${Math.max(8, y + labelDy)}px` }); tag.classList.add('on');
      } else tag.classList.remove('on');
    },
    clearRing() { ring.classList.remove('on'); tag.classList.remove('on'); },
    fade(on) { fade.classList.toggle('on', !!on); },
    footer(legalText, demoText) {
      if (!legal) legal = mk('ov-legal'); legal.textContent = legalText;
      if (demoText) { if (!demo) demo = mk('ov-demo'); demo.textContent = demoText; }
    },
  };
})();
