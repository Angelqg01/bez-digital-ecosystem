import test from 'node:test'
import assert from 'node:assert/strict'
import { pollScan, ScanError } from '../src/utils/pollScan.js'

const noSleep = async () => {}

test('devuelve el escaneo cuando llega a completed, tras sondear', async () => {
  const seq = [{ status: 'analyzing' }, { status: 'analyzing' }, { status: 'completed', analysis: { ok: 1 } }]
  let i = 0
  const r = await pollScan(async () => seq[i++], 'SCAN-1', { sleep: noSleep })
  assert.equal(r.status, 'completed'); assert.equal(i, 3)
})

test('failed y unavailable lanzan ScanError con el motivo del servidor', async () => {
  await assert.rejects(pollScan(async () => ({ status: 'failed', error: 'boom' }), 'S', { sleep: noSleep }), (e) => e instanceof ScanError && e.message === 'boom' && e.status === 'failed')
  await assert.rejects(pollScan(async () => ({ status: 'unavailable' }), 'S', { sleep: noSleep }), (e) => e.status === 'unavailable')
})

test('agota el tiempo si nunca termina', async () => {
  await assert.rejects(pollScan(async () => ({ status: 'analyzing' }), 'S', { sleep: noSleep, intervalMs: 1000, timeoutMs: 0 }), (e) => e.status === 'timeout')
})

test('informa del progreso en cada sondeo', async () => {
  const seen = []
  const seq = [{ status: 'pending' }, { status: 'completed' }]; let i = 0
  await pollScan(async () => seq[i++], 'S', { sleep: noSleep, onProgress: (s) => seen.push(s.status) })
  assert.deepEqual(seen, ['pending', 'completed'])
})
