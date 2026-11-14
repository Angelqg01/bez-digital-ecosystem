"""Sondeo del asistente de tokenización completo (no graba): ¿llega a crear el activo en la cadena de demostración?"""
import asyncio
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
        page.on('console', lambda m: print('console', m.type, m.text[:160]) if m.type == 'error' else None)
        await page.goto(f'{HUB}/rwa', wait_until='domcontentloaded'); await asyncio.sleep(5)
        await page.keyboard.press('Escape')
        await page.evaluate("""()=>{[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='No, gracias')?.click();
          document.querySelector('[aria-label*="errar"]')?.click()}"""); await asyncio.sleep(1)
        await page.get_by_role('button', name='Tokenizar Activo').click(); await asyncio.sleep(1.5)
        await page.screenshot(path=str(out / 'w1.png'))
        await page.get_by_text('Inmueble', exact=True).last.click(); await asyncio.sleep(.5)
        await page.get_by_role('button', name='Siguiente').click(); await asyncio.sleep(1)
        await page.get_by_placeholder('Ej: Apartamento Luxury Penthouse').fill('Penthouse Madrid Centro')
        await page.get_by_placeholder('1000000').fill('1200000')
        await page.get_by_placeholder('Calle, Ciudad, País').fill('Calle Mayor 1, Madrid, España')
        await page.get_by_placeholder('150').fill('180')
        await page.screenshot(path=str(out / 'w2.png'))
        await page.get_by_role('button', name='Siguiente').click(); await asyncio.sleep(1.5)
        await page.get_by_placeholder('1000').fill('10000'); await asyncio.sleep(.5)
        await page.screenshot(path=str(out / 'w3a.png'))
        await page.get_by_test_id('usar-precio-sugerido').click(); await asyncio.sleep(.3)
        await page.get_by_placeholder('8.5').fill('5'); await asyncio.sleep(.5)
        await page.screenshot(path=str(out / 'w3b.png'))
        await page.get_by_role('button', name='Siguiente').click(); await asyncio.sleep(1.5)
        await page.screenshot(path=str(out / 'w4a.png'))
        await page.set_input_files('#legal-upload', {'name': 'escritura-penthouse.pdf', 'mimeType': 'application/pdf', 'buffer': b'%PDF-1.4 demo'}); await asyncio.sleep(1.5)
        await page.screenshot(path=str(out / 'w4b.png'))
        await asyncio.sleep(2)
        info = await page.evaluate("[...document.querySelectorAll('button')].filter(b=>b.innerText.includes('Tokenizar Activo')).map(b=>b.disabled)")
        docs = await page.evaluate("[...document.querySelectorAll('p,span')].map(e=>e.innerText).filter(t=>/pdf|CID|Qm/i.test(t)).slice(0,6)")
        print(info, docs)
        await page.get_by_role('button', name='Tokenizar Activo').last.click(); await asyncio.sleep(10)
        await page.screenshot(path=str(out / 'w5.png'))
        print('assetCount:', cast('call', demo_env()['FACT'], 'assetCount()(uint256)'))
        await b.close()
asyncio.run(main())
