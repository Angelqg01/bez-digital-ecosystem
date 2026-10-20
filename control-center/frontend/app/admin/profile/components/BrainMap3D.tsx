'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Crosshair, FileText, Map as MapIcon, Pause, Play, Search, X } from 'lucide-react';

// Mapa 3D del canvas del Brain (03-Maps/BeZhas-Autonomy-Loop.canvas), sin librerías: proyección
// en perspectiva sobre un <canvas> 2D. Cada nodo es un núcleo (esfera con halo) y cada arista una
// interacción con partículas que viajan en su sentido. Arrastrar gira, la rueda o el pellizco
// acercan, y un clic en un núcleo lo trae al frente y abre su ficha en el panel lateral.

export type CanvasNode = { id: string; type: string; text?: string; file?: string; color?: string; x: number; y: number; width: number; height: number };
export type CanvasEdge = { id: string; fromNode: string; toNode: string; label?: string };

type Grupo = { id: string; label: string; color: string; desc: string };

const GRUPOS: Grupo[] = [
    { id: 'nucleo', label: 'Núcleo', color: '#f8fafc', desc: 'Corazón de la plataforma y su ciclo de autonomía' },
    { id: 'cognicion', label: 'Cognición', color: '#60a5fa', desc: 'Decide, evalúa y recuerda' },
    { id: 'ejecucion', label: 'Ejecución', color: '#22d3ee', desc: 'Actúa sobre la cadena y los sectores' },
    { id: 'supervision', label: 'Supervisión', color: '#f59e0b', desc: 'Vigila, alerta y pide aprobación humana' },
    { id: 'conocimiento', label: 'Conocimiento', color: '#a78bfa', desc: 'Vault, notas y decisiones documentadas' },
];
const GRUPO_POR_ID: Record<string, string> = {
    'bezhas-core': 'nucleo', loop: 'nucleo',
    director: 'cognicion', critic: 'cognicion', memory: 'cognicion',
    runtime: 'ejecucion', blockchain: 'ejecucion', sectors: 'ejecucion',
    aegis: 'supervision', telegram: 'supervision',
    obsidian: 'conocimiento',
};
const grupoDe = (n: CanvasNode) => GRUPO_POR_ID[n.id] || (n.type === 'file' || n.id.startsWith('note-') ? 'conocimiento' : 'ejecucion');

type Nodo3D = {
    id: string; titulo: string; cuerpo: string[]; grupo: Grupo; file?: string;
    x: number; y: number; z: number; r: number; entradas: string[]; salidas: string[];
};

