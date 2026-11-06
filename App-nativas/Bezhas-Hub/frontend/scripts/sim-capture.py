"""Capturas y métricas del Simulador 360° (pestaña SDK Simulator de /developer-console).

Abre el Hub en Chromium con la GPU NVIDIA (mismo arranque que
marketing/video-como-funciona/pipeline/render.py), ejecuta la simulación y
guarda <salida>-idle.png y <salida>-run.png. Imprime fps, draw calls por frame
(media de 60 frames), triángulos, fps con la CPU a 6x, recuento de mallas y un
perfil de CPU. Necesita el servidor de desarrollo en :5173 (el gancho
window.__bzSimGl sólo existe en desarrollo).

Uso:
  export __NV_PRIME_RENDER_OFFLOAD=1 __GLX_VENDOR_LIBRARY_NAME=nvidia \
         __EGL_VENDOR_LIBRARY_FILENAMES=/usr/share/glvnd/egl_vendor.d/10_nvidia.json
  python3.13 scripts/sim-capture.py /tmp/sim          # tema claro, WebGL
  DARK=1 python3.13 scripts/sim-capture.py /tmp/sim   # tema oscuro
  NOGL=1 python3.13 scripts/sim-capture.py /tmp/sim   # sin WebGL (mapa 2D)
  RUNWAIT=12 ...                                      # segundos de simulación antes de medir
"""
import sys, time
from playwright.sync_api import sync_playwright
import os
GPU_ARGS = ['--disable-gpu','--disable-webgl','--disable-3d-apis'] if os.environ.get('NOGL') else ['--enable-gpu', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl-egl', '--enable-gpu-rasterization']
out = sys.argv[1]
with sync_playwright() as p:
    b = p.chromium.launch(channel='chromium', args=GPU_ARGS)
    pg = b.new_page(viewport={'width': 1600, 'height': 1000})
    if os.environ.get('DARK'): pg.add_init_script("localStorage.setItem('theme','dark')")
    pg.goto('http://localhost:5173/developer-console', wait_until='domcontentloaded')
    gpu = pg.evaluate("""()=>{const g=document.createElement('canvas').getContext('webgl');const e=g&&g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):'?'}""")
    print('GPU', gpu)
    time.sleep(6)
    pg.mouse.click(1283,173)
    time.sleep(1)
    pg.keyboard.press('Escape')
    pg.evaluate("""()=>{for(const t of ['No, gracias']){[...document.querySelectorAll('button')].find(x=>x.innerText.trim()===t)?.click()}; document.querySelector('[aria-label*="errar"]')?.click(); [...document.querySelectorAll('button')].find(x=>/SDK Simulator/.test(x.innerText))?.click()}""")
    time.sleep(8)
    pg.evaluate("""()=>{[...document.querySelectorAll('div')].find(d=>d.className?.includes?.('h-[82vh]'))?.scrollIntoView({block:'start'})}""")
    time.sleep(1)
    fps = pg.evaluate("""()=>new Promise(r=>{let n=0;const t0=performance.now();function f(){n++; if(performance.now()-t0<2000) requestAnimationFrame(f); else r(n/2)}; requestAnimationFrame(f)})""")
    print('FPS', fps)
    print('GLINFO-idle', pg.evaluate('(()=>new Promise(r=>{const g=window.__bzSimGl; if(!g) return r(null); g.info.autoReset=false; let n=0,calls=0,tris=0,mx=0; function f(){ if(n>0){calls+=g.info.render.calls; tris+=g.info.render.triangles; mx=Math.max(mx,g.info.render.calls);} g.info.reset(); n++; if(n<=60) requestAnimationFrame(f); else { g.info.autoReset=true; r({callsAvg:Math.round(calls/60), callsMax:mx, trisAvg:Math.round(tris/60), dpr:g.getPixelRatio()}); } } requestAnimationFrame(f); }))()'))
    pg.screenshot(path=out+'-idle.png')
    pg.evaluate("""()=>{[...document.querySelectorAll('button')].find(x=>/^2x$/.test(x.innerText.trim()))?.click(); [...document.querySelectorAll('button')].find(x=>/Ejecutar 360/i.test(x.innerText))?.click()}""")
    time.sleep(int(os.environ.get('RUNWAIT','25')))
    fps2 = pg.evaluate("""()=>new Promise(r=>{let n=0;const t0=performance.now();function f(){n++; if(performance.now()-t0<2000) requestAnimationFrame(f); else r(n/2)}; requestAnimationFrame(f)})""")
    print('FPS-running', fps2)
    print('GLINFO-run', pg.evaluate('(()=>new Promise(r=>{const g=window.__bzSimGl; if(!g) return r(null); g.info.autoReset=false; let n=0,calls=0,tris=0,mx=0; function f(){ if(n>0){calls+=g.info.render.calls; tris+=g.info.render.triangles; mx=Math.max(mx,g.info.render.calls);} g.info.reset(); n++; if(n<=60) requestAnimationFrame(f); else { g.info.autoReset=true; r({callsAvg:Math.round(calls/60), callsMax:mx, trisAvg:Math.round(tris/60), dpr:g.getPixelRatio()}); } } requestAnimationFrame(f); }))()'))
    print('LONGTASKS', pg.evaluate("(()=>performance.getEntriesByType('longtask').length)()"))
    pg.screenshot(path=out+'-run.png')
    cdp = pg.context.new_cdp_session(pg)
    cdp.send('Emulation.setCPUThrottlingRate', {'rate': 6})
    time.sleep(1)
    fps3 = pg.evaluate("""()=>new Promise(r=>{let n=0;const t0=performance.now();function f(){n++; if(performance.now()-t0<3000) requestAnimationFrame(f); else r(n/3)}; requestAnimationFrame(f)})""")
    print('FPS-cpu6x', round(fps3,1))
    print('SCENE', pg.evaluate("""(()=>{const sc=window.__bzSimScene; if(!sc) return null; const c={mesh:0,inst:0,line:0,text:0,cast:0,visible:0}; sc.traverse(o=>{ if(!o.isMesh) return; c.mesh++; if(o.isInstancedMesh) c.inst++; if(o.type==='Line2'||o.isLine2||o.isLineSegments2) c.line++; if(o.constructor&&/Text/.test(o.constructor.name)) c.text++; if(o.castShadow) c.cast++; }); return c})()"""))
    cdp.send('Profiler.enable'); cdp.send('Profiler.start')
    time.sleep(3)
    prof = cdp.send('Profiler.stop')['profile']
    import collections
    self_t = collections.Counter()
    nodes = {n['id']: n for n in prof['nodes']}
    dt = prof.get('timeDeltas', [])
    for sid, d in zip(prof.get('samples', []), dt):
        cf = nodes[sid]['callFrame']
        url = cf['url'].split('/')[-1].split('?')[0]
        self_t[(cf['functionName'] or '(anon)') + ' @' + url] += d
    tot = sum(self_t.values()) or 1
    for k, v in self_t.most_common(14):
        print('PROF', round(100*v/tot,1), '%', k)
    cdp.send('Emulation.setCPUThrottlingRate', {'rate': 1})
    print('canvas', pg.evaluate("document.querySelectorAll('canvas').length"), 'map2d', pg.evaluate("!!document.querySelector('svg[aria-label^=\"Recorrido\"]')"))
    b.close()
