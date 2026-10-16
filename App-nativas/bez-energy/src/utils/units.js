/**
 * Unidades de potencia y energía. El panel mostraba kW con la etiqueta «MW» (×1000 de error) en el flujo y en SCADA:
 * para un operador de red eso es un dato falso. Aquí hay un único formateador.
 */

/** kW → «950 kW» o «1.25 MW» (a partir de 1000 kW). `null`/NaN → «—». */
export function fmtPower(kw, { digits = 2 } = {}) {
  const v = Number(kw)
  if (kw === null || kw === undefined || kw === '' || !Number.isFinite(v)) return '—'
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(digits)} GW`
  if (abs >= 1000) return `${(v / 1000).toFixed(digits)} MW`
  return `${Number(v.toFixed(digits))} kW`
}

/** MW (demanda de la red) → «31.5 GW» o «950 MW». */
export function fmtGridMw(mw) {
  const v = Number(mw)
  if (mw === null || mw === undefined || !Number.isFinite(v)) return '—'
  return Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)} GW` : `${Math.round(v)} MW`
}

export const fmtEur = (v) => (Number.isFinite(Number(v)) && v !== null ? `${Number(v).toFixed(2)} €/MWh` : '—')
export const fmtPct = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== undefined ? `${Number(v).toFixed(d)} %` : '—')