function tituloYCuerpo(n: CanvasNode) {
    if (n.type === 'file' && n.file) return { titulo: n.file.split('/').pop()!.replace(/\.md$/, '').replace(/-/g, ' '), cuerpo: [`Nota del vault: ${n.file}`] };
    const lineas = (n.text || n.id).split('\n').map((l) => l.trim()).filter(Boolean);
    const primera = lineas.shift() || n.id;
    let titulo = primera.replace(/^#+\s*/, '');
    // «DIRECTOR AGENT» → «Director agent»: en mayúsculas gritaba y ocupaba el doble en el mapa.
    if (titulo === titulo.toUpperCase()) titulo = titulo.charAt(0) + titulo.slice(1).toLowerCase();
    return { titulo: titulo.length > 60 ? `${titulo.slice(0, 57)}…` : titulo, cuerpo: lineas };
}

// Pseudoaleatorio estable por id: el mapa sale igual en cada carga.
function semilla(id: string) {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
    return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}

/** Disposición 3D por fuerzas: repulsión entre núcleos, muelles en las aristas y cada grupo atraído a su zona. */
function disponer(nodes: CanvasNode[], edges: CanvasEdge[]): Nodo3D[] {
    const grupos = new Map(GRUPOS.map((g, i) => [g.id, { g, ang: (i / GRUPOS.length) * Math.PI * 2 }]));
    const ns: Nodo3D[] = nodes.map((n) => {
        const rnd = semilla(n.id);
        const { titulo, cuerpo } = tituloYCuerpo(n);
        const g = grupos.get(grupoDe(n))!;
        const centro = g.g.id === 'nucleo' ? 0 : 1;
        return {
            id: n.id, titulo, cuerpo, grupo: g.g, file: n.file,
            x: Math.cos(g.ang) * 220 * centro + (rnd() - 0.5) * 90,
            y: (rnd() - 0.5) * 200,
            z: Math.sin(g.ang) * 220 * centro + (rnd() - 0.5) * 90,
            r: 0, entradas: [], salidas: [],
        };
    });
    const porId = new Map(ns.map((n) => [n.id, n]));
    const aristas = edges.filter((e) => porId.has(e.fromNode) && porId.has(e.toNode));
    for (const e of aristas) { porId.get(e.fromNode)!.salidas.push(e.toNode); porId.get(e.toNode)!.entradas.push(e.fromNode); }
    for (const n of ns) n.r = (n.id === 'bezhas-core' ? 26 : 13) + Math.min(n.entradas.length + n.salidas.length, 6) * 2.2;

    for (let it = 0; it < 360; it++) {
        const k = 1 - it / 360;
        const f = ns.map(() => [0, 0, 0]);
        for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
            const dx = ns[i].x - ns[j].x, dy = ns[i].y - ns[j].y, dz = ns[i].z - ns[j].z;
            const d2 = Math.max(dx * dx + dy * dy + dz * dz, 25), d = Math.sqrt(d2), rep = 16000 / d2;
            f[i][0] += (dx / d) * rep; f[i][1] += (dy / d) * rep; f[i][2] += (dz / d) * rep;
            f[j][0] -= (dx / d) * rep; f[j][1] -= (dy / d) * rep; f[j][2] -= (dz / d) * rep;
        }
        for (const e of aristas) {
            const a = ns.indexOf(porId.get(e.fromNode)!), b = ns.indexOf(porId.get(e.toNode)!);
            const dx = ns[b].x - ns[a].x, dy = ns[b].y - ns[a].y, dz = ns[b].z - ns[a].z;
            const d = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 1), s = (d - 150) * 0.02;
            f[a][0] += (dx / d) * s; f[a][1] += (dy / d) * s; f[a][2] += (dz / d) * s;
            f[b][0] -= (dx / d) * s; f[b][1] -= (dy / d) * s; f[b][2] -= (dz / d) * s;
        }
        ns.forEach((n, i) => {
            const g = grupos.get(n.grupo.id)!;
            const ox = n.grupo.id === 'nucleo' ? 0 : Math.cos(g.ang) * 210, oz = n.grupo.id === 'nucleo' ? 0 : Math.sin(g.ang) * 210;
            f[i][0] += (ox - n.x) * 0.012; f[i][1] += -n.y * 0.012; f[i][2] += (oz - n.z) * 0.012;
            n.x += Math.max(-8, Math.min(8, f[i][0])) * k; n.y += Math.max(-8, Math.min(8, f[i][1])) * k; n.z += Math.max(-8, Math.min(8, f[i][2])) * k;
        });
    }
    return ns;
}

type Proy = { n: Nodo3D; sx: number; sy: number; sr: number; zc: number };
const FOCAL = 520;

