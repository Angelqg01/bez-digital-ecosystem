"""Fotogramas fijos de las escenas gráficas (para revisarlas sin grabar): still_graphics.py T01,T03 0.85"""
import asyncio, json, sys
from pathlib import Path
from playwright.async_api import async_playwright
from common import *

async def main():
    ids = (sys.argv[1] if len(sys.argv) > 1 else 'T01,T02,T03,T08,T12,T13,T14').split(',')
    frac = float(sys.argv[2]) if len(sys.argv) > 2 else 0.9
    cfg = json.load(open(ROOT / 'scenes.en.json')); durs = json.load(open(ROOT / 'audio' / 'durations.json'))
    out = Path('/tmp/claude-1000/probe'); out.mkdir(parents=True, exist_ok=True)
    mcp = json.load(open(ROOT / 'assets' / 'mcp-tokenize-prepare.json'))
    async with async_playwright() as p:
        b = await p.chromium.launch(channel='chromium', args=GPU_ARGS)
        ctx = await b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=DSF)
        await ctx.add_init_script(f"window.__data={json.dumps({'mcp': mcp, 'events': [{'name':'AssetTokenized','block':214,'tx':'0xa1b2…c3d4'},{'name':'Listed','block':220,'tx':'0x5e6f…7a8b'}]})}")
        for sid in ids:
            d = durs[sid] + cfg['tail_s']
            page = await ctx.new_page()
            await page.goto(f"file://{HERE}/graphics.html?scene={sid}&dur={d}&legal={cfg['legal'][:60]}", wait_until='load'); await asyncio.sleep(1.2)
            await page.evaluate("(ms)=>document.getAnimations().forEach(a=>{a.pause();a.currentTime=ms})", d * 1000 * frac)
            await asyncio.sleep(.3); await page.screenshot(path=str(out / f'g-{sid}.png')); await page.close()
        await b.close()
asyncio.run(main())
