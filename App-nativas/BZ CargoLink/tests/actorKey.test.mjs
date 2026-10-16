import test from 'node:test'
import assert from 'node:assert/strict'

const store = new Map()
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }
const { authKey, getActorKey, setActorKey, hasActorKey } = await import('../src/services/actorKey.js')

test('sin clave de operador cae al JWT de la plataforma', () => {
  store.clear(); store.set('bezhas-jwt', 'jwt-1')
  assert.equal(authKey(), 'jwt-1'); assert.equal(hasActorKey(), false)
})
test('la clave de operador tiene prioridad sobre el JWT', () => {
  store.clear(); store.set('bezhas-jwt', 'jwt-1'); setActorKey('  bzk_live_abc  ')
  assert.equal(getActorKey(), 'bzk_live_abc'); assert.equal(authKey(), 'bzk_live_abc'); assert.equal(hasActorKey(), true)
})
test('quitar la clave vuelve al JWT', () => {
  store.clear(); store.set('bezhas_access_token', 'jwt-2'); setActorKey('bzk_live_x'); setActorKey('')
  assert.equal(authKey(), 'jwt-2')
})
