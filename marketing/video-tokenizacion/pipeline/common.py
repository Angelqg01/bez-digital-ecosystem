"""Piezas comunes de la grabación: ventana, wallet simulada, sesión de prueba y captura a 30 fps con NVENC.

Todo contra el ENTORNO DE DEMOSTRACIÓN (demo_env.sh): cadena local con chain id 137, API en :3021 y las cuentas
públicas de anvil. La «wallet» es un window.ethereum simulado que reenvía las llamadas a esa cadena; no hay claves reales."""
import asyncio, base64, json, os, subprocess, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
STATE = Path(os.environ.get('DEMO_STATE', Path.home() / '.cache' / 'bz-video-tokenizacion'))
FPS = 30
W, H, DSF = 1280, 720, 1.5            # 1280×720 CSS a 1,5× = 1920×1080 reales; la interfaz se lee grande
RPC = 'http://127.0.0.1:8545'
HUB = os.environ.get('HUB', 'http://localhost:5175')
CAPITAL = os.environ.get('CAPITAL', 'http://localhost:3014/defi')
GPU_ARGS = ['--enable-gpu', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl-egl', '--enable-gpu-rasterization']
os.environ.setdefault('__NV_PRIME_RENDER_OFFLOAD', '1'); os.environ.setdefault('__GLX_VENDOR_LIBRARY_NAME', 'nvidia')
os.environ.setdefault('__EGL_VENDOR_LIBRARY_FILENAMES', '/usr/share/glvnd/egl_vendor.d/10_nvidia.json')

# Claves públicas de anvil (cuentas de prueba). Nunca son claves de nadie.
KEYS = {
    'deployer': '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    'emisor': '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    'ana': '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
    'luis': '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
}


def demo_env():
    return dict(l.split('=', 1) for l in (STATE / 'demo.env').read_text().split())


def session(who):
    return json.loads((STATE / 'jwts.json').read_text())[who]   # {address, jwt}


def cast(*args):
    r = subprocess.run(['cast', *args, '--rpc-url', RPC], capture_output=True, text=True)
    if r.returncode: raise RuntimeError(f"cast {' '.join(args[:2])}: {r.stderr.strip()[:200]}")
    return r.stdout.strip()


def cast_send(to, sig, *args, who='deployer'):
    out = cast('send', to, sig, *args, '--private-key', KEYS[who])
    if 'status               1' not in out: raise RuntimeError(f'La transacción de {sig} no salió bien')
    return out


def init_script(who, with_session=True):
    """Wallet simulada + sesión de prueba. Se inyecta antes de que cargue la página."""
    s = session(who)
    js = f"""(()=>{{
  const A='{s['address']}', RPC='{RPC}';
  window.ethereum={{isMetaMask:true,request:async({{method,params=[]}})=>{{
    if(method==='eth_requestAccounts'||method==='eth_accounts')return[A];
    if(method==='eth_chainId')return'0x89'; if(method==='net_version')return'137';
    if(method==='wallet_switchEthereumChain'||method==='wallet_addEthereumChain')return null;
    const r=await fetch(RPC,{{method:'POST',headers:{{'Content-Type':'application/json'}},body:JSON.stringify({{jsonrpc:'2.0',id:Date.now(),method,params}})}}).then(r=>r.json());
    if(r.error){{const e=new Error(r.error.message);e.code=r.error.code;throw e}} return r.result}},on(){{}},removeListener(){{}}}};
  // wagmi lee la cadena a través de su RPC público de Polygon: se desvía a la cadena de demostración.
  const rf=window.fetch.bind(window);
  window.fetch=(u,o)=>{{const url=typeof u==='string'?u:(u&&u.url)||''; if(o&&o.method==='POST'&&/polygon|publicnode|polygon-rpc|llamarpc|ankr|alchemy|infura/.test(url)) return rf(RPC,o); return rf(u,o)}};
  {"localStorage.setItem('bezhas-jwt','"+s['jwt']+"'); localStorage.setItem('bezhas-user',JSON.stringify({username:'"+who+"',role:'user',walletAddress:A})); localStorage.setItem('theme','dark');" if with_session else "localStorage.setItem('theme','dark');"}
}})();"""
    return js


def ease(t):
    t = max(0.0, min(1.0, t)); return t * t * t * (t * (6 * t - 15) + 10)


class Capture:
    """Captura la página con CDP y la vuelca a ffmpeg (NVENC) a 30 fps constantes."""
    def __init__(self, cdp, out):
        self.cdp, self.out, self.last, self.frames, self.running = cdp, out, None, 0, False

    async def start(self):
        self.ff = subprocess.Popen(
            ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(FPS), '-vcodec', 'mjpeg', '-i', '-', '-an',
             '-vf', 'scale=1920:1080:flags=lanczos,format=yuv420p', '-c:v', 'h264_nvenc', '-preset', 'p5', '-tune', 'hq', '-rc', 'vbr',
             '-cq', '19', '-b:v', '0', '-maxrate', '30M', '-bufsize', '60M', '-g', '60', '-movflags', '+faststart', str(self.out)],
            stdin=subprocess.PIPE)
        self.cdp.on('Page.screencastFrame', self._on_frame)
        await self.cdp.send('Page.startScreencast', {'format': 'jpeg', 'quality': 92, 'maxWidth': 1920, 'maxHeight': 1080, 'everyNthFrame': 1})
        for _ in range(100):
            if self.last: break
            await asyncio.sleep(0.05)
        else:
            raise RuntimeError('La captura no entregó ningún fotograma')
        self.running = True; self.t0 = time.perf_counter(); self.task = asyncio.create_task(self._writer())

    def _on_frame(self, ev):
        self.last = base64.b64decode(ev['data'])
        if self.running: asyncio.ensure_future(self._ack(ev['sessionId']))

    async def _ack(self, sid):
        try: await self.cdp.send('Page.screencastFrameAck', {'sessionId': sid})
        except Exception: pass

    async def _writer(self):
        n = 0
        while self.running:
            await asyncio.sleep(max(0.0, self.t0 + n / FPS - time.perf_counter()))
            self.ff.stdin.write(self.last); self.frames += 1; n += 1

    def now(self): return self.frames / FPS

    async def stop(self):
        self.running = False; await self.task
        await self.cdp.send('Page.stopScreencast'); self.ff.stdin.close(); self.ff.wait()
