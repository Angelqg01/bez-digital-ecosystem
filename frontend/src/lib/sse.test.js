import { describe, expect, test, vi } from 'vitest';
import { createSseParser } from './sse';

const run = (chunks) => {
    const events = [];
    const push = createSseParser((e) => events.push(e));
    chunks.forEach(push);
    return events;
};

describe('createSseParser', () => {
    test('parsea eventos completos con nombre y datos JSON', () => {
        expect(run(['event: meta\ndata: {"a":1}\n\nevent: delta\ndata: {"text":"hola"}\n\n'])).toEqual([
            { event: 'meta', data: { a: 1 } },
            { event: 'delta', data: { text: 'hola' } },
        ]);
    });

    test('junta fragmentos partidos en cualquier punto', () => {
        const full = 'event: delta\ndata: {"text":"ab"}\n\n';
        for (let i = 1; i < full.length; i++) {
            expect(run([full.slice(0, i), full.slice(i)])).toEqual([{ event: 'delta', data: { text: 'ab' } }]);
        }
    });

    test('sin nombre de evento usa "message"', () => {
        expect(run(['data: {"x":1}\n\n'])).toEqual([{ event: 'message', data: { x: 1 } }]);
    });

    test('ignora JSON inválido, cargas que no son objetos y bloques sin datos', () => {
        expect(run(['event: a\ndata: {roto\n\n', 'event: b\ndata: 42\n\n', 'event: c\ndata: [1,2]\n\n', 'event: d\n\n', 'data: "texto"\n\n'])).toEqual([]);
    });

    test('un evento incompleto no se emite hasta recibir el separador', () => {
        const cb = vi.fn();
        const push = createSseParser(cb);
        push('event: meta\ndata: {"a":1}\n');
        expect(cb).not.toHaveBeenCalled();
        push('\n');
        expect(cb).toHaveBeenCalledTimes(1);
    });

    test('datos en varias líneas se unen antes de parsear', () => {
        expect(run(['event: x\ndata: {"a":\ndata: 1}\n\n'])).toEqual([{ event: 'x', data: { a: 1 } }]);
    });
});
