#!/usr/bin/env python3
"""Graba el vídeo «Tokenización de propiedades en BeZhas» por sesiones, al ritmo de la locución.

Requisitos: entorno de demostración (demo_env.sh up), Hub en :5175 con VITE_RWA_FACTORY_ADDRESS y VITE_API_PROXY de la demo,
BZ Capital en :3014 con NEXT_PUBLIC_API_URL=http://localhost:3021, la locución generada (voice.py) y la NVIDIA.

  record.py [--sessions graficos,hub,venta,rentas_emisor,rentas_titular] [--audio audio] [--out ../out] [--scale 1]

Cada sesión es un clip (out/clips/<sesión>.mp4) con una o varias escenas seguidas; out/clips.json guarda dónde empieza y
acaba cada escena dentro de su clip. La duración de cada escena es la de su audio + una cola, y cada gesto se ancla al
comienzo de una frase de la locución."""
import argparse, asyncio, json, math, os, re, subprocess, sys, time, traceback, urllib.parse
from pathlib import Path
from playwright.async_api import async_playwright
from common import *

CFG = json.load(open(ROOT / 'scenes.en.json'))
SCN = {s['id']: s for s in CFG['scenes']}
LEGAL = CFG['legal']
LEAD = 0.4   # la voz entra 0,4 s después del inicio de la escena (igual que en el montaje)


class Scene:
    """Reloj de una escena: dur total, comienzo de cada frase de la locución."""
    def __init__(self, sid, dur, cap, audio_dur, scale=1.0):
        self.id, self.dur, self.cap, self.audio = sid, dur, cap, audio_dur
        self.t0 = time.perf_counter()
        sents = SCN[sid]['say']; words = [len(s.split()) for s in sents]; tot = sum(words)
        self.starts, acc = [], 0
        for w in words:
            self.starts.append(LEAD + acc / tot * audio_dur); acc += w
        self.start_cap = cap.now() if cap else 0.0

    def now(self): return time.perf_counter() - self.t0
    async def at(self, sec): await asyncio.sleep(max(0.0, sec - self.now()))
    async def at_sentence(self, i, lead=0.0): await self.at(self.starts[i] + lead)
    async def end(self): await self.at(self.dur)


# ───────────────────────────── gestos ─────────────────────────────
class Hand:
    def __init__(self, page):
        self.page, self.x, self.y = page, W * 0.5, H * 0.6

    async def move(self, x, y, dur=0.8, arc=0.04):
        sx, sy = self.x, self.y; dx, dy = x - sx, y - sy; dist = math.hypot(dx, dy)
        px, py = (-dy / dist, dx / dist) if dist > 1 else (0, 0)
        t0 = time.perf_counter()
        while True:
            k = (time.perf_counter() - t0) / max(dur, 0.05)
            if k >= 1: break
            e = ease(k); bow = math.sin(math.pi * e) * arc * dist
            await self.page.mouse.move(sx + dx * e + px * bow, sy + dy * e + py * bow)
            await asyncio.sleep(1 / 60)
        await self.page.mouse.move(x, y); self.x, self.y = x, y

    async def box(self, loc):
        await loc.evaluate("e=>e.scrollIntoView({block:'center',inline:'nearest'})")
        await asyncio.sleep(0.35)
        b = await loc.bounding_box()
        if not b: raise RuntimeError('elemento sin caja')
        return b

    async def go(self, loc, dur=0.8):
        b = await self.box(loc); await self.move(b['x'] + b['width'] / 2, b['y'] + b['height'] / 2, dur); return b

    async def click(self, loc, dur=0.8, dwell=0.35, after=0.35):
        await self.go(loc, dur); await asyncio.sleep(dwell)
        await self.page.mouse.down(); await asyncio.sleep(0.07); await self.page.mouse.up(); await asyncio.sleep(after)

    async def type(self, loc, text, cps=22):
        await self.click(loc, 0.6, 0.15, 0.1)
        await self.page.keyboard.press('Control+A')
        await self.page.keyboard.type(text, delay=int(1000 / cps))

    async def ring(self, loc, label='', dy=-42, pad=0):
        b = await self.box(loc)
        await self.page.evaluate('([x,y,w,h,l,dy])=>window.__ov.ring(x,y,w,h,l,dy)', [b['x'] - pad, b['y'] - pad, b['width'] + 2 * pad, b['height'] + 2 * pad, label, dy])
        return b

    async def unring(self): await self.page.evaluate('()=>window.__ov.clearRing()')
    async def badge(self, n, text, sub=''): await self.page.evaluate('([n,t,s])=>window.__ov.badge(n,t,s)', [n, text, sub])


