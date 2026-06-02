import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Globe, 
  FileCode, 
  Send, 
  CheckCircle2, 
  Link as LinkIcon,
  Zap,
  Building2,
  FileJson
} from 'lucide-react'
import { usePlatformState } from '../hooks/usePlatformState'
import { cargoGateway } from '../services/cargoGateway'
import { blockchainStatusText, blockNumberText } from '../utils/blockchainDisplay'

const CustomsSync = () => {
  const { platformState } = usePlatformState()
  const [syncing, setSyncing] = useState(false)
  const [synced, setSynced] = useState(false)
  const [dispatch, setDispatch] = useState(null)
  const [error, setError] = useState('')
  const [payloadFormat, setPayloadFormat] = useState('xml')

  const handleSync = async () => {
    setError('')
    setSyncing(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 600))
      const response = await cargoGateway.dispatchCustoms({
        bUid: 'BZ-LOG-ES-17148',
        shipmentId: 'TRX-9921-X',
        manifestId: 'TRX-9921-X',
        standard: 'UBL_2_1',
        target: 'ASYCUDA/WCO-SIMPLE',
      }, platformState.apiKey)
      setDispatch(response)
      setSynced(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <header style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--bz-primary)', marginBottom: 8 }}>
          <Globe size={16} />
          <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2 }}>Regulatory Gateway</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Space Grotesk' }}>Customs Sync</h1>
        <p style={{ fontSize: 12, color: 'var(--bz-text-muted)', marginTop: 4 }}>
          UBL 2.1 Standard & Chainlink Oracle Dispatch.
        </p>
      </header>

      {/* Global Status Banner */}
      <div className="card" style={{ background: synced ? 'rgba(121, 255, 91, 0.05)' : 'rgba(0, 240, 255, 0.05)', border: synced ? '1px solid var(--bz-secondary)' : '1px solid var(--bz-primary)', display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: synced ? 'var(--bz-secondary)' : 'var(--bz-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00363a' }}>
          {synced ? <CheckCircle2 size={24} /> : <Zap size={24} className={syncing ? 'animate-pulse' : ''} />}
        </div>
        <div>
          <h4 style={{ fontSize: 14, fontWeight: 800, color: synced ? 'var(--bz-secondary)' : 'var(--bz-primary)' }}>
            {synced ? 'ADUANA DESPACHADA (GREEN LANE)' : 'PENDIENTE DE VALIDACIÓN'}
          </h4>
          <p style={{ fontSize: 10, color: 'var(--bz-text-muted)' }}>
            {synced ? `Autorización: ${dispatch?.result.authorization}` : 'Esperando firmas de Fingerprint y Stowage'}
          </p>
        </div>
      </div>

      {/* Data Transformation View */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>UBL 2.1 Payload (XML)</h3>
          <div style={{ display: 'flex', gap: 8 }}>
             <button onClick={() => setPayloadFormat('xml')} style={{ padding: '4px 8px', background: payloadFormat === 'xml' ? 'var(--bz-surface-container)' : 'transparent', fontSize: 9, fontWeight: 800, border: '1px solid var(--bz-border)', color: payloadFormat === 'xml' ? 'var(--bz-text)' : 'var(--bz-text-muted)' }}>XML</button>
             <button onClick={() => setPayloadFormat('jsonld')} style={{ padding: '4px 8px', background: payloadFormat === 'jsonld' ? 'var(--bz-surface-container)' : 'transparent', fontSize: 9, fontWeight: 800, border: '1px solid var(--bz-border)', color: payloadFormat === 'jsonld' ? 'var(--bz-text)' : 'var(--bz-text-muted)' }}>JSON-LD</button>
          </div>
        </div>
        <div style={{ background: '#080808', padding: 16, borderRadius: 4, border: '1px solid var(--bz-border)', height: 200, overflow: 'auto', fontFamily: 'monospace', fontSize: 11, color: 'var(--bz-primary)', opacity: 0.8 }}>
          <pre>
{payloadFormat === 'xml' ? `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" ...>
  <cbc:ID>BZ-LOG-ES-17148</cbc:ID>
  <cbc:IssueDate>2026-05-05</cbc:IssueDate>
  <cac:Consignment>
    <cbc:ID>#TRX-9921-X</cbc:ID>
    <cbc:TotalWeightMeasure>1270.00</cbc:TotalWeightMeasure>
    <cbc:WeightUnitCode>KGM</cbc:WeightUnitCode>
    <cac:FingerprintHash>0x882...99a</cac:FingerprintHash>
    <cac:StowageCOG x="42.5" y="38.2" />
  </cac:Consignment>
</Invoice>` : `{
  "@context": "https://schema.bez.digital/cargo/v1",
  "@type": "CargoManifest",
  "bUid": "BZ-LOG-ES-17148",
  "shipmentId": "TRX-9921-X",
  "standard": "UBL_2_1",
  "weight": { "value": 1270, "unit": "KGM" },
  "fingerprintHash": "0x882...99a",
  "stowageCOG": { "x": 42.5, "y": 38.2 }
}`}
          </pre>
        </div>
      </div>

      {/* Chainlink Oracle Status */}
      <div className="card" style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <LinkIcon size={18} color="var(--bz-primary)" />
          <h4 style={{ fontSize: 13, fontWeight: 800 }}>Chainlink Functions Relay</h4>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <OracleStep label="Fetch Auth Token" status="DONE" />
          <OracleStep label="Post B-UID to SIMPLE API" status={syncing ? 'RUNNING' : (synced ? 'DONE' : 'PENDING')} />
          <OracleStep label="Verify Customs Signature" status={synced ? 'DONE' : 'PENDING'} />
          <OracleStep label="Anchor CustomsCleared Event" status={dispatch ? 'DONE' : 'PENDING'} />
        </div>
      </div>
      {dispatch && (
        <div className="card" style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 10, color: 'var(--bz-text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>L2 Settlement</p>
          <code style={{ display: 'block', marginTop: 8, fontSize: 10, color: 'var(--bz-primary)', wordBreak: 'break-all' }}>
            {dispatch.blockchain.event} / block {blockNumberText(dispatch.blockchain)} / {blockchainStatusText(dispatch.blockchain)} / {dispatch.billing.mode}
            {dispatch.realBlockchain?.ok ? ` / REAL ${dispatch.realBlockchain.txHash}` : ` / ${dispatch.source.toUpperCase()}`}
          </code>
        </div>
      )}
      {error && <p style={{ color: 'var(--bz-error)', fontSize: 11, marginBottom: 16 }}>{error}</p>}

      {/* Sync Button */}
      <button className="btn btn-primary" style={{ width: '100%', padding: 20, marginBottom: 12 }} onClick={handleSync} disabled={syncing || synced}>
        <Send size={20} />
        {syncing ? 'SYNCING TO CUSTOMS...' : (synced ? 'DESPACHADO' : 'PUSH TO ADUANA')}
      </button>

      {/* Partner Agencies */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 24, opacity: 0.5 }}>
         <div style={{ textAlign: 'center' }}>
            <Building2 size={24} style={{ margin: '0 auto 4px' }} />
            <p style={{ fontSize: 8, fontWeight: 800 }}>ASYCUDA</p>
         </div>
         <div style={{ textAlign: 'center' }}>
            <Globe size={24} style={{ margin: '0 auto 4px' }} />
            <p style={{ fontSize: 8, fontWeight: 800 }}>WCO-SIMPLE</p>
         </div>
      </div>
    </div>
  )
}

const OracleStep = ({ label, status }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
    <span style={{ color: 'var(--bz-text-muted)' }}>{label}</span>
    <span style={{ 
      fontWeight: 800, 
      color: status === 'DONE' ? 'var(--bz-secondary)' : (status === 'RUNNING' ? 'var(--bz-primary)' : 'var(--bz-text-muted)'),
      textTransform: 'uppercase'
    }}>
      {status}
    </span>
  </div>
)

export default CustomsSync
