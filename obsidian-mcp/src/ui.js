/**
 * BeZhas Brain Console — self-contained UI served at GET /ui.
 * No CDNs, no build step: works offline inside the docker network.
 */
export const BRAIN_UI_HTML = /* html */ `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BeZhas Brain Console</title>
<style>
  :root {
    --bg: #07090f; --panel: #0d1119; --line: rgba(255,255,255,.08);
    --teal: #00D4AA; --gold: #FFD700; --pink: #FF6B9D; --violet: #a78bfa;
    --text: #e6e9ef; --dim: #8b93a3;
  }
  * { box-sizing: border-box; margin: 0; }
  body {
    background: var(--bg); color: var(--text); height: 100vh; overflow: hidden;
    font: 13px/1.45 "Space Mono", ui-monospace, Consolas, monospace;
    display: grid; grid-template-rows: 52px 1fr;
  }
  header {
    display: flex; align-items: center; gap: 14px; padding: 0 16px;
    border-bottom: 1px solid var(--line); background: var(--panel);
  }
  header .logo { width: 22px; height: 22px; border-radius: 50%;
    background: conic-gradient(from 120deg, var(--teal) 0 50%, var(--pink) 50% 100%); }
  header h1 { font-size: 14px; letter-spacing: .18em; text-transform: uppercase; font-weight: 700; }
  header .stats { margin-left: auto; display: flex; gap: 16px; font-size: 11px; color: var(--dim); }
  header .stats b { color: var(--teal); font-weight: 700; }
  header .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 5px; }
  main { display: grid; grid-template-columns: 320px 1fr 340px; min-height: 0; }
  .col { border-right: 1px solid var(--line); overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 14px; }
  .col::-webkit-scrollbar, #detail::-webkit-scrollbar { width: 6px; }
  .col::-webkit-scrollbar-thumb, #detail::-webkit-scrollbar-thumb { background: rgba(255,255,255,.12); }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 12px; }
  .card h2 { font-size: 10px; letter-spacing: .2em; text-transform: uppercase; color: var(--dim); margin-bottom: 10px; }
  .searchrow { display: flex; gap: 6px; }
  input[type=text] {
    flex: 1; background: #060810; border: 1px solid var(--line); border-radius: 6px;
    color: var(--text); padding: 8px 10px; font: inherit; outline: none;
  }
  input[type=text]:focus { border-color: var(--teal); }
  button {
    background: rgba(0,212,170,.12); color: var(--teal); border: 1px solid rgba(0,212,170,.35);
    border-radius: 6px; padding: 7px 10px; font: inherit; font-size: 11px; cursor: pointer;
    text-transform: uppercase; letter-spacing: .08em;
  }
  button:hover { background: rgba(0,212,170,.22); }
  button.alt { color: var(--gold); border-color: rgba(255,215,0,.35); background: rgba(255,215,0,.08); }
  button.alt:hover { background: rgba(255,215,0,.16); }
  button:disabled { opacity: .45; cursor: wait; }
  .toggle { display: flex; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; margin-top: 8px; }
  .toggle span { flex: 1; text-align: center; padding: 6px; font-size: 10px; letter-spacing: .12em;
    text-transform: uppercase; color: var(--dim); cursor: pointer; }
  .toggle span.on { background: rgba(0,212,170,.15); color: var(--teal); }
  .result, .recent-item {
    padding: 8px; border: 1px solid transparent; border-radius: 6px; cursor: pointer; margin-bottom: 4px;
  }
  .result:hover, .recent-item:hover { border-color: rgba(0,212,170,.35); background: rgba(0,212,170,.05); }
  .result .t, .recent-item .t { font-weight: 700; font-size: 12px; color: var(--text); }
  .result .p, .recent-item .p { color: var(--dim); font-size: 11px; margin-top: 2px;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .result .s { color: var(--gold); font-size: 10px; float: right; }
  .tagcloud { display: flex; flex-wrap: wrap; gap: 5px; }
  .tag { font-size: 10px; padding: 3px 8px; border-radius: 999px; cursor: pointer;
    background: rgba(167,139,250,.12); color: var(--violet); border: 1px solid rgba(167,139,250,.3); }
  .tag:hover { background: rgba(167,139,250,.25); }
  #graphwrap { position: relative; min-width: 0; }
  #graph { position: absolute; inset: 0; width: 100%; height: 100%; cursor: grab; }
  #graph.dragging { cursor: grabbing; }
  #legend { position: absolute; left: 12px; bottom: 12px; display: flex; flex-wrap: wrap; gap: 8px;
    font-size: 10px; color: var(--dim); background: rgba(7,9,15,.7); padding: 6px 10px; border-radius: 6px; }
  #legend i { width: 9px; height: 9px; border-radius: 50%; display: inline-block; margin-right: 4px; }
  #tip { position: absolute; pointer-events: none; background: #060810; border: 1px solid var(--line);
    border-radius: 6px; padding: 6px 9px; font-size: 11px; display: none; z-index: 5; max-width: 260px; }
  #detail { border-left: 1px solid var(--line); border-right: none; }
  #detail .path { font-size: 10px; color: var(--dim); word-break: break-all; margin-bottom: 8px; }
  #detail pre {
    white-space: pre-wrap; word-break: break-word; font: 11px/1.55 inherit; color: #c6ccd8;
    background: #060810; border: 1px solid var(--line); border-radius: 6px; padding: 10px; max-height: 46vh; overflow-y: auto;
  }
  .linkchip { display: inline-block; margin: 2px 3px 0 0; padding: 2px 7px; font-size: 10px; border-radius: 999px;
    background: rgba(0,212,170,.1); color: var(--teal); border: 1px solid rgba(0,212,170,.3); cursor: pointer; }
  .ops-out { font-size: 11px; color: var(--dim); margin-top: 8px; word-break: break-all;
    max-height: 160px; overflow-y: auto; }
  .ops-out b { color: var(--gold); }
  .muted { color: var(--dim); font-size: 11px; }
  .fnbar { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; font-size: 11px; }
  .fnbar .name { flex: 1; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fnbar .bar { height: 5px; border-radius: 3px; background: linear-gradient(90deg, var(--teal), rgba(0,212,170,.25)); min-width: 3px; }
  .fnbar .n { color: var(--gold); min-width: 34px; text-align: right; }
  .edgerow { font-size: 10px; color: var(--dim); margin-bottom: 3px; }
  .edgerow b { color: var(--teal); font-weight: 400; }
  @media (max-width: 1000px) {
    body { display: block; height: auto; overflow: auto; }
    main { display: flex; flex-direction: column; }
    #graphwrap { order: -1; height: 54vh; min-height: 380px; }
    .col, #detail { border-right: none; border-left: none; border-bottom: 1px solid var(--line); overflow: visible; }
  }
</style>
</head>
<body>
<header>
  <div class="logo"></div>
  <h1>BeZhas Brain Console</h1>
  <div class="stats" id="stats">cargando…</div>
  <div class="stats" id="apistat"></div>
</header>
<main>
  <div class="col">
    <div class="card">
      <h2>Búsqueda</h2>
      <div class="searchrow">
        <input id="q" type="text" placeholder="staking, MiCA, treasury…">
        <button id="go">Buscar</button>
      </div>
      <div class="toggle" id="mode">
        <span data-m="lexical" class="on">Léxica</span>
        <span data-m="semantic">Semántica</span>
      </div>
      <div id="results" style="margin-top:10px"></div>
    </div>
    <div class="card">
      <h2>Tags</h2>
      <div class="tagcloud" id="tags"></div>
    </div>
    <div class="card">
      <h2>Recientes</h2>
      <div id="recent"></div>
    </div>
  </div>

  <div id="graphwrap">
    <canvas id="graph"></canvas>
    <div id="legend"></div>
    <div id="tip"></div>
  </div>

  <div class="col" id="detail">
    <div class="card">
      <h2>Actividad de red (API en vivo)</h2>
      <div id="acttotals" class="muted">sin tráfico aún</div>
      <div id="topfns" style="margin-top:10px"></div>
      <div id="topedges" style="margin-top:8px"></div>
    </div>
    <div class="card">
      <h2>Nota</h2>
      <div class="path" id="notepath">Haz clic en un nodo del grafo</div>
      <pre id="notebody" style="display:none"></pre>
      <div id="notelinks"></div>
    </div>
    <div class="card">
      <h2>Operaciones del Brain</h2>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button id="fp" class="alt">Fingerprint on-chain (merkle root)</button>
        <button id="cons">Consolidar episodios (dry-run)</button>
        <button id="consreal">Consolidar episodios (ejecutar)</button>
      </div>
      <div class="ops-out" id="opsout"></div>
    </div>
  </div>
</main>
<script>
const api = (tool, params={}) => fetch('/tools/'+tool, {
  method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(params)
}).then(r=>r.json()).then(j=>{ if(!j.success) throw new Error(j.error); return j.data; });

const FOLDER_COLORS = {
  '00-Episodic-Memory':'#00D4AA','01-Self-Model':'#FFD700','02-Decisions':'#FF6B9D',
  '03-Maps':'#a78bfa','04-Sectors':'#38bdf8','99-Inbox':'#94a3b8','':'#e6e9ef',
  'actor':'#FF6B9D'
};
const color = f => FOLDER_COLORS[f] || '#94a3b8';

// ── graph state ──────────────────────────────────────────────
let nodes=[], edges=[], byId={}, selected=null, hovered=null;
let usageEdges=[], usageByNode={}; // telemetría API resuelta a nodos del grafo
let cam={x:0,y:0,z:1}, dragging=null, panning=false, alpha=1;
const canvas=document.getElementById('graph'), ctx=canvas.getContext('2d');
const tip=document.getElementById('tip');

function resize(){
  const r=canvas.parentElement.getBoundingClientRect(), dpr=devicePixelRatio||1;
  canvas.width=r.width*dpr; canvas.height=r.height*dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
}
addEventListener('resize', resize);

function world(e){
  const r=canvas.getBoundingClientRect();
  return { x:(e.clientX-r.left-r.width/2)/cam.z - cam.x, y:(e.clientY-r.top-r.height/2)/cam.z - cam.y };
}
function nodeAt(p){
  for(let i=nodes.length-1;i>=0;i--){ const n=nodes[i];
    const d=Math.hypot(n.x-p.x,n.y-p.y); if(d<n.r+3/cam.z) return n; }
  return null;
}

function tick(){
  // force simulation: repulsion + springs + centering
  if(alpha>0.005){
    for(const n of nodes){ n.vx*=0.85; n.vy*=0.85; }
    for(let i=0;i<nodes.length;i++) for(let j=i+1;j<nodes.length;j++){
      const a=nodes[i],b=nodes[j];
      let dx=b.x-a.x, dy=b.y-a.y, d2=dx*dx+dy*dy||1, d=Math.sqrt(d2);
      const f=Math.min(2600/d2, 6)*alpha;
      dx/=d; dy/=d; a.vx-=dx*f; a.vy-=dy*f; b.vx+=dx*f; b.vy+=dy*f;
    }
    for(const e of edges){ const a=byId[e.from],b=byId[e.to]; if(!a||!b) continue;
      let dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy)||1;
      const f=(d-110)*0.02*alpha; dx/=d; dy/=d;
      a.vx+=dx*f; a.vy+=dy*f; b.vx-=dx*f; b.vy-=dy*f;
    }
    for(const n of nodes){ n.vx-=n.x*0.0016*alpha; n.vy-=n.y*0.0016*alpha;
      if(n!==dragging){ n.x+=n.vx; n.y+=n.vy; } }
    alpha*=0.985;
  }
  draw(); requestAnimationFrame(tick);
}

function draw(){
  const w=canvas.clientWidth,h=canvas.clientHeight;
  ctx.clearRect(0,0,w,h);
  ctx.save(); ctx.translate(w/2,h/2); ctx.scale(cam.z,cam.z); ctx.translate(cam.x,cam.y);
  const neighbors = selected ? new Set(edges.flatMap(e=>e.from===selected.id?[e.to]:e.to===selected.id?[e.from]:[])) : null;
  for(const e of edges){ const a=byId[e.from],b=byId[e.to]; if(!a||!b) continue;
    const hot = selected && (e.from===selected.id||e.to===selected.id);
    ctx.strokeStyle = hot ? 'rgba(0,212,170,.75)' : 'rgba(148,163,184,.16)';
    ctx.lineWidth=(hot?1.6:0.7)/cam.z;
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
  }
  // capa de tráfico API: líneas discontinuas teal con partículas en movimiento
  const now = performance.now();
  for(const u of usageEdges){
    const a=byId[u.a], b=byId[u.b]; if(!a||!b) continue;
    const w = Math.min(0.8 + Math.log2(1+u.calls)*0.5, 3.4);
    const fresh = (Date.now()-u.lastTs) < 15000;
    ctx.strokeStyle = fresh ? 'rgba(0,212,170,.85)' : 'rgba(0,212,170,.35)';
    ctx.lineWidth = w/cam.z; ctx.setLineDash([6/cam.z, 7/cam.z]);
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    ctx.setLineDash([]);
    const speed = Math.max(2600 - Math.min(u.calls,40)*45, 700);
    const t = ((now + u.phase) % speed) / speed;
    ctx.beginPath(); ctx.arc(a.x+(b.x-a.x)*t, a.y+(b.y-a.y)*t, (1.6+w*0.5)/cam.z, 0, 7);
    ctx.fillStyle = '#FFD700'; ctx.fill();
  }
  for(const n of nodes){
    const dim = selected && n!==selected && !(neighbors&&neighbors.has(n.id));
    ctx.globalAlpha = dim ? 0.25 : 1;
    const heat = usageByNode[n.id];
    if(heat){ // halo por uso de API
      ctx.beginPath(); ctx.arc(n.x,n.y,n.r+3+Math.min(Math.log2(1+heat.calls)*1.6,8),0,7);
      ctx.strokeStyle='rgba(0,212,170,.5)'; ctx.lineWidth=1.2/cam.z; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(n.x,n.y,n.r,0,7);
    if(n.ghost){ ctx.fillStyle='rgba(255,107,157,.25)'; ctx.fill();
      ctx.strokeStyle='#FF6B9D'; ctx.lineWidth=1/cam.z; ctx.setLineDash([3/cam.z,3/cam.z]); ctx.stroke(); ctx.setLineDash([]); }
    else { ctx.fillStyle=color(n.folder); ctx.fill(); }
    if(n===selected||n===hovered){ ctx.strokeStyle='#fff'; ctx.lineWidth=1.4/cam.z; ctx.stroke(); }
    if(cam.z>0.55 || n===selected || n===hovered || n.r>7){
      ctx.fillStyle = dim?'rgba(139,147,163,.5)':'#c6ccd8';
      ctx.font = (11/cam.z)+'px ui-monospace,monospace';
      ctx.fillText(n.title.slice(0,26), n.x+n.r+4, n.y+3/cam.z);
    }
    ctx.globalAlpha=1;
  }
  ctx.restore();
}

canvas.addEventListener('mousedown',e=>{
  const n=nodeAt(world(e));
  if(n){ dragging=n; alpha=Math.max(alpha,0.3); } else panning=true;
  canvas.classList.add('dragging');
});
addEventListener('mouseup',()=>{ dragging=null; panning=false; canvas.classList.remove('dragging'); });
canvas.addEventListener('mousemove',e=>{
  const p=world(e);
  if(dragging){ dragging.x=p.x; dragging.y=p.y; alpha=Math.max(alpha,0.25); }
  else if(panning){ cam.x+=e.movementX/cam.z; cam.y+=e.movementY/cam.z; }
  else {
    hovered=nodeAt(p);
    if(hovered){ tip.style.display='block'; tip.style.left=(e.offsetX+14)+'px'; tip.style.top=(e.offsetY+10)+'px';
      tip.innerHTML='<b style="color:'+color(hovered.folder)+'">'+hovered.title+'</b><br><span style="color:var(--dim)">'+hovered.id+'</span>'; }
    else tip.style.display='none';
  }
});
canvas.addEventListener('wheel',e=>{ e.preventDefault();
  cam.z=Math.min(3,Math.max(0.25,cam.z*(e.deltaY<0?1.12:0.89))); },{passive:false});
canvas.addEventListener('click',e=>{
  const n=nodeAt(world(e)); if(n){ selected=n; openNote(n.id); } else { selected=null; }
});

// ── data ─────────────────────────────────────────────────────
async function loadGraph(){
  const g=await api('get_graph');
  const deg={}; for(const e of g.edges){ deg[e.from]=(deg[e.from]||0)+1; deg[e.to]=(deg[e.to]||0)+1; }
  nodes=g.nodes.map((n,i)=>({ ...n,
    x:Math.cos(i*2.39)*(60+i*7), y:Math.sin(i*2.39)*(60+i*7),
    vx:0, vy:0, r:5+Math.min((deg[n.id]||0)*1.6,11) }));
  byId=Object.fromEntries(nodes.map(n=>[n.id,n]));
  edges=g.edges; alpha=1;
  const folders=[...new Set(nodes.map(n=>n.folder).filter(Boolean))].sort();
  document.getElementById('legend').innerHTML =
    folders.map(f=>'<span><i style="background:'+color(f)+'"></i>'+f+'</span>').join('') +
    '<span style="opacity:.6">'+g.orphans.length+' huérfanas</span>';
}

async function loadSide(){
  const [health, tags, recent] = await Promise.all([
    fetch('/health').then(r=>r.json()), api('get_tags'), api('get_recent_notes',{limit:6})
  ]);
  const sem = health.semantic||{};
  document.getElementById('stats').innerHTML =
    '<span><b>'+health.notes+'</b> notas</span>'+
    '<span><b>'+((health.bytes||0)/1024).toFixed(1)+'</b> KB</span>'+
    '<span><span class="dot" style="background:'+(sem.reachable?'#00D4AA':'#FF6B9D')+'"></span>semántica '+(sem.reachable?('ON · '+sem.model):'OFF (Ollama)')+'</span>';
  document.getElementById('tags').innerHTML = tags.tags.map(t=>
    '<span class="tag" data-t="'+t.tag+'">'+t.tag+' · '+t.count+'</span>').join('') || '<span class="muted">sin tags aún</span>';
  document.querySelectorAll('.tag').forEach(el=>el.onclick=()=>{
    document.getElementById('q').value=''; runSearch('', el.dataset.t); });
  document.getElementById('recent').innerHTML = recent.notes.map(n=>
    '<div class="recent-item" data-p="'+n.path+'"><div class="t">'+n.title+'</div><div class="p">'+(n.preview||'')+'</div></div>').join('');
  document.querySelectorAll('.recent-item').forEach(el=>el.onclick=()=>openNote(el.dataset.p));
}

// ── telemetría API en vivo ───────────────────────────────────
const norm = s => String(s).toLowerCase().replace(/\s+/g,'-');
function resolveNode(name){
  const k = norm(name);
  let n = nodes.find(x => norm(x.title)===k || norm(x.id).includes(k));
  if(n) return n;
  // actor externo (agente/usuario API) sin nota propia: nodo fantasma
  n = { id:'actor:'+k, title:name, folder:'actor', ghost:true, tags:[],
        x:(Math.random()-0.5)*500, y:(Math.random()-0.5)*500, vx:0, vy:0, r:5 };
  nodes.push(n); byId[n.id]=n;
  return n;
}
async function pollUsage(){
  try{
    const s = await fetch('/telemetry/summary?limit=10').then(r=>r.json());
    if(!s.totals || !nodes.length) return;
    usageEdges = s.topEdges.map((e,i)=>{
      const a=resolveNode(e.source), b=resolveNode(e.target);
      return { a:a.id, b:b.id, calls:e.calls, lastTs:e.lastTs, phase:i*331 };
    });
    usageByNode = {};
    for(const n of s.topNodes){ const node=resolveNode(n.name); usageByNode[node.id]=n; }
    document.getElementById('acttotals').innerHTML = s.totals.calls
      ? '<b style="color:var(--teal)">'+s.totals.calls.toLocaleString()+'</b> llamadas · '
        +'<b style="color:var(--gold)">'+s.totals.tokens.toLocaleString()+'</b> tokens · '
        +'<b style="color:var(--pink)">'+s.totals.bez.toFixed(2)+'</b> BEZ'
      : 'sin tráfico aún';
    const maxCalls = s.topFunctions[0]?.calls || 1;
    document.getElementById('topfns').innerHTML =
      (s.topFunctions.length?'<div class="muted" style="margin-bottom:6px">funciones más usadas</div>':'')+
      s.topFunctions.slice(0,7).map(f =>
        '<div class="fnbar"><span class="name">'+f.fn+'</span><span class="bar" style="width:'+Math.max(8,(f.calls/maxCalls)*90)+'px"></span><span class="n">'+f.calls+'</span></div>'
      ).join('');
    document.getElementById('topedges').innerHTML =
      (s.topEdges.length?'<div class="muted" style="margin-bottom:4px">conexiones más activas</div>':'')+
      s.topEdges.slice(0,6).map(e =>
        '<div class="edgerow">'+e.source+' → <b>'+e.target+'</b> · '+e.fn+' · '+e.calls+'</div>'
      ).join('');
    const apiStat = document.getElementById('apistat');
    if(apiStat) apiStat.innerHTML = '<b>'+s.totals.calls.toLocaleString()+'</b> API calls';
  }catch{ /* servidor ocupado; siguiente tick */ }
}
setInterval(pollUsage, 4000);

let searchMode='lexical';
document.querySelectorAll('#mode span').forEach(el=>el.onclick=()=>{
  searchMode=el.dataset.m;
  document.querySelectorAll('#mode span').forEach(s=>s.classList.toggle('on', s===el));
});

async function runSearch(q, tag){
  const out=document.getElementById('results');
  out.innerHTML='<span class="muted">buscando…</span>';
  try{
    let results;
    if(searchMode==='semantic' && q){
      const r=await api('semantic_search',{query:q, limit:8});
      results=r.results; if(r.mode==='lexical-fallback') out.dataset.fb='1';
    } else {
      const params={query:q||tag||'*', limit:8}; if(tag) params.tags=[tag];
      results=(await api('search_vault',params)).results;
    }
    out.innerHTML = results.map(r=>
      '<div class="result" data-p="'+r.path+'"><span class="s">'+r.score+'</span><div class="t">'+r.title+'</div><div class="p">'+(r.preview||'')+'</div></div>'
    ).join('') || '<span class="muted">sin resultados</span>';
    out.querySelectorAll('.result').forEach(el=>el.onclick=()=>openNote(el.dataset.p));
  }catch(err){ out.innerHTML='<span class="muted">'+err.message+'</span>'; }
}
document.getElementById('go').onclick=()=>runSearch(document.getElementById('q').value.trim());
document.getElementById('q').addEventListener('keydown',e=>{ if(e.key==='Enter') runSearch(e.target.value.trim()); });

async function openNote(p){
  const n=byId[p]; if(n){ selected=n; }
  document.getElementById('notepath').textContent=p;
  const body=document.getElementById('notebody'); body.style.display='block'; body.textContent='…';
  try{
    const note=await api('get_note',{path:p});
    body.textContent=note.content.slice(0,4000);
    const rel=await api('get_related_notes',{path:p}).catch(()=>({outgoing:[],incoming:[]}));
    document.getElementById('notelinks').innerHTML =
      (rel.incoming.length?'<div class="muted" style="margin-top:8px">backlinks:</div>':'')+
      rel.incoming.map(i=>'<span class="linkchip" data-p="'+i.path+'">'+i.title+'</span>').join('');
    document.querySelectorAll('#notelinks .linkchip').forEach(el=>el.onclick=()=>openNote(el.dataset.p));
  }catch(err){ body.textContent='('+err.message+')'; }
}

// ── brain ops ────────────────────────────────────────────────
const opsout=document.getElementById('opsout');
document.getElementById('fp').onclick=async(e)=>{
  e.target.disabled=true; opsout.textContent='calculando merkle root…';
  try{ const r=await api('get_vault_fingerprint');
    opsout.innerHTML='<b>root:</b> '+r.root+'<br><b>notas:</b> '+r.notes+' · '+r.computedAt+
      '<br><span class="muted">listo para anclar vía blockchain-agent → QualityOracle</span>';
  }catch(err){ opsout.textContent=err.message; } e.target.disabled=false;
};
async function consolidate(dry){
  opsout.textContent='consolidando…';
  try{ const r=await api('consolidate_episodes',{olderThanDays:30, dryRun:dry});
    opsout.innerHTML='<b>'+(dry?'DRY-RUN':'EJECUTADO')+'</b> · digests: '+r.consolidated+' · archivados: '+r.archived+
      (r.digests.length?'<br>'+r.digests.map(d=>d.path+' ('+d.episodes+' ep)').join('<br>'):'<br><span class="muted">nada que consolidar (&lt;30 días)</span>');
    if(!dry){ await loadGraph(); await loadSide(); }
  }catch(err){ opsout.textContent=err.message; }
}
document.getElementById('cons').onclick=()=>consolidate(true);
document.getElementById('consreal').onclick=()=>consolidate(false);

resize(); loadGraph().then(()=>{ loadSide(); pollUsage(); tick(); });
</script>
</body>
</html>`;
