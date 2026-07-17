import React, { useState, useEffect, useCallback } from 'react'
import {
  Code2,
  Key,
  Webhook,
  TerminalSquare,
  Globe,
  Ship,
  Truck,
  ShieldCheck,
  Copy,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { useBilling } from '../hooks/useBilling'
import { cargoLinkAdmin } from '../services/cargoLinkApi'
import { cargoGateway } from '../services/cargoGateway'
import { blockchainStatusText } from '../utils/blockchainDisplay'
import PosNetworkPanel from '../components/PosNetworkPanel'
import IotHubPanel from '../components/IotHubPanel'

const SDK_INSTALL_COMMAND = 'pnpm add @bezhas/cargolink-sdk'

const ApiEndpoint = ({ method, path, desc, sectorIcon: SectorIcon, sectorColor, onCopy, onTest }) => (
  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bz-border)', display: 'flex', gap: 16, alignItems: 'center' }}>
    <div style={{ color: sectorColor, background: `${sectorColor}15`, padding: 8, borderRadius: 8 }}>
      <SectorIcon size={20} />
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 900, color: method === 'POST' ? 'var(--bz-secondary)' : '#00f0ff', background: '#202020', padding: '2px 6px', borderRadius: 4 }}>{method}</span>
        <code style={{ fontSize: 12, color: 'var(--bz-text)', fontFamily: 'monospace' }}>{path}</code>
      </div>
      <p style={{ fontSize: 11, color: 'var(--bz-text-muted)' }}>{desc}</p>
    </div>
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        onClick={() => onCopy(path)}
        title="Copiar endpoint"
        style={{ width: 32, height: 32, background: 'var(--bz-surface-container)', border: '1px solid var(--bz-border)', borderRadius: 6, color: 'var(--bz-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Copy size={14} />
      </button>
      <button
        onClick={() => onTest(path)}
        title="Probar endpoint"
        style={{ padding: '0 10px', height: 32, background: 'transparent', border: '1px solid var(--bz-border)', borderRadius: 6, color: 'var(--bz-text)', fontSize: 9, fontWeight: 900 }}
      >
        TEST
      </button>
    </div>
  </div>
)

const WebhookEvent = ({ name, desc, active, onSubscribe }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--bz-border)' }}>
    <div>
      <code style={{ fontSize: 11, color: 'var(--bz-primary)', fontWeight: 800 }}>{name}</code>
      <p style={{ fontSize: 10, color: 'var(--bz-text-muted)', marginTop: 4 }}>{desc}</p>
    </div>
    <button
      onClick={() => onSubscribe(name)}
      style={{ fontSize: 9, padding: '4px 8px', border: '1px solid var(--bz-border)', borderRadius: 12, color: active ? 'var(--bz-secondary)' : 'var(--bz-text-muted)', background: active ? 'rgba(121, 255, 91, 0.08)' : 'transparent', fontWeight: 900 }}
    >
      {active ? 'ACTIVE' : 'SUBSCRIBE'}
    </button>
  </div>
)