# ───────────────────────────── sesión: gráficos ─────────────────────────────
GRAFICOS = ['T01', 'T02', 'T03', 'T08', 'T12', 'T13', 'T14']


def chain_events():
    """Eventos reales de la cadena de demostración, para la escena «todo queda en la cadena»."""
    e = demo_env(); out = []
    sigs = {
        'AssetTokenized': ('AssetTokenized(uint256,string,uint8,address,uint256,uint256)', e['FACT']),
        'Listed': ('Listed(uint256,uint256,address,uint256,uint256)', e['SALE']),
        'Bought': ('Bought(uint256,address,uint256,uint256,uint256)', e['SALE']),
        'DistributionCreated': ('DistributionCreated(uint256,uint256,address,address,uint256,uint256,bytes32,uint64,uint64,string)', e['RENT']),
        'Claimed': ('Claimed(uint256,address,uint256)', e['RENT']),
    }
    for name, (sig, addr) in sigs.items():
        t = subprocess.run(['cast', 'keccak', sig], capture_output=True, text=True, check=True).stdout.strip()
        raw = cast('rpc', 'eth_getLogs', json.dumps({'address': addr, 'fromBlock': '0x0', 'toBlock': 'latest', 'topics': [t]}))
        for l in json.loads(raw)[:1]:
            out.append({'name': name, 'block': int(l['blockNumber'], 16), 'tx': l['transactionHash'][:10] + '…' + l['transactionHash'][-6:]})
    return sorted(out, key=lambda x: x['block'])


async def session_graficos(p, outdir, durs, audio, scale):
    timings = []
    for sid in GRAFICOS:
        dur = durs[sid] * scale
        browser = await p.chromium.launch(channel='chromium', args=GPU_ARGS)
        ctx = await browser.new_context(viewport={'width': W, 'height': H}, device_scale_factor=DSF)
        data = {'mcp': json.load(open(ROOT / 'assets' / 'mcp-tokenize-prepare.json'))}
        if sid == 'T13': data['events'] = chain_events()
        await ctx.add_init_script(f'window.__data={json.dumps(data)}')
        page = await ctx.new_page(); cdp = await ctx.new_cdp_session(page)
        q = urllib.parse.urlencode({'scene': sid, 'dur': f'{dur:.2f}', 'legal': LEGAL, 'kicker': SCN[sid]['title'] if sid not in ('T01',) else 'Property tokenization'})
        await page.goto(f'file://{HERE}/graphics.html?{q}', wait_until='load'); await asyncio.sleep(1.5)
        clip = outdir / 'clips' / f'{sid}.mp4'; clip.parent.mkdir(parents=True, exist_ok=True)
        cap = Capture(cdp, clip); await cap.start()
        await page.evaluate('()=>window.__go()'); t0 = time.perf_counter()
        print(f'▶ {sid} · {SCN[sid]["title"]} ({dur:.1f} s)')
        await asyncio.sleep(max(0.0, dur - (time.perf_counter() - t0)))
        await cap.stop(); await browser.close()
        timings.append({'clip': f'clips/{sid}.mp4', 'scenes': [{'id': sid, 'start': 0.0, 'end': round(dur, 2)}]})
    return timings