function rotar(x: number, y: number, z: number, yaw: number, pitch: number) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
    return { x: x1, y: y * cp - z1 * sp, z: y * sp + z1 * cp };
}
const angulo = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export default function BrainMap3D({ nodes, edges, path }: { nodes: CanvasNode[]; edges: CanvasEdge[]; path: string }) {
    const nodos = useMemo(() => disponer(nodes, edges), [nodes, edges]);
    const porId = useMemo(() => new Map(nodos.map((n) => [n.id, n])), [nodos]);
    const aristas = useMemo(() => edges.filter((e) => porId.has(e.fromNode) && porId.has(e.toNode)), [edges, porId]);

    const [seleccion, setSeleccion] = useState<string | null>(null);
    const [hover, setHover] = useState<string | null>(null);
    const [giro, setGiro] = useState(true);
    const [grupoOculto, setGrupoOculto] = useState<Set<string>>(new Set());
    const [busqueda, setBusqueda] = useState('');
    const [avisoZoom, setAvisoZoom] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const contRef = useRef<HTMLDivElement>(null);
    const cam = useRef({ yaw: 0.6, pitch: -0.25, dist: 760, tYaw: null as number | null, tPitch: null as number | null, tDist: null as number | null });
    const proyRef = useRef<Proy[]>([]);
    // El bucle de dibujo lee el estado de React por esta ref, para no reiniciarse en cada cambio.
    const estado = useRef({ seleccion, hover, giro, grupoOculto, busqueda });
    useEffect(() => { estado.current = { seleccion, hover, giro, grupoOculto, busqueda }; }, [seleccion, hover, giro, grupoOculto, busqueda]);

    const reducido = useMemo(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);

    const seleccionar = useCallback((id: string | null) => {
        setSeleccion(id);
        const n = id ? porId.get(id) : null;
        if (!n) return;
        // Lleva el núcleo al frente: yaw anula x y deja z hacia la cámara; pitch anula y.
        const r = Math.hypot(n.x, n.z) || 1;
        cam.current.tYaw = Math.atan2(n.x, -n.z);
        cam.current.tPitch = Math.atan2(-n.y, r);
        // Al frente queda a |p| de la cámara menos: se aleja lo justo para verlo entero y con contexto.
        cam.current.tDist = Math.max(560, Math.hypot(n.x, n.y, n.z) + 420);
    }, [porId]);

    // Bucle de dibujo
    useEffect(() => {
        const canvas = canvasRef.current, cont = contRef.current;
        if (!canvas || !cont) return;
        const ctx = canvas.getContext('2d')!;
        let w = 0, h = 0, raf = 0, t0 = performance.now();
        const ajustar = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = cont.clientWidth; h = cont.clientHeight;
            canvas.width = w * dpr; canvas.height = h * dpr;
            canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        ajustar();
        const ro = new ResizeObserver(ajustar);
        ro.observe(cont);
        const estrellas = Array.from({ length: 140 }, (_, i) => { const r = semilla(`s${i}`); return { x: (r() - 0.5) * 1800, y: (r() - 0.5) * 1200, z: (r() - 0.5) * 1800 }; });

        const frame = (now: number) => {
            const dt = Math.min(now - t0, 50); t0 = now;
            const c = cam.current, { seleccion: sel, hover: hov, giro: gir, grupoOculto: ocultos, busqueda: q } = estado.current;
            if (c.tYaw !== null) { c.yaw += angulo(c.tYaw - c.yaw) * 0.08; if (Math.abs(angulo(c.tYaw - c.yaw)) < 0.002) c.tYaw = null; }
            else if (gir && !sel && !reducido) c.yaw += dt * 0.00012;
            if (c.tPitch !== null) { c.pitch += (c.tPitch - c.pitch) * 0.08; if (Math.abs(c.tPitch - c.pitch) < 0.002) c.tPitch = null; }
            if (c.tDist !== null) { c.dist += (c.tDist - c.dist) * 0.08; if (Math.abs(c.tDist - c.dist) < 1) c.tDist = null; }
            try {

            ctx.clearRect(0, 0, w, h);
            const bg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
            bg.addColorStop(0, '#0b1020'); bg.addColorStop(1, '#04050a');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

            const proyectar = (x: number, y: number, z: number) => {
                const p = rotar(x, y, z, c.yaw, c.pitch); const zc = p.z + c.dist; const s = FOCAL / zc;
                return { sx: w / 2 + p.x * s, sy: h / 2 + p.y * s, s, zc };
            };
            for (const e of estrellas) {
                const p = proyectar(e.x, e.y, e.z);
                if (p.zc <= 10) continue;
                ctx.fillStyle = `rgba(148,163,184,${Math.min(0.5, 120 / p.zc)})`;
                ctx.fillRect(p.sx, p.sy, 1.2, 1.2);
            }

            const term = q.trim().toLowerCase();
            const visible = (n: Nodo3D) => !ocultos.has(n.grupo.id);
            const coincide = (n: Nodo3D) => !term || n.titulo.toLowerCase().includes(term) || n.id.includes(term) || n.cuerpo.join(' ').toLowerCase().includes(term);
            const foco = sel || hov;
            const vecinos = new Set(foco ? [foco, ...(porId.get(foco)?.entradas || []), ...(porId.get(foco)?.salidas || [])] : []);
            // Lo que queda detrás o pegado a la cámara no se dibuja (radio negativo o gigante).
            const proy: Proy[] = nodos.filter(visible).map((n) => { const p = proyectar(n.x, n.y, n.z); return { n, sx: p.sx, sy: p.sy, sr: n.r * p.s, zc: p.zc }; }).filter((p) => p.zc > 80);
            const pmap = new Map(proy.map((p) => [p.n.id, p]));

            // Interacciones: curva + partículas en el sentido de la arista
            for (const [i, e] of aristas.entries()) {
                const a = pmap.get(e.fromNode), b = pmap.get(e.toNode);
                if (!a || !b) continue;
                const activa = !foco || (vecinos.has(e.fromNode) && vecinos.has(e.toNode) && (e.fromNode === foco || e.toNode === foco));
                const mx = (a.sx + b.sx) / 2, my = (a.sy + b.sy) / 2, dx = b.sx - a.sx, dy = b.sy - a.sy, d = Math.hypot(dx, dy) || 1;
                const cx = mx - (dy / d) * d * 0.15, cy = my + (dx / d) * d * 0.15;
                const prof = Math.max(0.25, Math.min(1, 700 / ((a.zc + b.zc) / 2)));
                ctx.lineWidth = activa && foco ? 2 : 1.1;
                ctx.strokeStyle = activa ? `${a.n.grupo.color}${foco ? 'cc' : '55'}` : 'rgba(148,163,184,0.06)';
                ctx.globalAlpha = prof;
                ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.quadraticCurveTo(cx, cy, b.sx, b.sy); ctx.stroke();
                if (activa && !reducido) {
                    for (let k = 0; k < (foco ? 3 : 2); k++) {
                        const t = ((now / 2400) + k / 3 + i * 0.13) % 1;
                        const px = (1 - t) * (1 - t) * a.sx + 2 * (1 - t) * t * cx + t * t * b.sx;
                        const py = (1 - t) * (1 - t) * a.sy + 2 * (1 - t) * t * cy + t * t * b.sy;
                        ctx.fillStyle = a.n.grupo.color;
                        ctx.shadowColor = a.n.grupo.color; ctx.shadowBlur = 8;
                        ctx.beginPath(); ctx.arc(px, py, foco ? 2.4 : 1.7, 0, Math.PI * 2); ctx.fill();
                        ctx.shadowBlur = 0;
                    }
                }
                ctx.globalAlpha = 1;
            }

            // Núcleos, de atrás hacia delante
            proy.sort((p1, p2) => p2.zc - p1.zc);
            // Etiquetas sin solaparse: se reservan primero las del foco y sus vecinos, luego de delante a atrás.
            const etiquetas = new Map<string, { x: number; y: number; w: number; h: number }>();
            const ocupadas: { x: number; y: number; w: number; h: number }[] = [];
            const orden = [...proy].sort((p1, p2) => Number(vecinos.has(p2.n.id)) - Number(vecinos.has(p1.n.id)) || p1.zc - p2.zc);
            for (const p of orden) {
                const fs = Math.round(Math.max(10, Math.min(13, p.sr * 0.6)));
                ctx.font = `${p.n.id === foco ? 'bold ' : ''}${fs}px "Space Grotesk", system-ui, sans-serif`;
                const texto = p.n.titulo.length > 26 ? `${p.n.titulo.slice(0, 25)}…` : p.n.titulo;
                const caja = { x: p.sx + p.sr + 6, y: p.sy - fs / 2 - 2, w: ctx.measureText(texto).width + 4, h: fs + 4 };
                const choca = ocupadas.some((o) => caja.x < o.x + o.w && caja.x + caja.w > o.x && caja.y < o.y + o.h && caja.y + caja.h > o.y);
                if (!choca || p.n.id === foco) { ocupadas.push(caja); etiquetas.set(p.n.id, caja); }
            }
            for (const p of proy) {
                const { n } = p;
                const atenuado = (foco && !vecinos.has(n.id)) || (term && !coincide(n));
                const prof = Math.max(0.35, Math.min(1, 650 / p.zc));
                ctx.globalAlpha = atenuado ? 0.18 : prof;
                const col = n.grupo.color;
                const halo = ctx.createRadialGradient(p.sx, p.sy, p.sr * 0.4, p.sx, p.sy, p.sr * 2.6);
                halo.addColorStop(0, `${col}55`); halo.addColorStop(1, `${col}00`);
                ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(p.sx, p.sy, p.sr * 2.6, 0, Math.PI * 2); ctx.fill();
                const esfera = ctx.createRadialGradient(p.sx - p.sr * 0.35, p.sy - p.sr * 0.35, p.sr * 0.1, p.sx, p.sy, p.sr);
                esfera.addColorStop(0, '#ffffff'); esfera.addColorStop(0.35, col); esfera.addColorStop(1, '#05060a');
                ctx.fillStyle = esfera; ctx.beginPath(); ctx.arc(p.sx, p.sy, p.sr, 0, Math.PI * 2); ctx.fill();
                if (n.id === sel || n.id === hov) {
                    ctx.strokeStyle = col; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.arc(p.sx, p.sy, p.sr + 5 + Math.sin(now / 300) * 1.5, 0, Math.PI * 2); ctx.stroke();
                }
                if (!atenuado && etiquetas.has(n.id) && (prof > 0.5 || n.id === foco || vecinos.has(n.id))) {
                    const fs = Math.round(Math.max(10, Math.min(13, p.sr * 0.6)));
                    ctx.font = `${n.id === foco ? 'bold ' : ''}${fs}px "Space Grotesk", system-ui, sans-serif`;
                    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
                    const texto = n.titulo.length > 26 ? `${n.titulo.slice(0, 25)}…` : n.titulo;
                    ctx.fillStyle = 'rgba(4,5,10,0.65)';
                    ctx.fillText(texto, p.sx + p.sr + 9, p.sy + 1);
                    ctx.fillStyle = n.id === foco ? '#ffffff' : 'rgba(226,232,240,0.88)';
                    ctx.fillText(texto, p.sx + p.sr + 8, p.sy);
                }
                ctx.globalAlpha = 1;
            }
            proyRef.current = proy;
            } catch (err) {
                // Un fotograma fallido no debe parar el mapa.
                if (process.env.NODE_ENV !== 'production') console.warn('[BrainMap3D]', err);
            }
            raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
        return () => { cancelAnimationFrame(raf); ro.disconnect(); };
    }, [nodos, aristas, porId, reducido]);

    // Interacción: arrastrar gira, rueda/pellizco acercan, clic selecciona
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const punteros = new Map<number, { x: number; y: number }>();
        let inicio = { x: 0, y: 0 }, movido = 0, pellizco = 0;
        const golpe = (x: number, y: number) => {
            const r = canvas.getBoundingClientRect(), px = x - r.left, py = y - r.top;
            const cand = proyRef.current.filter((p) => !estado.current.grupoOculto.has(p.n.grupo.id) && Math.hypot(p.sx - px, p.sy - py) <= Math.max(p.sr, 10) + 4);
            return cand.sort((a, b) => a.zc - b.zc)[0]?.n.id || null;
        };
        const down = (e: PointerEvent) => {
            canvas.setPointerCapture(e.pointerId);
            punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
            inicio = { x: e.clientX, y: e.clientY }; movido = 0;
            if (punteros.size === 2) { const [a, b] = [...punteros.values()]; pellizco = Math.hypot(a.x - b.x, a.y - b.y); }
        };
        const move = (e: PointerEvent) => {
            const prev = punteros.get(e.pointerId);
            if (!prev) { setHover(golpe(e.clientX, e.clientY)); return; }
            const c = cam.current;
            if (punteros.size === 2) {
                punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
                const [a, b] = [...punteros.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
                c.tDist = null;
                if (pellizco) c.dist = Math.max(260, Math.min(1400, c.dist * (pellizco / d)));
                pellizco = d; movido = 99; return;
            }
            const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
            punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
            movido += Math.abs(dx) + Math.abs(dy);
            c.tYaw = null; c.tPitch = null; c.tDist = null;
            c.yaw += dx * 0.008;
            c.pitch = Math.max(-1.3, Math.min(1.3, c.pitch + dy * 0.008));
        };
        const up = (e: PointerEvent) => {
            punteros.delete(e.pointerId);
            if (punteros.size < 2) pellizco = 0;
            if (movido < 6 && Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) < 6) seleccionar(golpe(e.clientX, e.clientY));
        };
        // La rueda sola desplaza la página (no se queda atrapada en el mapa); Ctrl/⌘ + rueda, o el pellizco del
        // trackpad (que el navegador envía como rueda con ctrlKey), acerca y aleja.
        let avisoTimer = 0;
        const wheel = (e: WheelEvent) => {
            if (!e.ctrlKey && !e.metaKey) {
                setAvisoZoom(true);
                window.clearTimeout(avisoTimer);
                avisoTimer = window.setTimeout(() => setAvisoZoom(false), 1400);
                return;
            }
            e.preventDefault();
            cam.current.tDist = null;
            cam.current.dist = Math.max(260, Math.min(1400, cam.current.dist * (1 + e.deltaY * 0.001)));
        };
        const leave = () => setHover(null);
        canvas.addEventListener('pointerdown', down);
        canvas.addEventListener('pointermove', move);
        canvas.addEventListener('pointerup', up);
        canvas.addEventListener('pointercancel', up);
        canvas.addEventListener('pointerleave', leave);
        canvas.addEventListener('wheel', wheel, { passive: false });
        return () => {
            canvas.removeEventListener('pointerdown', down);
            canvas.removeEventListener('pointermove', move);
            canvas.removeEventListener('pointerup', up);
            canvas.removeEventListener('pointercancel', up);
            canvas.removeEventListener('pointerleave', leave);
            canvas.removeEventListener('wheel', wheel);
            window.clearTimeout(avisoTimer);
        };
    }, [seleccionar]);

    const teclado = (e: React.KeyboardEvent) => {
        const c = cam.current;
        if (e.key === 'ArrowLeft') c.yaw -= 0.12;
        else if (e.key === 'ArrowRight') c.yaw += 0.12;
        else if (e.key === 'ArrowUp') c.pitch = Math.max(-1.3, c.pitch - 0.12);
        else if (e.key === 'ArrowDown') c.pitch = Math.min(1.3, c.pitch + 0.12);
        else if (e.key === '+' || e.key === '=') c.dist = Math.max(260, c.dist * 0.9);
        else if (e.key === '-') c.dist = Math.min(1400, c.dist * 1.1);
        else if (e.key === 'Escape') seleccionar(null);
        else return;
        e.preventDefault();
    };

    const centrar = () => { cam.current = { yaw: 0.6, pitch: -0.25, dist: 760, tYaw: null, tPitch: null, tDist: null }; seleccionar(null); };
    const sel = seleccion ? porId.get(seleccion) : null;
    const resultados = busqueda.trim()
        ? nodos.filter((n) => `${n.titulo} ${n.id} ${n.cuerpo.join(' ')}`.toLowerCase().includes(busqueda.trim().toLowerCase())).slice(0, 6)
        : [];

    return (
        <section className="border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3 text-cyan-300">
                    <MapIcon size={22} />
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-widest text-white">Mapa Blockchain · 3D</h3>
                        <p className="text-[10px] uppercase tracking-widest text-gray-500">{path}</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Buscar núcleo…"
                            aria-label="Buscar núcleo en el mapa"
                            className="w-44 border border-white/10 bg-black/40 py-1.5 pl-8 pr-2 text-xs text-white placeholder:text-gray-600 focus:border-cyan-400/50 focus:outline-none"
                        />
                        {resultados.length > 0 && (
                            <div className="absolute right-0 top-full z-10 mt-1 w-64 border border-white/10 bg-[#0b0d16] shadow-xl">
                                {resultados.map((n) => (
                                    <button key={n.id} onClick={() => { seleccionar(n.id); setBusqueda(''); }}
                                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-300 hover:bg-white/5">
                                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: n.grupo.color }} />
                                        <span className="truncate">{n.titulo}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <button onClick={() => setGiro((g) => !g)} aria-pressed={giro}
                        className="flex items-center gap-1.5 border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-300 hover:bg-white/10">
                        {giro ? <Pause size={12} /> : <Play size={12} />} {giro ? 'Pausar giro' : 'Girar'}
                    </button>
                    <button onClick={centrar}
                        className="flex items-center gap-1.5 border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-300 hover:bg-white/10">
                        <Crosshair size={12} /> Centrar
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
                <div>
                    <div ref={contRef} className="relative h-[520px] overflow-hidden border border-white/10 bg-[#04050a]">
                        <canvas
                            ref={canvasRef}
                            tabIndex={0}
                            onKeyDown={teclado}
                            role="img"
                            aria-label="Mapa 3D de los núcleos del Brain. Flechas para girar, + y - para acercar, Escape para deseleccionar."
                            className={`block h-full w-full touch-none focus:outline-none ${hover ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}`}
                        />
                        <div className="pointer-events-none absolute bottom-3 left-3 text-[10px] uppercase tracking-widest text-gray-500">
                            Arrastra para girar · Ctrl + rueda o pellizco para acercar · clic en un núcleo
                        </div>
                        {avisoZoom && (
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-bold text-white">
                                Usa Ctrl (⌘ en Mac) + rueda para acercar el mapa
                            </div>
                        )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {GRUPOS.map((g) => {
                            const oculto = grupoOculto.has(g.id);
                            const n = nodos.filter((x) => x.grupo.id === g.id).length;
                            return (
                                <button key={g.id} title={g.desc} aria-pressed={!oculto}
                                    onClick={() => setGrupoOculto((s) => { const t = new Set(s); if (t.has(g.id)) t.delete(g.id); else t.add(g.id); return t; })}
                                    className={`flex items-center gap-2 border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest transition-opacity ${oculto ? 'border-white/5 opacity-40' : 'border-white/10'}`}>
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.color, boxShadow: `0 0 8px ${g.color}` }} />
                                    <span className="text-gray-300">{g.label}</span>
                                    <span className="text-gray-600">{n}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <aside aria-live="polite" className="flex min-h-[220px] flex-col border border-white/10 bg-black/30">
                    {sel ? (
                        <>
                            <div className="border-b border-white/10 p-4" style={{ boxShadow: `inset 3px 0 0 ${sel.grupo.color}` }}>
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: sel.grupo.color }}>{sel.grupo.label}</div>
                                        <h4 className="mt-1 text-base font-bold leading-tight text-white">{sel.titulo}</h4>
                                        <div className="mt-1 font-mono text-[10px] text-gray-500">{sel.id}</div>
                                    </div>
                                    <button onClick={() => seleccionar(null)} aria-label="Cerrar ficha" className="p-1 text-gray-500 hover:text-white"><X size={16} /></button>
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                                    <div className="border border-white/5 bg-white/[0.03] py-2"><div className="text-lg font-black text-white">{sel.entradas.length}</div><div className="text-[9px] uppercase tracking-widest text-gray-500">recibe de</div></div>
                                    <div className="border border-white/5 bg-white/[0.03] py-2"><div className="text-lg font-black text-white">{sel.salidas.length}</div><div className="text-[9px] uppercase tracking-widest text-gray-500">envía a</div></div>
                                </div>
                            </div>
                            <div className="flex-1 space-y-4 overflow-y-auto p-4 text-xs">
                                {sel.cuerpo.length > 0 && (
                                    <div className="space-y-1.5 leading-relaxed text-gray-300">
                                        {sel.cuerpo.map((l, i) => <p key={i}>{l.replace(/^[-*]\s*/, '• ').replace(/->/g, '→')}</p>)}
                                    </div>
                                )}
                                {sel.file && (
                                    <div className="flex items-center gap-2 border border-white/5 bg-white/[0.03] p-2 font-mono text-[11px] text-cyan-300">
                                        <FileText size={13} /> {sel.file}
                                    </div>
                                )}
                                {[
                                    { titulo: 'Envía a', ids: sel.salidas, Icon: ArrowUpRight },
                                    { titulo: 'Recibe de', ids: sel.entradas, Icon: ArrowDownLeft },
                                ].map(({ titulo, ids, Icon }) => ids.length > 0 && (
                                    <div key={titulo}>
                                        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500"><Icon size={12} /> {titulo}</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {ids.map((id) => { const n = porId.get(id)!; return (
                                                <button key={id} onClick={() => seleccionar(id)}
                                                    className="flex items-center gap-1.5 border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-gray-200 hover:border-white/30">
                                                    <span className="h-2 w-2 rounded-full" style={{ background: n.grupo.color }} />{n.titulo}
                                                </button>
                                            ); })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-1 flex-col p-4">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Selecciona un núcleo</div>
                            <p className="mt-2 text-xs leading-relaxed text-gray-400">
                                Cada esfera es un componente del Brain; las partículas viajan en el sentido de cada interacción. Haz clic en una para
                                traerla al frente y ver qué hace, de quién recibe y a quién envía.
                            </p>
                            <div className="mt-4 flex flex-wrap gap-1.5">
                                {nodos.filter((n) => n.grupo.id !== 'conocimiento' || !n.id.startsWith('note-')).map((n) => (
                                    <button key={n.id} onClick={() => seleccionar(n.id)}
                                        className="flex items-center gap-1.5 border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-gray-300 hover:border-white/30">
                                        <span className="h-2 w-2 rounded-full" style={{ background: n.grupo.color }} />{n.titulo}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </aside>
            </div>
        </section>
    );
}
