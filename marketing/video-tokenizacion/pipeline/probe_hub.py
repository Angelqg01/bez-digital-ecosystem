"""Sondeo (no graba): recorre el Hub hasta el asistente con la wallet simulada y guarda capturas para comprobar los selectores."""
import asyncio, sys
from pathlib import Path
from playwright.async_api import async_playwright
from common import *

async def main():
    out = Path('/tmp/claude-1000/probe'); out.mkdir(exist_ok=True, parents=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(channel='chromium', args=GPU_ARGS)
        ctx = await b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=DSF)
        await ctx.add_init_script(init_script('emisor'))
        page = await ctx.new_page()
        page.on('console', lambda m: print('console', m.type, m.text[:140]) if m.type == 'error' else None)
        await page.goto(f'{HUB}/rwa', wait_until='domcontentloaded'); await asyncio.sleep(5)
        await page.keyboard.press('Escape')
        await page.evaluate("""()=>{[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='No, gracias')?.click();
          document.querySelector('[aria-label*="errar"]')?.click()}"""); await asyncio.sleep(1)
        await page.screenshot(path=str(out / '1-rwa.png'))
        # conectar wagmi
        await page.get_by_text('Conectar o Iniciar Sesión').first.click(); await asyncio.sleep(1.5)
        await page.get_by_text('Conectar Wallet').first.click(); await asyncio.sleep(1.5)
        await page.screenshot(path=str(out / '2-modal.png'))
        await page.get_by_text('MetaMask').first.click(); await asyncio.sleep(3)
        await page.screenshot(path=str(out / '3-conectado.png'))
        await page.get_by_role('button', name='Tokenizar Activo').click(); await asyncio.sleep(1.5)
        await page.screenshot(path=str(out / '4-asistente.png'))
        print('ok')
        await b.close()
asyncio.run(main())