const DeveloperIntegration = () => {
  const { bezBalance, plans, loading: billingLoading } = useBilling({ pollMs: 0 })
  const activePlan = plans[0]

  // Real admin keys from backend
  const [adminKeys, setAdminKeys] = useState([])
  const [keysLoading, setKeysLoading] = useState(true)
  const [keysError, setKeysError] = useState(null)

  const loadKeys = useCallback(async () => {
    try {
      const data = await cargoLinkAdmin.listKeys()
      setAdminKeys(data.keys || [])
      setKeysError(null)
    } catch (err) {
      setKeysError(err.message)
    } finally {
      setKeysLoading(false)
    }
  }, [])

  useEffect(() => { loadKeys() }, [loadKeys])

  const primaryKey = adminKeys.find(k => k.status === 'active')
  const displayApiKey = primaryKey?.key_prefix
    ? `${primaryKey.key_prefix}...${primaryKey.id?.slice(-6) || ''}`
    : primaryKey?.id || '—'

  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedSdk, setCopiedSdk] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [selectedEvents, setSelectedEvents] = useState(['ON_CUSTOMS_CLEARED'])
  const [notice, setNotice] = useState('')
  const [sdkResult, setSdkResult] = useState(null)

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      setNotice('No se pudo copiar automáticamente. Selecciona el texto manualmente.')
      return
    }
    if (type === 'key') {
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    } else if (type === 'sdk') {
      setCopiedSdk(true)
      setTimeout(() => setCopiedSdk(false), 2000)
    } else {
      setNotice(`Copiado: ${text}`)
    }
  }

  const saveWebhook = async () => {
    try {
      const response = await cargoGateway.registerWebhook({ url: webhookUrl, events: selectedEvents })
      setNotice(`Webhook activado en Core: ${response.webhook?.id || 'registrado'} para ${selectedEvents.length} evento(s).`)
    } catch (error) {
      setNotice(error.message)
    }
  }

  const subscribeEvent = (eventName) => {
    const nextEvents = selectedEvents.includes(eventName)
      ? selectedEvents.filter(event => event !== eventName)
      : [...selectedEvents, eventName]
    setSelectedEvents(nextEvents)
    setNotice(nextEvents.includes(eventName) ? `${eventName} añadido.` : `${eventName} retirado.`)
  }

  const testEndpoint = async (path) => {
    try {
      const payload = { bUid: 'test', shipmentId: 'test', routeId: 'test' }
      const calls = {
        '/v1/customs/dispatch': () => cargoGateway.dispatchCustoms({ ...payload, manifestId: 'test', standard: 'UBL_2_1' }),
        '/v1/shipping/stowage': () => cargoGateway.validateStowage({ ...payload, cog: { x: 45.8, y: 36.4, total: 1270 } }),
        '/v1/logistics/active-route': () => cargoGateway.getActiveRoute(payload),
        '/v1/audit/fingerprint': () => cargoGateway.auditFingerprint({ ...payload, capture: 'integration-endpoint-test' }),
      }
      const response = await calls[path]()
      setSdkResult(response)
      setNotice(`${path} OK: ${response.blockchain?.event || 'success'} ${blockchainStatusText(response.blockchain)}`)
    } catch (error) {
      setNotice(error.message)
    }
  }

  const runSdkProbe = async () => {
    try {
      const response = await cargoGateway.getActiveRoute({ routeId: 'test' })
      setSdkResult(response)
      setNotice(`Gateway operativo: ${response.blockchain?.event || 'ok'} ${blockchainStatusText(response.blockchain)} ${(response.source || '').toUpperCase()}`)
    } catch (error) {
      setNotice(error.message)
    }
  }

  const balanceDisplay = bezBalance != null ? Number(bezBalance).toFixed(2) : '—'

  return (
    <div style={{ padding: 20, paddingBottom: 100 }}>
      <header style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--bz-primary)', marginBottom: 8 }}>
          <Code2 size={16} />
          <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2 }}>B2B Developer Hub</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Space Grotesk' }}>API & Webhooks</h1>
        <p style={{ fontSize: 12, color: 'var(--bz-text-muted)', marginTop: 4 }}>
          Integra la logística, estiba y aduanas de BeZhas directamente en tu ERP o plataforma de gestión.
        </p>
      </header>

      <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 9, color: 'var(--bz-text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Plan base</p>
          <p style={{ fontSize: 16, fontWeight: 900, color: 'var(--bz-primary)' }}>{activePlan.name}</p>
        </div>
        <div>
          <p style={{ fontSize: 9, color: 'var(--bz-text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Acciones IA</p>
          <p style={{ fontSize: 16, fontWeight: 900 }}>{activePlan.aiActions ? `${activePlan.aiActions.toLocaleString()}/mes` : 'Ilimitadas'}</p>
        </div>
        <div>
          <p style={{ fontSize: 9, color: 'var(--bz-text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Crédito BEZ-Coin</p>
          <p style={{ fontSize: 16, fontWeight: 900, color: 'var(--bz-secondary)' }}>
            {billingLoading ? '...' : `${balanceDisplay} BEZ`}
          </p>
        </div>
        <div>
          <p style={{ fontSize: 9, color: 'var(--bz-text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Claves activas</p>
          <p style={{ fontSize: 16, fontWeight: 900 }}>
            {keysLoading ? '...' : adminKeys.filter(k => k.status === 'active').length}
          </p>
        </div>
        {notice && <p style={{ gridColumn: 'span 2', fontSize: 11, color: 'var(--bz-primary)', borderTop: '1px solid var(--bz-border)', paddingTop: 10 }}>{notice}</p>}
      </div>

      {/* POS network + B-UID transaction feed */}
      <PosNetworkPanel />

      {/* IoT devices + third-party providers + geofences (unified ingestion hub) */}
      <IotHubPanel />

      {/* API Keys — real from backend */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Key size={18} color="var(--bz-primary)" />
          <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase' }}>API Credentials</h3>
        </div>

        {keysError ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <AlertCircle size={14} color="#f59e0b" />
            <p style={{ fontSize: 11, color: '#f59e0b' }}>
              No se pudo cargar las claves del backend. Emite claves desde Operarios.
            </p>
          </div>
        ) : keysLoading ? (
          <p style={{ fontSize: 11, color: 'var(--bz-text-muted)', marginBottom: 12 }}>Cargando claves...</p>
        ) : adminKeys.length === 0 ? (
          <p style={{ fontSize: 11, color: 'var(--bz-text-muted)', marginBottom: 12 }}>
            Sin claves emitidas. Ve a <strong>Operarios</strong> para crear claves role-scoped.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 11, color: 'var(--bz-text-muted)', marginBottom: 12 }}>
              Usa el header <code>Authorization: Bearer [KEY]</code> para autenticar. {adminKeys.filter(k => k.status === 'active').length} clave(s) activa(s).
            </p>
            <div style={{ maxHeight: 200, overflow: 'auto' }}>
              {adminKeys.filter(k => k.status === 'active').map(k => (
                <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--bz-border)' }}>
                  <code style={{ flex: 1, fontSize: 11, color: 'var(--bz-primary)', fontFamily: 'monospace' }}>
                    {k.key_prefix ? `${k.key_prefix}...` : k.id?.slice(0, 16) + '...'}
                  </code>
                  <span style={{ fontSize: 9, color: 'var(--bz-text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>{k.role}</span>
                  <span style={{ fontSize: 9, color: 'var(--bz-text-muted)' }}>{k.bezhas_id}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Webhooks Config */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Webhook size={18} color="#a855f7" />
          <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase' }}>Webhooks (Callbacks)</h3>
        </div>
        <p style={{ fontSize: 11, color: 'var(--bz-text-muted)', marginBottom: 12 }}>
          Endpoint de tu servidor para recibir eventos en tiempo real.
        </p>
        <input
          type="text"
          value={webhookUrl}
          onChange={e => setWebhookUrl(e.target.value)}
          placeholder="https://api.tuempresa.com/webhooks/bezhas"
          style={{ width: '100%', background: '#0e0e0e', border: '1px solid var(--bz-border)', color: 'var(--bz-text)', padding: '12px 16px', fontSize: 12, borderRadius: 8, outline: 'none', marginBottom: 16 }}
        />
        <button onClick={saveWebhook} className="btn btn-primary" style={{ width: '100%', marginBottom: 16 }}>
          ACTIVAR WEBHOOK
        </button>

        <div style={{ borderTop: '1px solid var(--bz-border)' }}>
          <WebhookEvent name="ON_CUSTOMS_CLEARED" desc="Aduana superada. Envía el payload UBL 2.1 firmado." active={selectedEvents.includes('ON_CUSTOMS_CLEARED')} onSubscribe={subscribeEvent} />
          <WebhookEvent name="ON_VESSEL_DEPARTURE" desc="Naviero: El buque ha zarpado. Tracking marítimo iniciado." active={selectedEvents.includes('ON_VESSEL_DEPARTURE')} onSubscribe={subscribeEvent} />
          <WebhookEvent name="ON_STOWAGE_COMPLETE" desc="Naviero: Contenedor estibado. COG y peso registrados." active={selectedEvents.includes('ON_STOWAGE_COMPLETE')} onSubscribe={subscribeEvent} />
          <WebhookEvent name="ON_DELIVERY_PROOF" desc="Transporte/Última Milla: POD generado y firmado por el cliente." active={selectedEvents.includes('ON_DELIVERY_PROOF')} onSubscribe={subscribeEvent} />
          <WebhookEvent name="ON_COLD_CHAIN_BREACH" desc="IoT: Temperatura fuera de rango detectada por sensor vinculado al B-UID." active={selectedEvents.includes('ON_COLD_CHAIN_BREACH')} onSubscribe={subscribeEvent} />
          <WebhookEvent name="ON_SHOCK_ALERT" desc="IoT: Impacto/aceleración excesiva detectada por acelerómetro del contenedor." active={selectedEvents.includes('ON_SHOCK_ALERT')} onSubscribe={subscribeEvent} />
          <WebhookEvent name="ON_TELEMETRY_ALERT" desc="IoT: Brecha leve de telemetría (luz, humedad, geocerca) sin retención de escrow." active={selectedEvents.includes('ON_TELEMETRY_ALERT')} onSubscribe={subscribeEvent} />
          <WebhookEvent name="ON_DISPUTE_OPENED" desc="Oráculo: brecha moderada/crítica — escrow BEZ retenido (DISPUTED) con propuesta de settlement." active={selectedEvents.includes('ON_DISPUTE_OPENED')} onSubscribe={subscribeEvent} />
          <WebhookEvent name="ON_DISPUTE_RESOLVED" desc="Oráculo: disputa resuelta (release / refund / partial) — escrow liquidado." active={selectedEvents.includes('ON_DISPUTE_RESOLVED')} onSubscribe={subscribeEvent} />
        </div>
      </div>

      {/* API Catalog */}
      <div className="card" style={{ padding: 0, marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bz-border)', background: 'var(--bz-surface-container)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase' }}>Catálogo de Endpoints</h3>
        </div>

        <ApiEndpoint
          method="POST"
          path="/v1/customs/dispatch"
          desc="Sincroniza el manifiesto con agencias como ASYCUDA."
          sectorIcon={Globe}
          sectorColor="#00f0ff"
          onCopy={copyToClipboard}
          onTest={testEndpoint}
        />
        <ApiEndpoint
          method="POST"
          path="/v1/shipping/stowage"
          desc="Calcula y valida el centro de gravedad (COG) del contenedor en buque."
          sectorIcon={Ship}
          sectorColor="#3b82f6"
          onCopy={copyToClipboard}
          onTest={testEndpoint}
        />
        <ApiEndpoint
          method="GET"
          path="/v1/logistics/active-route"
          desc="Obtiene coordenadas GPS y métricas de última milla."
          sectorIcon={Truck}
          sectorColor="#f59e0b"
          onCopy={copyToClipboard}
          onTest={testEndpoint}
        />
        <ApiEndpoint
          method="POST"
          path="/v1/audit/fingerprint"
          desc="Registra el hash fotogramétrico de la carga en la L2."
          sectorIcon={ShieldCheck}
          sectorColor="#79ff5b"
          onCopy={copyToClipboard}
          onTest={testEndpoint}
        />
      </div>

      {/* SDK */}
      <div className="card" style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <TerminalSquare size={18} color="#f472b6" />
          <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase' }}>SDK @bezhas/connect</h3>
        </div>
        <p style={{ fontSize: 11, color: 'var(--bz-text-muted)', marginBottom: 16 }}>
          Instala el SDK oficial para manejar firmas criptográficas y WebSockets automáticamente.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', background: '#0e0e0e', border: '1px solid var(--bz-border)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
          <span style={{ padding: '12px 16px', color: '#f472b6', fontFamily: 'monospace', fontSize: 12, flex: 1 }}>
            {SDK_INSTALL_COMMAND}
          </span>
          <button
            onClick={() => copyToClipboard(SDK_INSTALL_COMMAND, 'sdk')}
            style={{ padding: '0 16px', height: '100%', background: 'var(--bz-surface-container)', borderLeft: '1px solid var(--bz-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: copiedSdk ? 'var(--bz-secondary)' : 'var(--bz-primary)' }}
          >
            {copiedSdk ? <CheckCircle2 size={16} /> : <Copy size={16} />}
          </button>
        </div>

        <button onClick={runSdkProbe} className="btn btn-primary" style={{ width: '100%' }}>
          PROBAR GATEWAY /v1/logistics/route
        </button>
        {sdkResult && (
          <div style={{ marginTop: 12, padding: 12, background: '#0e0e0e', border: '1px solid var(--bz-border)', borderRadius: 8 }}>
            <p style={{ fontSize: 10, color: 'var(--bz-text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Respuesta Gateway</p>
            <code style={{ display: 'block', marginTop: 6, fontSize: 10, color: 'var(--bz-primary)', wordBreak: 'break-all' }}>
              {sdkResult.blockchain?.event || 'OK'} / {blockchainStatusText(sdkResult.blockchain)} / {(sdkResult.source || '').toUpperCase()}
            </code>
            <p style={{ marginTop: 8, fontSize: 10, color: sdkResult.realBlockchain?.ok ? 'var(--bz-secondary)' : 'var(--bz-text-muted)' }}>
              Blockchain real: {sdkResult.realBlockchain?.ok ? sdkResult.realBlockchain.txHash : (sdkResult.blockchain?.nextAction || sdkResult.realBlockchain?.reason || 'disabled')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default DeveloperIntegration
