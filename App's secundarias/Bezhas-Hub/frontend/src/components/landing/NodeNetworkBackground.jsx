/**
 * NodeNetworkBackground — fondo animado de "conexión de nodos" (canvas).
 * Partículas que se desplazan y se conectan con líneas cuando están cerca,
 * y reaccionan al cursor (las líneas se enlazan al ratón). Ligero y con
 * cleanup. Tema visual de la red BeZhas: nodos cian sobre fondo profundo.
 */
import React, { useRef, useEffect } from 'react';

export default function NodeNetworkBackground({
  color = '0,240,255',          // RGB de las líneas/nodos (neon cyan)
  accent = '16,185,129',        // RGB de acento (emerald)
  density = 0.00009,            // nodos por píxel
  maxLink = 150,                // distancia máx. de enlace (px)
  className = '',
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const mouse = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    let nodes = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(110, Math.max(28, Math.floor(w * h * density)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        a: Math.random() < 0.18, // algunos nodos son "acento"
      }));
    };

    const step = () => {
      ctx.clearRect(0, 0, w, h);
      // mover + dibujar nodos
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
        // atracción suave al cursor
        const dxm = mouse.current.x - n.x, dym = mouse.current.y - n.y;
        const dm = Math.hypot(dxm, dym);
        if (dm < 170 && dm > 0.1) { n.x += (dxm / dm) * 0.25; n.y += (dym / dm) * 0.25; }
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.a ? 2.4 : 1.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${n.a ? accent : color}, ${n.a ? 0.9 : 0.65})`;
        ctx.fill();
      }
      // enlaces entre nodos cercanos
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < maxLink) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(${color}, ${0.16 * (1 - d / maxLink)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
        // enlace al cursor
        const a = nodes[i];
        const dc = Math.hypot(a.x - mouse.current.x, a.y - mouse.current.y);
        if (dc < maxLink) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.current.x, mouse.current.y);
          ctx.strokeStyle = `rgba(${accent}, ${0.28 * (1 - dc / maxLink)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
      rafRef.current = requestAnimationFrame(step);
    };

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onLeave = () => { mouse.current = { x: -9999, y: -9999 }; };

    resize();
    step();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseout', onLeave);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseout', onLeave);
    };
  }, [color, accent, density, maxLink]);

  return <canvas ref={canvasRef} className={className} style={{ width: '100%', height: '100%', display: 'block' }} aria-hidden="true" />;
}