# ───────────────────────────── helpers de pantalla ─────────────────────────────
FAST_POLL = "(()=>{const st=window.setTimeout.bind(window);window.setTimeout=(f,ms,...a)=>st(f,ms===4000?450:ms,...a);const si=window.setInterval.bind(window);window.setInterval=(f,ms,...a)=>si(f,ms===4000?450:ms,...a)})();"


async def open_page(p, who, url, *, dismiss_tour=False, wait_text=None):
    browser = await p.chromium.launch(channel='chromium', args=GPU_ARGS)
    ctx = await browser.new_context(viewport={'width': W, 'height': H}, device_scale_factor=DSF)
    await ctx.add_init_script(FAST_POLL + init_script(who))
    page = await ctx.new_page(); cdp = await ctx.new_cdp_session(page)
    await page.goto(url, wait_until='domcontentloaded'); await asyncio.sleep(5)
    if dismiss_tour:
        await page.keyboard.press('Escape')
        await page.evaluate("""()=>{[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='No, gracias')?.click();
          document.querySelector('[aria-label*="errar"]')?.click()}"""); await asyncio.sleep(1)
    if wait_text: await page.get_by_text(wait_text).first.wait_for(timeout=30000)
    await page.add_style_tag(content='nextjs-portal,#google_translate_element,.skiptranslate,.goog-te-gadget,.bzai,div.pointer-events-none.fixed.inset-x-0.bottom-0{display:none!important}')
    await page.add_script_tag(path=str(HERE / 'overlay.js')); await asyncio.sleep(0.3)
    await page.evaluate('([l,d])=>window.__ov.footer(l,d)', [LEGAL, 'Demonstration environment'])
    await page.mouse.move(W * 0.5, H * 0.6)
    return browser, ctx, page, cdp


async def begin(page, cdp, clip):
    clip.parent.mkdir(parents=True, exist_ok=True)
    cap = Capture(cdp, clip); await cap.start()
    await page.evaluate('()=>window.__ov.fade(false)')
    return cap


async def finish(page, cap, browser):
    await page.evaluate('()=>window.__ov.fade(true)'); await asyncio.sleep(0.6)
    await cap.stop(); await browser.close()


async def safe(label, coro):
    try:
        await coro
    except Exception as e:  # la línea de tiempo se conserva; el fallo queda anotado
        traceback.print_exc(); print(f'  ✗ {label}: {type(e).__name__}: {str(e)[:160]}', file=sys.stderr); return f'{label}: {e}'
    return None


