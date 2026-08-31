import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderTourHTML, ICONS } from '../src/engine.js';

const baseScenes = [
  { label: 'Intro', kicker: 'App', title: 'Hola {{ico:anchor}}', body: 'Cuerpo', tags: [['c', 'Uno'], ['g', 'Dos']], visual: '<div class="phone">{{ico:map}}</div>' },
  { label: 'Dos', kicker: 'Tab', title: 'Segunda', body: 'Cuerpo 2', tags: [], visual: '<div>{{ico:radio}}</div>' },
];

test('renderTourHTML produces a self-contained HTML document', () => {
  const html = renderTourHTML({ appName: 'Test App', scenes: baseScenes });
  assert.ok(html.startsWith('<!DOCTYPE html>'), 'starts with doctype');
  assert.ok(html.includes('<title>'), 'has a title');
  assert.ok(html.includes('Test App'), 'includes appName');
  // No external resources (CSP-safe): no http(s) links except rel/ns-ish; no src=http
  assert.ok(!/src=["']https?:/i.test(html), 'no external script/img src');
  assert.ok(!/<link[^>]+href=["']https?:/i.test(html), 'no external stylesheet');
});

test('icon tokens are resolved to inline SVG at build time', () => {
  const html = renderTourHTML({ appName: 'X', scenes: baseScenes });
  assert.ok(!html.includes('{{ico:'), 'no unresolved icon tokens remain');
  // Scenes are embedded via JSON.stringify (quotes escaped), so assert on
  // quote-free fragments of the icon path data.
  assert.ok(html.includes('M12 22V8'), 'anchor icon path injected');
  assert.ok(html.includes('M9 3 3 6v15'), 'map icon path injected');
});

test('all scenes are embedded and step count is correct', () => {
  const html = renderTourHTML({ appName: 'X', scenes: baseScenes });
  assert.ok(html.includes('1 / 2'), 'step pill shows total');
  assert.ok(html.includes('"label":"Intro"'), 'scene 1 embedded');
  assert.ok(html.includes('"label":"Dos"'), 'scene 2 embedded');
});

test('theme overrides are written as CSS variables', () => {
  const html = renderTourHTML({ appName: 'X', scenes: baseScenes, theme: { primary: '#ff00aa' } });
  assert.ok(html.includes('--primary: #ff00aa;'), 'custom primary applied');
  assert.ok(html.includes('--secondary:'), 'defaults still present');
});

test('custom durationMs is honored', () => {
  const html = renderTourHTML({ appName: 'X', scenes: baseScenes, durationMs: 4000 });
  assert.ok(html.includes('const DUR = 4000;'), 'duration injected');
});

test('custom icons merge into the set', () => {
  // quote-free marker survives JSON embedding
  const html = renderTourHTML({ appName: 'X', icons: { star: '<path d=STARMARK/>' },
    scenes: [{ label: 'a', kicker: 'k', title: 't', body: 'b', tags: [], visual: '{{ico:star}}' }] });
  assert.ok(html.includes('d=STARMARK'), 'custom icon injected');
  assert.ok(!html.includes('{{ico:star}}'), 'custom token resolved');
});

test('scene label with & is not HTML-escaped (rendered via textContent)', () => {
  const html = renderTourHTML({ appName: 'X', scenes: [
    { label: 'Geocercas & Terceros', kicker: 'k', title: 't', body: 'b', tags: [], visual: 'v' },
  ] });
  assert.ok(html.includes('"label":"Geocercas & Terceros"'), 'label stored raw');
  assert.ok(!html.includes('Geocercas &amp; Terceros'), 'label not double-escaped');
});

test('empty scenes throws', () => {
  assert.throws(() => renderTourHTML({ appName: 'X', scenes: [] }), /non-empty array/);
});

test('HTML special chars in appName are escaped', () => {
  const html = renderTourHTML({ appName: '<script>x</script>', scenes: baseScenes });
  assert.ok(!html.includes('<script>x</script>'), 'appName not injected raw');
  assert.ok(html.includes('&lt;script&gt;'), 'appName escaped');
});
