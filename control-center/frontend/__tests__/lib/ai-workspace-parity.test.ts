/**
 * Paridad con la copia del chat para las SubApps (App-nativas/_shared/ai-chat/ai-workspace.js): los mismos casos de
 * Markdown tienen que dar EXACTAMENTE la misma salida. Si se cambia el renderizado aquí, hay que cambiar el otro (y
 * regenerar App-nativas/_shared/__tests__/fixtures/chat-markdown.json).
 */
import fs from 'fs';
import path from 'path';
import { renderChatMarkdown } from '@/lib/ai-workspace';

const fixture = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', '..', '..', '..', 'App-nativas', '_shared', '__tests__', 'fixtures', 'chat-markdown.json'), 'utf8'));

describe('renderChatMarkdown: paridad con las SubApps', () => {
    it.each(fixture.casos.map((c: { nombre: string; entrada: string; esperado: string }) => [c.nombre, c.entrada, c.esperado]) as [string, string, string][])('%s', (_n: string, entrada: string, esperado: string) => {
        expect(renderChatMarkdown(entrada)).toBe(esperado);
    });
});
