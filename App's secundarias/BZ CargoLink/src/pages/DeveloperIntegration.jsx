import React, { useState } from 'react'
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
  Download
} from 'lucide-react'
import { bezhasPlatform } from '../services/bezhasPlatform'
import { usePlatformState } from '../hooks/usePlatformState'
import { cargoGateway } from '../services/cargoGateway'
import { CargoLinkSdk } from '../sdk/cargolink-sdk'
import { blockchainStatusText } from '../utils/blockchainDisplay'
import PosNetworkPanel from '../components/PosNetworkPanel'

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
  const { platformState } = usePlatformState()
  const activePlan = bezhasPlatform.plans[platformState.planId] || bezhasPlatform.plans.freemium
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedSdk, setCopiedSdk] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState(platformState.webhookUrl || '')
  const [selectedEvents, setSelectedEvents] = useState(() =>
    (platformState.webhookEvents || ['ON_CUSTOMS_CLEARED']).slice(0, activePlan.webhookLimit)
  )
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
      const response = await cargoGateway.registerWebhook({ url: webhookUrl, events: selectedEvents }, platformState.apiKey)
      bezhasPlatform.registerWebhook(webhookUrl, selectedEvents)
      setNotice(`Webhook activado en Core: ${response.webhook?.id || 'registrado'} para ${selectedEvents.length} evento(s).`)
    } catch (error) {
      setNotice(error.message)
    }
  }

  const subscribeEvent = (eventName) => {
    if (!selectedEvents.includes(eventName) && selectedEvents.length >= activePlan.webhookLimit) {
      setNotice(`El plan ${activePlan.name} permite ${activePlan.webhookLimit} evento(s). Sube de plan para activar más webhooks.`)
      return
    }
    const nextEvents = selectedEvents.includes(eventName)
      ? selectedEvents.filter(event => event !== eventName)
      : [...selectedEvents, eventName]
    setSelectedEvents(nextEvents)
    setNotice(nextEvents.includes(eventName) ? `${eventName} añadido a la suscripción.` : `${eventName} retirado de la suscripción.`)
  }

  const rotateKey = () => {
    bezhasPlatform.rotateApiKey()
    setNotice('API key rotada. Las nuevas llamadas SDK deben usar la clave actual.')
  }

  const runSdkProbe = async () => {
    try {
      const sdk = new CargoLinkSdk({ apiKey: platformState.apiKey })
      const response = await sdk.getActiveRoute({ routeId: 'TRX-9921-X' })
      setSdkResult(response)
      setNotice(`Gateway operativo: ${response.blockchain.event} ${blockchainStatusText(response.blockchain)} ${response.source.toUpperCase()}`)
    } catch (error) {
      setNotice(error.message)
    }
  }

  const testEndpoint = async (path) => {
    try {
      const payload = { bUid: 'BZ-LOG-ES-17148', shipmentId: 'TRX-9921-X', routeId: 'TRX-9921-X' }
      const calls = {
        '/v1/customs/dispatch': () => cargoGateway.dispatchCustoms({ ...payload, manifestId: 'TRX-9921-X', standard: 'UBL_2_1' }, platformState.apiKey),
        '/v1/shipping/stowage': () => cargoGateway.validateStowage({ ...payload, cog: { x: 45.8, y: 36.4, total: 1270 } }, platformState.apiKey),
        '/v1/logistics/active-route': () => cargoGateway.getActiveRoute(payload, platformState.apiKey),
        '/v1/audit/fingerprint': () => cargoGateway.auditFingerprint({ ...payload, capture: 'integration-endpoint-test' }, platformState.apiKey),
      }
      const response = await calls[path]()
      setSdkResult(response)
      setNotice(`${path} OK: ${response.blockchain.event} ${blockchainStatusText(response.blockchain)}`)
    } catch (error) {
      setNotice(error.message)
    }
  }

  const downloadSdkSnippet = (language) => {
    const snippets = {
      python: `from bezhas_cargolink import CargoLinkClient\n\nclient = CargoLinkClient(api_key=\"${platformState.apiKey}\")\nroute = client.get_active_route(route_id=\"TRX-9921-X\")\nprint(route.blockchain.tx_hash)\n`,
      java: `CargoLinkClient client = new CargoLinkClient(\"${platformState.apiKey}\");\nActiveRoute route = client.getActiveRoute(\"TRX-9921-X\");\nSystem.out.println(route.getBlockchain().getTxHash());\n`,
    }
    const blob = new Blob([snippets[language]], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = language === 'python' ? 'bezhas-cargolink-example.py' : 'BezhasCargoLinkExample.java'
    link.click()
    URL.revokeObjectURL(url)
    setNotice(`${language === 'python' ? 'Python' : 'Java'} SDK snippet generado.`)
  }

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
          <p style={{ fontSize: 9, color: 'var(--bz-text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Plan activo</p>
          <p style={{ fontSize: 16, fontWeight: 900, color: 'var(--bz-primary)' }}>{activePlan.name}</p>
        </div>
        <div>
          <p style={{ fontSize: 9, color: 'var(--bz-text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Cuota freemium</p>
          <p style={{ fontSize: 16, fontWeight: 900 }}>{platformState.freeQuotaRemaining} llamadas hoy</p>
        </div>
        <div>
          <p style={{ fontSize: 9, color: 'var(--bz-text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Crédito BEZ-Coin</p>
          <p style={{ fontSize: 16, fontWeight: 900, color: 'var(--bz-secondary)' }}>{platformState.bezBalance.toFixed(2)} BEZ</p>
        </div>
        <div>
          <p style={{ fontSize: 9, color: 'var(--bz-text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Sectores</p>
          <p style={{ fontSize: 11, fontWeight: 800 }}>{platformState.enabledSectors.join(', ')}</p>
        </div>
        {notice && <p style={{ gridColumn: 'span 2', fontSize: 11, color: 'var(--bz-primary)', borderTop: '1px solid var(--bz-border)', paddingTop: 10 }}>{notice}</p>}
      </div>

      {/* POS network + B-UID transaction feed */}
      <PosNetworkPanel apiKey={platformState.apiKey} />

      {/* API Keys */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Key size={18} color="var(--bz-primary)" />
          <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase' }}>API Credentials</h3>
        </div>
        <p style={{ fontSize: 11, color: 'var(--bz-text-muted)', marginBottom: 12 }}>
          Usa esta clave en el header `Authorization: Bearer [KEY]` para autenticar las peticiones al Oracle y L2.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', background: '#0e0e0e', border: '1px solid var(--bz-border)', borderRadius: 8, overflow: 'hidden' }}>
          <input 
            type="password" 
            value={platformState.apiKey} 
            readOnly 
            style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--bz-text)', padding: '12px 16px', fontSize: 12, fontFamily: 'monospace', outline: 'none' }}
          />
          <button 
            onClick={() => copyToClipboard(platformState.apiKey, 'key')}
            style={{ padding: '0 16px', height: '100%', background: 'var(--bz-surface-container)', borderLeft: '1px solid var(--bz-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: copiedKey ? 'var(--bz-secondary)' : 'var(--bz-primary)' }}
          >
            {copiedKey ? <CheckCircle2 size={16} /> : <Copy size={16} />}
          </button>
        </div>
        <button onClick={rotateKey} style={{ marginTop: 12, width: '100%', padding: '10px', background: 'transparent', border: '1px solid var(--bz-border)', borderRadius: 8, fontSize: 10, fontWeight: 800, color: 'var(--bz-text)' }}>
          ROTAR API KEY
        </button>
      </div>

      {/* Webhooks Config */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Webhook size={18} color="#a855f7" />
          <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase' }}>Webhooks (Callbacks)</h3>
        </div>
        <p style={{ fontSize: 11, color: 'var(--bz-text-muted)', marginBottom: 12 }}>
          Endpoint de tu servidor para recibir eventos en tiempo real. Tu plan permite {activePlan.webhookLimit} evento(s).
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
        </div>
      </div>

      {/* API Catalog */}
      <div className="card" style={{ padding: 0, marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bz-border)', background: 'var(--bz-surface-container)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase' }}>Catálogo de Endpoints</h3>
        </div>
        
        {/* Aduanas */}
        <ApiEndpoint 
          method="POST" 
          path="/v1/customs/dispatch" 
          desc="Sincroniza el manifiesto con agencias como ASYCUDA." 
          sectorIcon={Globe} 
          sectorColor="#00f0ff" 
          onCopy={copyToClipboard}
          onTest={testEndpoint}
        />
        
        {/* Naviero / Estiba */}
        <ApiEndpoint 
          method="POST" 
          path="/v1/shipping/stowage" 
          desc="Calcula y valida el centro de gravedad (COG) del contenedor en buque." 
          sectorIcon={Ship} 
          sectorColor="#3b82f6" 
          onCopy={copyToClipboard}
          onTest={testEndpoint}
        />
        
        {/* Transporte Terrestre */}
        <ApiEndpoint 
          method="GET" 
          path="/v1/logistics/active-route" 
          desc="Obtiene coordenadas GPS y métricas de última milla." 
          sectorIcon={Truck} 
          sectorColor="#f59e0b" 
          onCopy={copyToClipboard}
          onTest={testEndpoint}
        />
        
        {/* Auditoría / Seguridad */}
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

      {/* SDK Downloads */}
      <div className="card" style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <TerminalSquare size={18} color="#f472b6" />
          <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase' }}>Enterprise SDKs</h3>
        </div>
        <p style={{ fontSize: 11, color: 'var(--bz-text-muted)', marginBottom: 16 }}>
          Instala nuestra librería para manejar firmas criptográficas y WebSockets automáticamente.
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

        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => downloadSdkSnippet('python')} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--bz-border)', borderRadius: 8, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--bz-text)' }}>
            <Download size={14} /> Python Pip
          </button>
          <button onClick={() => downloadSdkSnippet('java')} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--bz-border)', borderRadius: 8, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--bz-text)' }}>
            <Download size={14} /> Java Maven
          </button>
        </div>
        <button onClick={runSdkProbe} className="btn btn-primary" style={{ width: '100%', marginTop: 16 }}>
          PROBAR SDK /v1/logistics/route
        </button>
        {sdkResult && (
          <div style={{ marginTop: 12, padding: 12, background: '#0e0e0e', border: '1px solid var(--bz-border)', borderRadius: 8 }}>
            <p style={{ fontSize: 10, color: 'var(--bz-text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Respuesta SDK</p>
            <code style={{ display: 'block', marginTop: 6, fontSize: 10, color: 'var(--bz-primary)', wordBreak: 'break-all' }}>
              {sdkResult.blockchain.event} / {blockchainStatusText(sdkResult.blockchain)} / {sdkResult.billing.mode} / {sdkResult.source.toUpperCase()}
            </code>
            <p style={{ marginTop: 8, fontSize: 10, color: sdkResult.realBlockchain?.ok ? 'var(--bz-secondary)' : 'var(--bz-text-muted)' }}>
              Blockchain real: {sdkResult.realBlockchain?.ok ? sdkResult.realBlockchain.txHash : (sdkResult.blockchain?.nextAction || sdkResult.realBlockchain?.reason)}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default DeveloperIntegration
