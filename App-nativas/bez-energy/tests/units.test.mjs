import test from 'node:test'
import assert from 'node:assert/strict'
import { fmtPower, fmtGridMw, fmtEur, fmtPct } from '../src/utils/units.js'

test('kW se queda en kW por debajo de 1000 y pasa a MW/GW después', () => {
  assert.equal(fmtPower(12.67), '12.67 kW')
  assert.equal(fmtPower(999.99), '999.99 kW')
  assert.equal(fmtPower(1250), '1.25 MW')
  assert.equal(fmtPower(33.99), '33.99 kW')          // el bug: esto se mostraba como «33.99 MW»
  assert.equal(fmtPower(-1500), '-1.50 MW')
  assert.equal(fmtPower(2_500_000), '2.50 GW')
})
test('sin dato no se inventa un cero', () => {
  for (const v of [null, undefined, '', NaN, 'x']) assert.equal(fmtPower(v), '—')
  assert.equal(fmtPower(0), '0 kW')
})
test('demanda de la red en MW/GW', () => {
  assert.equal(fmtGridMw(31485), '31.5 GW'); assert.equal(fmtGridMw(950), '950 MW'); assert.equal(fmtGridMw(null), '—')
})
test('euros y porcentajes', () => {
  assert.equal(fmtEur(209), '209.00 €/MWh'); assert.equal(fmtEur(null), '—')
  assert.equal(fmtPct(44, 0), '44 %'); assert.equal(fmtPct(undefined), '—')
})
