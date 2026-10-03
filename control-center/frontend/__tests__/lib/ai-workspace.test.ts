/**
 * @jest-environment node
 */
import { classifyLink, createSseParser, renderChatMarkdown } from '@/lib/ai-workspace';

describe('classifyLink', () => {
    it.each([
        ['/token/buy', 'internal'],
        ['https://www.bezhas.com/mcp', 'external'],
        ['https://bezhas.com', 'external'],
        ['https://mcp.bezhas.com/mcp', 'external'],
        ['https://evil.example/phish', 'blocked'],
        ['//evil.example', 'blocked'],
        ['javascript:alert(1)', 'blocked'],
        ['https://user:pass@www.bezhas.com', 'blocked'],
        ['https://www.bezhas.com.evil.io', 'blocked'],
        ['/../etc/passwd', 'blocked'],
    ])('%s → %s', (href, tipo) => {
        expect(classifyLink(href).type).toBe(tipo);
    });
});

describe('renderChatMarkdown', () => {
    it('escapa todo el HTML del modelo', () => {
        const html = renderChatMarkdown('<script>alert(1)</script><img src=x onerror=alert(1)>');
        expect(html).not.toMatch(/<script|<img/);
        expect(html).toContain('&lt;script&gt;');
    });

    it('pinta como enlace solo rutas internas y bezhas.com; el resto queda como texto', () => {
        const html = renderChatMarkdown('[comprar](/token/buy) [web](https://www.bezhas.com) [cebo](https://evil.example)');
        expect(html).toContain('<a href="/token/buy">comprar</a>');
        expect(html).toContain('href="https://www.bezhas.com/"');
        expect(html).not.toContain('evil.example');
        expect(html).toContain('cebo');
    });

    it('formato básico: listas, negrita y código', () => {
        const html = renderChatMarkdown('**Planes**\n\n- Starter\n- Business\n\n```\nx < y\n```');
        expect(html).toContain('<strong>Planes</strong>');
        expect(html).toContain('<ul><li>Starter</li><li>Business</li></ul>');
        expect(html).toContain('<pre><code>x &lt; y</code></pre>');
    });
});

describe('createSseParser', () => {
    it('reconstruye eventos partidos entre trozos', () => {
        const eventos: { event: string; data: any }[] = [];
        const parse = createSseParser((e) => eventos.push(e));
        parse('event: meta\ndata: {"conversationId":"abc');
        parse('defgh"}\n\nevent: delta\ndata: {"text":"Hola"}\n\n');
        parse('event: done\ndata: {}\n\n');
        expect(eventos).toEqual([
            { event: 'meta', data: { conversationId: 'abcdefgh' } },
            { event: 'delta', data: { text: 'Hola' } },
            { event: 'done', data: {} },
        ]);
    });
});