# ───────────────────────────── sesión: asistente del Hub (T04–T07) ─────────────────────────────
async def session_hub(p, outdir, durs, audio, scale):
    browser, ctx, page, cdp = await open_page(p, 'emisor', f'{HUB}/rwa', dismiss_tour=True, wait_text='Mi Balance')
    h = Hand(page); clip = outdir / 'clips' / 'hub.mp4'
    cap = await begin(page, cdp, clip); timings = []; errors = []
    modal = page.locator('.fixed').filter(has_text='Tokenizar Activo Real')

    def scene(sid): return Scene(sid, durs[sid] * scale, cap, audio[sid] * scale)

    # T04 · tipo de activo
    sc = scene('T04'); st = cap.now(); print('▶ T04 · Step 1')
    async def t04():
        await sc.at(0.5); await h.badge('1', 'Choose the asset', '· step 1 of 4')
        await h.click(page.get_by_role('button', name='Tokenizar Activo'), 1.0)
        await modal.get_by_text('Inmueble', exact=True).first.wait_for(timeout=10000)
        await sc.at_sentence(1, -0.3)
        for name in ('Hotel', 'Local Comercial', 'Barco/Yate'):
            await h.go(modal.get_by_text(name, exact=True).first, 0.55)
            await asyncio.sleep(0.25)
        await h.click(modal.get_by_text('Inmueble', exact=True).first, 0.7)
        await h.ring(modal.get_by_text('Inmueble', exact=True).first.locator('xpath=ancestor::button[1]'), 'Property', -44)
    errors.append(await safe('T04', t04())); await sc.end()
    timings.append({'id': 'T04', 'start': round(st, 2), 'end': round(cap.now(), 2)})

    # T05 · datos
    sc = scene('T05'); st = cap.now(); print('▶ T05 · Step 2')
    async def t05():
        await h.unring(); await h.badge('2', 'The asset\'s details', '· step 2 of 4')
        await h.click(modal.get_by_role('button', name='Siguiente'), 0.8)
        await modal.get_by_placeholder('Ej: Apartamento Luxury Penthouse').wait_for(timeout=10000)
        await sc.at_sentence(1, -0.2)
        await h.type(modal.get_by_placeholder('Ej: Apartamento Luxury Penthouse'), 'Penthouse Madrid Centro')
        await h.type(modal.get_by_placeholder('1000000'), '1200000')
        await h.type(modal.get_by_placeholder('Calle, Ciudad, País'), 'Calle Mayor 1, Madrid, España')
        await h.type(modal.get_by_placeholder('150'), '180')
        await sc.at_sentence(2, 0.2)
        await h.ring(modal.get_by_placeholder('1000000'), 'Declared by the issuer', -42)
    errors.append(await safe('T05', t05())); await sc.end()
    timings.append({'id': 'T05', 'start': round(st, 2), 'end': round(cap.now(), 2)})

    # T06 · fraccionar
    sc = scene('T06'); st = cap.now(); print('▶ T06 · Step 3')
    async def t06():
        await h.unring(); await h.badge('3', 'Fractioning', '· step 3 of 4')
        await h.click(modal.get_by_role('button', name='Siguiente'), 0.8)
        await modal.get_by_placeholder('1000').wait_for(timeout=10000)
        await sc.at_sentence(1, -0.3)
        await h.type(modal.get_by_placeholder('1000'), '10000')
        await asyncio.sleep(0.5)
        sug = modal.get_by_test_id('usar-precio-sugerido')
        await h.ring(sug, 'Suggested price at the current BEZ price', -42)
        await asyncio.sleep(0.9)
        await h.click(sug, 0.8)
        await h.unring()    # al aplicarse, el enlace de sugerencia desaparece: el resalte no puede quedarse colgado
        await h.ring(modal.get_by_placeholder('100.00'), '16,000 BEZ per fraction', -42)
        await sc.at_sentence(2, 0.0)
        await h.ring(modal.get_by_test_id('equivalencias'), '≈ $120 per fraction', -42)
        await sc.at_sentence(3, 0.0); await h.unring()
        await h.type(modal.get_by_placeholder('8.5'), '5')
        await h.ring(modal.get_by_placeholder('8.5'), 'Declared, not a guarantee', -42)
        await sc.at_sentence(4, 0.0)
        await h.ring(modal.get_by_test_id('precio-bez').locator('xpath=ancestor::div[1]'), 'Fee: 100 BEZ ≈ $0.75', -42)
    errors.append(await safe('T06', t06())); await sc.end()
    timings.append({'id': 'T06', 'start': round(st, 2), 'end': round(cap.now(), 2)})

    # T07 · documentos y firma
    sc = scene('T07'); st = cap.now(); print('▶ T07 · Step 4')
    async def t07():
        await h.unring(); await h.badge('4', 'Documents and signature', '· step 4 of 4')
        await h.click(modal.get_by_role('button', name='Siguiente'), 0.8)
        await modal.get_by_text('Click para subir PDFs').wait_for(timeout=10000)
        await sc.at_sentence(0, 0.8)
        await h.go(modal.get_by_text('Click para subir PDFs'), 0.8); await asyncio.sleep(0.4)
        await page.set_input_files('#legal-upload', {'name': 'escritura-penthouse-madrid.pdf', 'mimeType': 'application/pdf', 'buffer': b'%PDF-1.4 demo'})
        await sc.at_sentence(1, 0.0)
        await h.ring(modal.get_by_text('escritura-penthouse-madrid.pdf'), 'Fingerprint on IPFS', -42)
        await sc.at_sentence(2, 0.0); await h.unring()
        await h.click(modal.get_by_role('button', name='Tokenizar Activo'), 1.0, 0.5, 0.3)
        for _ in range(60):   # a la espera de que el asistente se cierre al crear el activo
            if int(cast('call', demo_env()['FACT'], 'assetCount()(uint256)').split()[0]) >= 1: break
            await asyncio.sleep(0.5)
        await h.badge('✓', 'Asset created', '· 10,000 fractions in your wallet')
    errors.append(await safe('T07', t07())); await sc.end()
    timings.append({'id': 'T07', 'start': round(st, 2), 'end': round(cap.now(), 2)})

    await finish(page, cap, browser)
    return [{'clip': 'clips/hub.mp4', 'scenes': timings, 'errors': [e for e in errors if e]}]


