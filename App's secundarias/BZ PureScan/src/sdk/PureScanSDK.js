/**
 * BeZhas PureScan SDK v2.0
 * Allows enterprise users to integrate the BZ PureScan widget
 * into their own preconfigured platforms.
 */

// ─── FIX #10: Constantes de eventos para evitar typos silenciosos ───────────
const WIDGET_EVENTS = Object.freeze({
  SCAN_COMPLETE: 'SCAN_COMPLETE',
  ANOMALY_DETECTED: 'ANOMALY_DETECTED',
  CREDIT_DEPLETED: 'CREDIT_DEPLETED',
  ERROR: 'ERROR',
});

const WIDGET_ORIGIN = 'https://app.bez.digital';
const WIDGET_URL = 'https://app.bez.digital/purescan/widget';
const DEFAULT_TIMEOUT_MS = 15_000; // 15 segundos

// ─── Helper: fetch con timeout ────────────────────────────────────────────────
async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

class PureScanSDK {
  // ─── FIX #10: Exponer las constantes como propiedad estática ─────────────
  static EVENTS = WIDGET_EVENTS;

  constructor(options = {}) {
    // ─── FIX #9: Validación explícita de parámetros obligatorios ─────────
    if (!options.apiKey) {
      console.warn('[PureScan] No API Key provided. Operating in limited mode.');
    }
    if (!options.merchantId) {
      console.warn('[PureScan] No merchantId provided. Widget mode may fail.');
    }

    this.apiKey = options.apiKey ?? null;
    this.merchantId = options.merchantId ?? null;
    this.containerId = options.containerId ?? 'purescan-container';
    this.theme = ['dark', 'light'].includes(options.theme) ? options.theme : 'dark';
    this.apiUrl = options.apiUrl ?? 'https://api.bez.digital/purescan/v1';
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    // ─── FIX #5: Añadir callback onError ────────────────────────────────
    this.onScanComplete = options.onScanComplete ?? (() => { });
    this.onAnomalyDetected = options.onAnomalyDetected ?? (() => { });
    this.onError = options.onError ?? ((err) => console.error('[PureScan] Error:', err));

    // Referencia al listener para poder eliminarlo después
    this._boundMessageHandler = this._handleWidgetMessages.bind(this);
    this._iframe = null;
    this._initialized = false;
  }

  /**
   * Inicializa el widget y lo monta en el contenedor especificado.
   * @returns {Promise<void>}
   */
  async init() {
    if (this._initialized) {
      console.warn('[PureScan] SDK already initialized. Call destroy() first.');
      return;
    }

    const container = document.getElementById(this.containerId);
    if (!container) {
      const msg = `Container "#${this.containerId}" not found.`;
      this.onError(new Error(msg));
      return;
    }

    try {
      await this._verifyCredentials();
    } catch (e) {
      this.onError(e);
      container.innerHTML = `<p style="color:red;font-family:sans-serif;">[PureScan] ${e.message}</p>`;
      return;
    }

    // ─── FIX #3: iframe con sandbox restrictivo y política de referrer ───
    this._iframe = document.createElement('iframe');

    // ─── FIX #1: No pasar merchantId ni datos sensibles en la URL ─────────
    // Se envían por postMessage tras el handshake del widget (más seguro)
    this._iframe.src = WIDGET_URL;

    this._iframe.setAttribute('sandbox',
      'allow-scripts allow-same-origin allow-forms'
    );
    this._iframe.setAttribute('referrerpolicy', 'no-referrer');
    this._iframe.setAttribute('loading', 'lazy');
    this._iframe.setAttribute('title', 'BeZhas PureScan Widget');

    Object.assign(this._iframe.style, {
      width: '100%',
      height: '100%',
      border: 'none',
      borderRadius: '12px',
      display: 'block',
    });

    container.innerHTML = '';
    container.appendChild(this._iframe);

    // ─── FIX #2: Guardar referencia al listener para poder eliminarlo ────
    window.addEventListener('message', this._boundMessageHandler);

    this._initialized = true;
    console.info('[PureScan] ✅ SDK initialized.');
  }

  /**
   * Limpia el DOM, elimina listeners y destruye el SDK.
   * Llamar siempre en el unmount de tu componente.
   */
  destroy() {
    window.removeEventListener('message', this._boundMessageHandler);

    const container = document.getElementById(this.containerId);
    if (container) container.innerHTML = '';

    this._iframe = null;
    this._initialized = false;
    console.info('[PureScan] SDK destroyed.');
  }

