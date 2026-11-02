"""Renderiza player.html a vídeo con la RTX: Chromium dibuja con la NVIDIA (ANGLE sobre EGL) y NVENC codifica.

Uso: render.py <dir_trabajo> info|stills|frames [f0 f1 salida.mp4]
El dir de trabajo tiene durations.json y los mp3 de tts.py. Lanzar con las variables de entorno de render.sh
(VIDEO_SCENES, VIDEO_PLAYER, VIDEO_SIZE=1920x1080, VIDEO_LANG=es).
"""
import json, sys, subprocess, os
from playwright.sync_api import sync_playwright
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = sys.argv[1]; mode = sys.argv[2]; FPS = 25
GPU_ARGS = ['--enable-gpu', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl-egl', '--enable-gpu-rasterization']
SCENES = os.environ.get('VIDEO_SCENES', 'scenes.json'); PLAYER = os.environ.get('VIDEO_PLAYER', 'player.html')
VW, VH = map(int, os.environ.get('VIDEO_SIZE', '1920x1080').split('x')); LANG = os.environ.get('VIDEO_LANG', 'es')
scenes = json.load(open(D + '/' + SCENES)); dur = json.load(open(W + '/durations.json'))
with sync_playwright() as p:
    b = p.chromium.launch(channel='chromium', args=GPU_ARGS)
    pg = b.new_page(viewport={'width': VW, 'height': VH})
    gpu = pg.evaluate("""()=>{const g=document.createElement('canvas').getContext('webgl');const e=g&&g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):'?'}""")
    if 'NVIDIA' not in gpu:
        sys.exit(f'Chromium no está usando la NVIDIA ({gpu}). Lanza con render.sh.')
    pg.goto('file://' + D + '/' + PLAYER); pg.evaluate('document.fonts.ready')
    info = pg.evaluate('([s,d,l])=>setup(s,d,l)', [scenes, dur, LANG])
    if mode == 'info': print(json.dumps(info)); sys.exit()
    if mode == 'stills':
        for r in info['tl']:
            pg.evaluate(f"render({r['start'] + r['len'] * 0.8})")
            pg.screenshot(path=f"{W}/still_{r['id']}.jpg", type='jpeg', quality=80)
        sys.exit()
    f0, f1, out = int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
    ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(FPS), '-c:v', 'mjpeg', '-i', '-',
                           '-c:v', 'h264_nvenc', '-preset', 'p7', '-tune', 'hq', '-rc', 'vbr', '-cq', '19', '-b:v', '0',
                           '-profile:v', 'high', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
    for f in range(f0, f1):
        pg.evaluate(f'render({f / FPS})'); ff.stdin.write(pg.screenshot(type='jpeg', quality=92))
    ff.stdin.close(); ff.wait()