# ───────────────────────────── sesiones de BZ Capital ─────────────────────────────
def verificar_kyc(*who):
    e = demo_env(); aid = '1'
    for w in who:
        cast_send(e['FACT'], 'verifyInvestor(uint256,address)', aid, session(w)['address'], who='deployer')


async def comprar_fuera_de_pantalla(who, listing, cantidad):
    """Una compra de apoyo que no sale en el vídeo (Luis), por la API y la wallet de pruebas."""
    import urllib.request
    s = session(who)
    req = urllib.request.Request('http://localhost:3021/api/gateway/v1/rwa/sale/buy/prepare', method='POST',
                                 data=json.dumps({'fabrica': 'activos', 'listingId': listing, 'cantidad': cantidad, 'comprador': s['address']}).encode(),
                                 headers={'Authorization': 'Bearer ' + s['jwt'], 'Content-Type': 'application/json'})
    prep = json.load(urllib.request.urlopen(req, timeout=60))
    for t in sorted(prep['transacciones'], key=lambda t: t['paso']):
        out = cast('send', t['to'], '--data', t['data'], '--private-key', KEYS[who])
        if 'status               1' not in out: raise RuntimeError('compra de apoyo fallida')


async def session_venta(p, outdir, durs, audio, scale):
    sc_cfg = SCN['T09']; total = durs['T09'] * scale; a = audio['T09'] * scale
    verificar_kyc('ana', 'luis')
    timings, errors = [], []
    sc_starts = []

    # Parte A · el emisor publica la oferta
    browser, ctx, page, cdp = await open_page(p, 'emisor', f'{CAPITAL}/rwa/venta', wait_text='Comprar fracciones')
    h = Hand(page); clip = outdir / 'clips' / 'venta-a.mp4'; cap = await begin(page, cdp, clip)
    sc = Scene('T09', total * sc_cfg['parts'][0], cap, a * sc_cfg['parts'][0]); sc.starts = [LEAD, LEAD + 2.2, 99]
    print('▶ T09 (a) · offer'); stA = cap.now()
    async def parte_a():
        await h.badge('Issuer', 'Publish the offer', '· quantity and price')
        await sc.at(0.4); await h.click(page.get_by_role('tab', name='Vender (emisor)'), 0.8)
        await h.click(page.get_by_role('radio', name=re.compile('Penthouse')), 0.7)
        await h.type(page.get_by_label('Fracciones a la venta'), '1000')
        await h.type(page.get_by_label('Precio por fracción (BEZ)'), '16000')
        await h.click(page.get_by_role('button', name='Preparar oferta'), 0.7)
        await page.get_by_role('button', name='Firmar y publicar oferta').wait_for(timeout=15000)
        await h.click(page.get_by_role('button', name='Firmar y publicar oferta'), 0.7)
        await page.get_by_text('Oferta publicada').wait_for(timeout=30000)
        await h.ring(page.get_by_text('Oferta publicada').first, 'Offer #1 is live', -42)
    errors.append(await safe('T09a', parte_a())); await sc.end()
    timings_a = [{'id': 'T09', 'start': round(stA, 2), 'end': round(cap.now(), 2)}]
    await finish(page, cap, browser)

    # apoyo fuera de pantalla: Luis compra 200 para que el reparto tenga a dos titulares
    await comprar_fuera_de_pantalla('luis', 1, 200)

    # Parte B · el inversor compra
    browser, ctx, page, cdp = await open_page(p, 'ana', f'{CAPITAL}/rwa/venta', wait_text='Comprar fracciones')
    h = Hand(page); clip_b = outdir / 'clips' / 'venta-b.mp4'; cap = await begin(page, cdp, clip_b)
    sc = Scene('T09', total * sc_cfg['parts'][1], cap, a * sc_cfg['parts'][1]); sc.starts = [LEAD, LEAD + 4.0, 99]
    print('▶ T09 (b) · purchase'); stB = cap.now()
    async def parte_b():
        await h.badge('Investor', 'Buy fractions', '· paid in BEZ')
        await sc.at(0.4); await h.type(page.get_by_label('Nº de oferta'), '1')
        await h.click(page.get_by_role('button', name='Ver oferta'), 0.7)
        await page.get_by_label('Fracciones a comprar').wait_for(timeout=15000)
        await h.type(page.get_by_label('Fracciones a comprar'), '600')
        await h.ring(page.get_by_role('button', name=re.compile('Comprar por')), '600 fractions · $72,000', -42)
        await asyncio.sleep(0.8)
        await h.click(page.get_by_role('button', name=re.compile('Comprar por')), 0.7)
        await page.get_by_text(re.compile('Compradas 600')).wait_for(timeout=30000)
        await h.ring(page.get_by_text(re.compile('Compradas 600')), 'BEZ to the issuer · fractions to the investor', -42)
    errors.append(await safe('T09b', parte_b())); await sc.end()
    timings_b = [{'id': 'T09', 'start': round(stB, 2), 'end': round(cap.now(), 2)}]
    await finish(page, cap, browser)
    return [{'clip': 'clips/venta-a.mp4', 'scenes': timings_a, 'errors': [e for e in errors[:1] if e]},
            {'clip': 'clips/venta-b.mp4', 'scenes': timings_b, 'errors': [e for e in errors[1:] if e]}]