  /**
   * Analiza una imagen directamente (Headless Mode).
   * Útil cuando la empresa quiere usar su propia UI.
   * @param {File|Blob} imageFile
   * @param {object} [opts]
   * @param {number} [opts.retries=2]   — número de reintentos ante fallos de red
   * @param {number} [opts.timeoutMs]   — timeout individual por intento
   * @returns {Promise<object>}
   */
  async analyzeImage(imageFile, { retries = 2, timeoutMs = this.timeoutMs } = {}) {
    if (!this.apiKey) throw new Error('[PureScan] API Key required for headless analysis.');
    if (!(imageFile instanceof File) && !(imageFile instanceof Blob)) {
      throw new TypeError('[PureScan] imageFile must be a File or Blob instance.');
    }

    const formData = new FormData();
    formData.append('image', imageFile);

    let lastError;

    // ─── FIX #6: Timeout + reintentos con backoff exponencial ────────────
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetchWithTimeout(
          `${this.apiUrl}/analyze`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${this.apiKey}` },
            body: formData,
          },
          timeoutMs
        );

        // ─── FIX #7: Errores HTTP con status y body legible ─────────────
        if (!res.ok) {
          let detail = '';
          try { detail = (await res.json()).message ?? ''; } catch { /* ignore */ }
          throw new Error(`[PureScan] HTTP ${res.status}: ${detail || res.statusText}`);
        }

        const data = await res.json();

        if (data.anomaly) this.onAnomalyDetected(data);
        this.onScanComplete(data);
        return data;

      } catch (err) {
        lastError = err;
        const isAbort = err.name === 'AbortError';
        const isRetryable = isAbort || err.message.includes('HTTP 5');

        if (!isRetryable || attempt === retries) break;

        const delay = 500 * 2 ** attempt; // 500ms → 1000ms → 2000ms
        console.warn(`[PureScan] Attempt ${attempt + 1} failed. Retrying in ${delay}ms…`);
        await new Promise(r => setTimeout(r, delay));
      }
    }

    this.onError(lastError);
    throw lastError;
  }

  // ─── Privados ─────────────────────────────────────────────────────────────

  /**
   * Gestiona mensajes postMessage del widget embebido.
   * @param {MessageEvent} event
   */
  _handleWidgetMessages(event) {
    // Verificar origen (ya existía — mantener)
    if (event.origin !== WIDGET_ORIGIN) return;

    // ─── FIX #4: Validar estructura de event.data ────────────────────────
    if (!event.data || typeof event.data.type !== 'string') return;

    const { type, payload } = event.data;

    switch (type) {
      case WIDGET_EVENTS.SCAN_COMPLETE:
        this.onScanComplete(payload);
        break;

      case WIDGET_EVENTS.ANOMALY_DETECTED:
        this.onAnomalyDetected(payload);
        break;

      case WIDGET_EVENTS.CREDIT_DEPLETED:
        console.warn('[PureScan] Credits depleted. Please recharge.');
        this.onError(new Error('Credits depleted'));
        break;

      case WIDGET_EVENTS.ERROR:
        this.onError(new Error(payload?.message ?? 'Unknown widget error'));
        break;

      // FIX #4: Eventos desconocidos se ignoran silenciosamente
      default:
        break;
    }

    // ─── FIX #1: Tras recibir el handshake del widget, enviar config ─────
    // (asumiendo que el widget emite 'READY' como primer evento)
    if (type === 'READY' && this._iframe?.contentWindow) {
      this._iframe.contentWindow.postMessage(
        {
          type: 'INIT_CONFIG',
          payload: {
            theme: this.theme,
            merchantId: this.merchantId,
            // apiKey NUNCA se envía al iframe — permanece en el host
          },
        },
        WIDGET_ORIGIN  // targetOrigin restringido
      );
    }
  }

  /**
   * Verifica las credenciales contra la API real.
   * @returns {Promise<void>}
   */
  async _verifyCredentials() {
    if (!this.apiKey) return; // Modo limitado — no verificar

    // ─── FIX #8: Llamada real a la API en lugar del mock de testing ──────
    const res = await fetchWithTimeout(
      `${this.apiUrl}/auth/verify`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ merchantId: this.merchantId }),
      },
      8_000
    );

    if (!res.ok) {
      let msg = 'Invalid credentials.';
      try { msg = (await res.json()).message ?? msg; } catch { /* ignore */ }
      throw new Error(`[PureScan] Auth failed (${res.status}): ${msg}`);
    }
  }
}

export default PureScanSDK;
export { WIDGET_EVENTS };