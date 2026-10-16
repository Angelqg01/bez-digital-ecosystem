/**
 * HeaderMenu — el botón de configuración de la cabecera de las SubApps.
 *
 * Reúne en un solo desplegable todo lo que antes eran botones sueltos en la cabecera (cómo usar, configuración, API Hub,
 * organización…). Deja la cabecera con el título, este botón y el acceso de usuario, que se queda fuera a propósito: es
 * lo que el visitante necesita ver para iniciar sesión.
 *
 * Props:
 *   items     [{ key, label, icon?, to?, onClick?, hidden?, hint? }]  `to` navega con onNavigate; `onClick` ejecuta.
 *   auth      el acceso de usuario (HeaderAuthButton): va arriba del menú y lo cierra al pulsarlo
 *   children  contenido extra dentro del menú (p. ej. el selector de organización)
 *   onNavigate(to)  navegación de la app (useNavigate); sin ella, los items con `to` hacen location.assign
 *   label     texto del botón (se oculta en móvil, queda el icono)
 *   accent    color de realce
 * Accesible: aria-haspopup/expanded, Escape cierra y devuelve el foco, clic fuera cierra, flechas recorren los items.
 */
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Settings } from 'lucide-react';

const CSS = `
.bzhm{position:relative;display:inline-block;font-family:inherit}
.bzhm-btn{display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;
  color:var(--bzhm-fg,#e6edf3);background:var(--bzhm-bg,rgba(255,255,255,.06));border:1px solid var(--bzhm-border,rgba(255,255,255,.14))}
.bzhm-btn:hover,.bzhm-btn[aria-expanded=true]{border-color:var(--bzhm-accent,#00f0ff)}
.bzhm-btn:focus-visible,.bzhm-item:focus-visible{outline:2px solid var(--bzhm-accent,#00f0ff);outline-offset:2px}
.bzhm-pop{position:absolute;right:0;top:calc(100% + 8px);z-index:1000;min-width:230px;max-width:min(320px,calc(100vw - 24px));padding:6px;border-radius:12px;
  background:var(--bzhm-pop,#11161d);border:1px solid var(--bzhm-border,rgba(255,255,255,.14));box-shadow:0 12px 32px rgba(0,0,0,.5)}
.bzhm-item{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:10px 12px;border:0;border-radius:8px;background:transparent;
  color:var(--bzhm-fg,#e6edf3);font-size:13px;font-weight:600;cursor:pointer}
.bzhm-item:hover{background:rgba(255,255,255,.07)}
.bzhm-hint{display:block;font-size:11px;font-weight:400;color:var(--bzhm-muted,#8aa0b4)}
.bzhm-auth{padding:6px 6px 8px;margin-bottom:4px;border-bottom:1px solid var(--bzhm-border,rgba(255,255,255,.14))}
.bzhm-auth>div{flex-wrap:wrap}
.bzhm-extra{padding:8px 6px 4px;border-top:1px solid var(--bzhm-border,rgba(255,255,255,.14));margin-top:4px}
@media (max-width:640px){.bzhm-label{display:none}}
`;

export default function HeaderMenu({ items = [], children = null, auth = null, onNavigate, label = 'Config', accent, title = 'Configuración' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const btnRef = useRef(null);
  const popId = useId();
  const visible = items.filter((i) => i && !i.hidden);

  const close = useCallback((returnFocus = false) => {
    setOpen(false);
    if (returnFocus) btnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) close(); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(true); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  const run = (item) => {
    close();
    if (item.onClick) item.onClick();
    else if (item.to) (onNavigate ? onNavigate(item.to) : window.location.assign(item.to));
  };

  const onMenuKey = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const els = [...(rootRef.current?.querySelectorAll('.bzhm-item') || [])];
    if (!els.length) return;
    e.preventDefault();
    const i = els.indexOf(document.activeElement);
    els[(i + (e.key === 'ArrowDown' ? 1 : -1) + els.length) % els.length].focus();
  };

  const style = accent ? { '--bzhm-accent': accent } : undefined;

  return (
    <div className="bzhm" ref={rootRef} style={style} data-testid="header-menu">
      <style>{CSS}</style>
      <button ref={btnRef} type="button" className="bzhm-btn" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? popId : undefined}
        title={title} onClick={() => setOpen((o) => !o)}>
        <Settings size={16} color="var(--bzhm-accent,#00f0ff)" aria-hidden="true" />
        <span className="bzhm-label">{label}</span>
      </button>
      {open && (
        <div id={popId} className="bzhm-pop" role="menu" aria-label={title} onKeyDown={onMenuKey}>
          {auth ? (
            <div className="bzhm-auth" data-testid="header-menu-auth"
              onClick={(e) => { if (e.target.closest('button')) setTimeout(() => close(), 0); }}>
              {auth}
            </div>
          ) : null}
          {visible.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.key || item.label} type="button" role="menuitem" className="bzhm-item" onClick={() => run(item)}>
                {Icon ? <Icon size={16} color="var(--bzhm-accent,#00f0ff)" aria-hidden="true" /> : null}
                <span>{item.label}{item.hint ? <span className="bzhm-hint">{item.hint}</span> : null}</span>
              </button>
            );
          })}
          {children ? <div className="bzhm-extra">{children}</div> : null}
        </div>
      )}
    </div>
  );
}