async def session_rentas_emisor(p, outdir, durs, audio, scale):
    # El corte del reparto es la cabeza −128 bloques (confirmaciones): sin minar, las compras de hace un momento quedarían fuera.
    cast('rpc', 'anvil_mine', '200')
    browser, ctx, page, cdp = await open_page(p, 'emisor', f'{CAPITAL}/rwa/rentas', wait_text='Cobrar mis rentas')
    h = Hand(page); clip = outdir / 'clips' / 'rentas-emisor.mp4'; cap = await begin(page, cdp, clip)
    sc = Scene('T10', durs['T10'] * scale, cap, audio['T10'] * scale); st = cap.now(); print('▶ T10 · Distribute rent')
    async def t10():
        await h.badge('Issuer', 'Distribute the rent', '· deposit and split')
        await sc.at(0.5); await h.click(page.get_by_role('tab', name='Soy emisor'), 0.8)
        await h.click(page.get_by_role('radio', name=re.compile('Penthouse')), 0.7)
        await sc.at_sentence(1, 0.0)
        await h.type(page.get_by_label('Importe a repartir'), '5000')
        await h.ring(page.get_by_label('Importe a repartir'), 'Monthly rent · 5,000 USDC', -42)
        await sc.at_sentence(2, 0.0); await h.unring()
        await h.click(page.get_by_role('button', name='Calcular reparto'), 0.8)
        await page.get_by_text('Titulares que cobran').wait_for(timeout=30000)
        await h.ring(page.get_by_text('Titulares que cobran').locator('xpath=ancestor::dl'), 'Holders at the snapshot block', -42)
        await sc.at_sentence(3, 0.4)
        await h.click(page.get_by_role('button', name=re.compile('Firmar y depositar')), 0.8)
        await page.get_by_text('Reparto creado').wait_for(timeout=30000)
        await h.ring(page.get_by_text('Reparto creado').first, 'Distribution created', -42)
    err = await safe('T10', t10()); await sc.end()
    timings = [{'id': 'T10', 'start': round(st, 2), 'end': round(cap.now(), 2)}]
    await finish(page, cap, browser)
    return [{'clip': 'clips/rentas-emisor.mp4', 'scenes': timings, 'errors': [err] if err else []}]


