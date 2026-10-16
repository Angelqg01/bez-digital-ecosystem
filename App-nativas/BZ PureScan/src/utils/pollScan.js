/**
 * Sondeo de un escaneo asíncrono (POST /analyze → 202 → GET /scans/:ref hasta un estado final).
 * Puro e inyectable (fetchScan, sleep) para poder probarlo sin red ni temporizadores reales.
 */
export const FINAL_STATUSES = ['completed', 'failed', 'unavailable']

export class ScanError extends Error {
  constructor(message, { status, scanRef } = {}) {
    super(message)
    this.name = 'ScanError'
    this.status = status
    this.scanRef = scanRef
  }
}

export async function pollScan(fetchScan, scanRef, { intervalMs = 2000, timeoutMs = 90000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), onProgress } = {}) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const scan = await fetchScan(scanRef)
    onProgress?.(scan)
    if (scan.status === 'completed') return scan
    if (FINAL_STATUSES.includes(scan.status)) {
      throw new ScanError(scan.error || `El análisis terminó con estado «${scan.status}»`, { status: scan.status, scanRef })
    }
    if (Date.now() + intervalMs > deadline) {
      throw new ScanError('El análisis está tardando demasiado; reinténtalo en unos minutos', { status: 'timeout', scanRef })
    }
    await sleep(intervalMs)
  }
}