async def session_rentas_titular(p, outdir, durs, audio, scale):
    browser, ctx, page, cdp = await open_page(p, 'ana', f'{CAPITAL}/rwa/rentas', wait_text='Cobrar mis rentas')
    h = Hand(page); clip = outdir / 'clips' / 'rentas-titular.mp4'; cap = await begin(page, cdp, clip)
    sc = Scene('T11', durs['T11'] * scale, cap, audio['T11'] * scale); st = cap.now(); print('▶ T11 · Collect')
    async def t11():
        await h.badge('Investor', 'Collect the rent', '· one click')
        await sc.at(0.5); await h.type(page.get_by_label('Nº de activo'), '1')
        await h.click(page.get_by_role('button', name='Ver repartos'), 0.7)
        btn = page.get_by_role('button', name=re.compile('^Cobrar [0-9]'))
        await btn.first.wait_for(timeout=30000)
        await sc.at_sentence(1, 0.0)
        await h.ring(btn.first, 'Your share: 3,750 USDC', -42)
        await asyncio.sleep(1.2)
        await sc.at_sentence(2, -2.4); await h.unring()
        await h.click(btn.first, 0.8)
        await page.get_by_text(re.compile('Ya cobrado')).first.wait_for(timeout=30000)
        await h.ring(page.get_by_text(re.compile('Ya cobrado')).first, 'Collected · can\'t be claimed twice', -42)
    err = await safe('T11', t11()); await sc.end()
    timings = [{'id': 'T11', 'start': round(st, 2), 'end': round(cap.now(), 2)}]
    await finish(page, cap, browser)
    return [{'clip': 'clips/rentas-titular.mp4', 'scenes': timings, 'errors': [err] if err else []}]


# Orden de grabación: el estado de la cadena avanza con las sesiones (activo → oferta → reparto → cobro → gráficos con los eventos).
SESSIONS = {'hub': session_hub, 'venta': session_venta, 'rentas_emisor': session_rentas_emisor,
            'rentas_titular': session_rentas_titular, 'graficos': session_graficos}
ORDER = ['hub', 'venta', 'rentas_emisor', 'rentas_titular', 'graficos']


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sessions', default=','.join(ORDER)); ap.add_argument('--out', default=str(ROOT / 'out'))
    ap.add_argument('--audio', default=str(ROOT / 'audio')); ap.add_argument('--scale', type=float, default=1.0)
    a = ap.parse_args()
    outdir = Path(a.out); outdir.mkdir(parents=True, exist_ok=True)
    adur = json.load(open(Path(a.audio) / 'durations.json'))
    durs = {k: v + CFG['tail_s'] for k, v in adur.items()}
    manifest_p = outdir / 'clips.json'
    manifest = json.load(open(manifest_p)) if manifest_p.exists() else {}
    async with async_playwright() as p:
        for name in [s for s in a.sessions.split(',') if s]:
            print(f'═══ sesión {name}')
            res = await SESSIONS[name](p, outdir, durs, adur, a.scale)
            manifest[name] = res
            json.dump(manifest, open(manifest_p, 'w'), indent=1, ensure_ascii=False)
    print('Listo:', manifest_p)

if __name__ == '__main__':
    asyncio.run(main())
