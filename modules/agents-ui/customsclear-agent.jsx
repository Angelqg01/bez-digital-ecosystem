import { useState, useEffect, useRef, useCallback } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── ANTHROPIC API CALL (Claude Vision) ──────────────────────────────────────
async function analyzeCustomsDocument(base64Image, docType, addLog) {
  addLog(`🤖 Claude Vision analizando: ${docType}...`);
  const prompt = `You are an expert customs clearance AI agent for BeZhas blockchain logistics platform.

Analyze this customs document (${docType}) and extract ALL relevant fields in JSON format.

Return ONLY valid JSON with this exact structure:
{
  "docType": "${docType}",
  "isValid": true/false,
  "confidence": 0-100,
  "shipper": "company name",
  "consignee": "company name",
  "origin": "country/port",
  "destination": "country/port",
  "hsCode": "HS tariff code",
  "description": "cargo description",
  "quantity": "amount + unit",
  "weight": "gross weight",
  "value": "declared value USD",
  "currency": "USD/EUR/etc",
  "documentNumber": "doc reference number",
  "issueDate": "date",
  "alerts": ["list of any issues, missing fields, or fraud indicators"],
  "clearanceRecommendation": "APPROVE/HOLD/REJECT",
  "clearanceReason": "brief explanation",
  "taricCode": "EU TARIC code if applicable",
  "dutyRate": "estimated duty %",
  "estimatedDuty": "USD amount"
}

Be thorough and flag any discrepancies, missing mandatory fields, or suspicious elements.`;

  try {
    const body = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Image } },
          { type: "text", text: prompt }
        ]
      }]
    };

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    const text = data.content?.map(b => b.text || "").join("") || "";
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch (err) {
    // Return simulated result if API fails or no image
    return simulateDocAnalysis(docType);
  }
}

// ─── SIMULATED ANALYSIS (fallback / demo) ────────────────────────────────────
function simulateDocAnalysis(docType) {
  const templates = {
    "DUA": { docType: "DUA", isValid: true, confidence: 94, shipper: "SHANGHAI TRADE CO. LTD", consignee: "IBERLOGISTIC S.A.", origin: "CN - SHANGHAI", destination: "ES - BARCELONA", hsCode: "8471.30.00", description: "Laptop Computers & Accessories", quantity: "1,240 UNITS", weight: "6,820 KG", value: "4,200,000", currency: "USD", documentNumber: "DUA-ES2024-00441829", issueDate: "2025-03-14", alerts: [], clearanceRecommendation: "APPROVE", clearanceReason: "All fields valid. HS code matches declared goods. Value within normal range.", taricCode: "8471300000", dutyRate: "0%", estimatedDuty: "$0 (IT goods exemption)" },
    "CMR": { docType: "CMR", isValid: true, confidence: 88, shipper: "AUTOPARTS GMBH", consignee: "TALGO FERROVIARIA S.A.", origin: "DE - HAMBURG", destination: "ES - BILBAO", hsCode: "8708.99.97", description: "Automotive Parts - Mixed", quantity: "48 PALLETS", weight: "24,400 KG", value: "875,000", currency: "EUR", documentNumber: "CMR-2024-DE-88712", issueDate: "2025-03-13", alerts: ["Vehicle registration not attached - required for automotive goods"], clearanceRecommendation: "HOLD", clearanceReason: "Missing vehicle registration document. Request from shipper before release.", taricCode: "8708999700", dutyRate: "4.5%", estimatedDuty: "€39,375" },
    "AWB": { docType: "AWB", isValid: false, confidence: 71, shipper: "PHARMA LABS INC", consignee: "LABORATORIOS ROVI S.A.", origin: "US - MIAMI", destination: "ES - MADRID MAD", hsCode: "3004.90.19", description: "Pharmaceutical Products - Controlled", quantity: "320 BOXES", weight: "480 KG", value: "2,100,000", currency: "USD", documentNumber: "AWB-IB-2024-009912", issueDate: "2025-03-15", alerts: ["⚠️ Controlled substance - AEMPS import permit REQUIRED", "⚠️ Cold chain certificate missing (2-8°C required)", "Temperature log not attached"], clearanceRecommendation: "REJECT", clearanceReason: "Controlled pharmaceutical - AEMPS permit number not found. Cold chain documentation incomplete.", taricCode: "3004901900", dutyRate: "0% (MFN)", estimatedDuty: "$0 + AEMPS fee" },
    "PACKING LIST": { docType: "PACKING LIST", isValid: true, confidence: 97, shipper: "MAERSK LINE", consignee: "MERCADONA S.A.", origin: "MX - MANZANILLO", destination: "ES - VALENCIA", hsCode: "0803.90.10", description: "Fresh Bananas - Reefer Cargo", quantity: "18,400 KG / 920 BOXES", weight: "18,400 KG NET", value: "23,000", currency: "EUR", documentNumber: "PL-MAEU240312001-01", issueDate: "2025-03-12", alerts: ["Phytosanitary certificate must be verified by MAPA"], clearanceRecommendation: "APPROVE", clearanceReason: "Perishable goods expedited. Phytosanitary cert on file. Fast-track processing recommended.", taricCode: "0803901000", dutyRate: "17.9%", estimatedDuty: "€4,117" },
  };
  return templates[docType] || templates["DUA"];
}

// ─── DOCUMENT TYPES ───────────────────────────────────────────────────────────
const DOC_TYPES = ["DUA", "CMR", "AWB", "PACKING LIST", "CERTIFICATE OF ORIGIN", "PHYTOSANITARY", "EUR.1", "T1/T2"];

// ─── SAMPLE SHIPMENTS QUEUE ───────────────────────────────────────────────────
const INITIAL_QUEUE = [
  { id: "CLR-2025-0441", vessel: "MAERSK EDMONTON", bl: "MAEU240312001", origin: "CN-SHA", dest: "ES-BCN", cargo: "Electronics", value: "$4.2M", docs: ["DUA", "PACKING LIST", "CERTIFICATE OF ORIGIN"], status: "PENDING", priority: "HIGH", eta: "2025-03-17", teus: 1240 },
  { id: "CLR-2025-0440", vessel: "MSC OSCAR", bl: "MSCU724519843", origin: "DE-HAM", dest: "DE-HAM", cargo: "Automotive", value: "$875K", docs: ["CMR", "PACKING LIST"], status: "HOLD", priority: "MEDIUM", eta: "2025-03-20", teus: 48 },
  { id: "CLR-2025-0439", vessel: "AIR IB-9912", bl: "AWB-IB-2024-009912", origin: "US-MIA", dest: "ES-MAD", cargo: "Pharma", value: "$2.1M", docs: ["AWB", "PACKING LIST"], status: "REJECTED", priority: "URGENT", eta: "2025-03-15", teus: null },
  { id: "CLR-2025-0438", vessel: "COSCO ANDES", bl: "COSU6285041960", origin: "MX-MZN", dest: "ES-VLC", cargo: "Perishables", value: "€23K", docs: ["PACKING LIST", "PHYTOSANITARY"], status: "CLEARED", priority: "URGENT", eta: "2025-03-16", teus: 3 },
  { id: "CLR-2025-0437", vessel: "EVER GIVEN", bl: "EGLV143100209734", origin: "KR-BUS", dest: "NL-RTM", cargo: "Steel Coils", value: "$12.4M", docs: ["DUA", "CMR", "EUR.1", "PACKING LIST"], status: "PENDING", priority: "HIGH", eta: "2025-03-22", teus: 5200 },
];

const STATUS_CFG = {
  PENDING: { color: "#64B5F6", bg: "rgba(100,181,246,0.1)", icon: "⏳" },
  HOLD: { color: "#FFB300", bg: "rgba(255,179,0,0.1)", icon: "⚠️" },
  REJECTED: { color: "#FF5252", bg: "rgba(255,82,82,0.1)", icon: "🚫" },
  CLEARED: { color: "#00E676", bg: "rgba(0,230,118,0.1)", icon: "✅" },
  SCANNING: { color: "#E040FB", bg: "rgba(224,64,251,0.1)", icon: "🔍" },
};
const REC_CFG = {
  APPROVE: { color: "#00E676", bg: "rgba(0,230,118,0.12)", icon: "✅" },
  HOLD: { color: "#FFB300", bg: "rgba(255,179,0,0.12)", icon: "⚠️" },
  REJECT: { color: "#FF5252", bg: "rgba(255,82,82,0.12)", icon: "🚫" },
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function CustomsClearAgent() {
  const bridge = useAgentBridge('customsclear');
  const [tab, setTab] = useState("queue");
  const [queue, setQueue] = useState(INITIAL_QUEUE);
  const [selected, setSelected] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanDocType, setScanDocType] = useState("DUA");
  const [uploadedImage, setUploadedImage] = useState(null);
  const [uploadedB64, setUploadedB64] = useState(null);
  const [clearStep, setClearStep] = useState(0);
  const [log, setLog] = useState([
    "[ 08:00:01 ] CustomsClear Agent STARTED",
    "[ 08:00:02 ] AEAT España API → CONNECTED",
    "[ 08:00:02 ] EU TARIC Database → CONNECTED",
    "[ 08:00:03 ] Claude Vision API → READY",
    "[ 08:00:04 ] BeZhasCore.sol QualityEscrow → LOADED",
    "[ 08:00:05 ] Monitoring 5 shipments in queue",
  ]);
  const [stats, setStats] = useState({ cleared: 1, held: 1, rejected: 1, pending: 2, revenue: 0.2841 });
  // NEW STATE FOR TRACKING & DUTY FEATURES
  const [trackingData, setTrackingData] = useState(null);
  const [selectedHSCode, setSelectedHSCode] = useState("8471.30.00");
  const [cargoValue, setCargoValue] = useState("4200000");
  const [certificateData, setCertificateData] = useState(null);
  const fileRef = useRef();

  const addLog = useCallback((msg) => {
    const ts = new Date().toTimeString().slice(0, 8);
    setLog(prev => [`[ ${ts} ] ${msg}`, ...prev].slice(0, 50));
  }, []);

  // Simulate background activity
  useEffect(() => {
    const msgs = [
      "TARIC database sync complete — 21,143 codes loaded",
      "AEAT: eDUA system heartbeat OK",
      "Oracle: EUR/USD rate updated → 1.0841",
      "Chainlink: customs duty rates refreshed",
      "LayerZero: cross-chain event relayed to BNB",
      "QualityEscrow: escrow balance checked — funds locked",
    ];
    const t = setInterval(() => addLog(msgs[Math.floor(Math.random() * msgs.length)]), 5000);
    return () => clearInterval(t);
  }, [addLog]);

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setUploadedImage(url);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target.result.split(",")[1];
      setUploadedB64(b64);
      addLog(`📄 Document uploaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    };
    reader.readAsDataURL(file);
  };

  // Scan document with Claude Vision
  const scanDocument = async () => {
    setScanning(true);
    setScanResult(null);
    addLog(`🔍 Initiating AI scan — doc type: ${scanDocType}`);

    // Use placeholder image if no upload
    const b64 = uploadedB64 || btoa("demo_document_placeholder");
    const result = await analyzeCustomsDocument(b64, scanDocType, addLog);
    setScanResult(result);
    setScanning(false);
    addLog(`✅ Scan complete — Confidence: ${result.confidence}% — Recommendation: ${result.clearanceRecommendation}`);
  };

  // Execute on-chain clearance
  const executeClearance = (shipment, action) => {
    setClearStep(1);
    addLog(`⛓️ Initiating on-chain clearance for ${shipment.id}`);
    const steps = [
      [1, 800, `Verifying document hashes on QualityOracle...`],
      [2, 1800, `Calling BeZhasCore.sol → updateContainerStatus(${action})...`],
      [3, 2800, `Writing customs record to immutable ledger...`],
      [4, 3800, action === "APPROVE" ? `QualityEscrow → releasing funds to shipper...` : `QualityEscrow → funds locked pending review...`],
      [5, 4800, `✅ TX confirmed on Polygon — Block: ${Math.floor(Math.random() * 9999999 + 40000000)}`],
    ];
    steps.forEach(([step, delay, msg]) => {
      setTimeout(() => {
        setClearStep(step);
        addLog(msg);
        if (step === 5) {
          const newStatus = action === "APPROVE" ? "CLEARED" : action === "HOLD" ? "HOLD" : "REJECTED";
          setQueue(prev => prev.map(q => q.id === shipment.id ? { ...q, status: newStatus } : q));
          setStats(prev => ({
            ...prev,
            cleared: action === "APPROVE" ? prev.cleared + 1 : prev.cleared,
            held: action === "HOLD" ? prev.held + 1 : prev.held,
            rejected: action === "REJECT" ? prev.rejected + 1 : prev.rejected,
            pending: prev.pending - 1,
            revenue: +(prev.revenue + 0.0124).toFixed(4),
          }));
          setTimeout(() => setClearStep(0), 2000);
        }
      }, delay);
    });
  };

  // NEW: Get tracking data from API
  const fetchTrackingData = async (shipmentId) => {
    addLog(`📡 Fetching real-time tracking for ${shipmentId}...`);
    const mockTracking = {
      shipmentId,
      provider: "FlighRadar24",
      status: "IN_TRANSIT",
      lastCheckpoint: {
        timestamp: new Date().toISOString(),
        location: "37.2886° N, 3.5891° W (Strait of Gibraltar)",
        container: "MAEU240312001",
        temperature: "22.5°C",
        humidity: "65%",
      },
      checkpoints: [
        { ts: "2025-03-14T08:00", loc: "Shanghai, China", temp: "18°C", status: "DEPARTED" },
        { ts: "2025-03-17T14:30", loc: "Singapore Port", temp: "26°C", status: "TRANSIT" },
        { ts: "2025-03-20T09:15", loc: "Strait of Gibraltar", temp: "22.5°C", status: "ACTIVE" },
      ],
      eta: "2025-03-24T18:00",
      progress: 68,
    };
    setTrackingData(mockTracking);
    addLog(`✅ Tracking updated — ${mockTracking.checkpoints.length} checkpoints recorded`);
  };

  // NEW: Calculate duty from HS code & value
  const calculateDuty = () => {
    const tariffRates = {
      "8471.30.00": { desc: "Laptops & Accessories", rate: 0 },
      "8708.99.97": { desc: "Automotive Parts", rate: 4.5 },
      "3004.90.19": { desc: "Pharmaceuticals", rate: 0 },
      "0803.90.10": { desc: "Bananas", rate: 17.9 },
    };
    const tf = tariffRates[selectedHSCode] || { desc: "Other", rate: 5 };
    const value = parseFloat(cargoValue.replace(/\D/g, '')) || 4200000;
    const duty = (value * tf.rate) / 100;
    addLog(`💰 Duty calculation: €${value.toLocaleString()} @ ${tf.rate}% = €${Math.floor(duty).toLocaleString()}`);
    return { hsCode: selectedHSCode, description: tf.desc, rate: tf.rate, value, duty: Math.floor(duty) };
  };

  // NEW: Generate clearance certificate NFT
  const generateCertificate = () => {
    if (!selected) { addLog("⚠️ No shipment selected"); return; }
    const cert = {
      tokenId: Math.floor(Math.random() * 999999),
      shipmentId: selected.id,
      hsCode: selectedHSCode,
      cargo: selected.cargo,
      value: cargoValue,
      customsPlatform: "AduanaEasy",
      officerSignature: "0x742d35Cc6634C0532925a3b844Bc9e7595f" + Math.floor(Math.random() * 999999),
      issuedDate: new Date().toISOString().split('T')[0],
      expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      ipfsHash: "Qm" + Math.random().toString(36).slice(2, 50),
    };
    setCertificateData(cert);
    addLog(`🏆 Certificate NFT #${cert.tokenId} generated — IPFS: ${cert.ipfsHash}`);
  };

  const C = {
    bg: "#02080F", panel: "#050E18", border: "rgba(0,180,255,0.1)",
    accent: "#00B4FF", green: "#00E676", amber: "#FFB300", red: "#FF5252",
    purple: "#CE93D8", dim: "#1A3044",
  };

  const TABS = [
    { id: "queue", label: "CLEARANCE QUEUE", icon: "📋" },
    { id: "scanner", label: "AI DOC SCANNER", icon: "🔍" },
    { id: "tracking", label: "TRACKING LIVE", icon: "📍" },
    { id: "duty", label: "DUTY CALCULATOR", icon: "💰" },
    { id: "customs", label: "CUSTOMS RULES", icon: "📜" },
    { id: "escrow", label: "ESCROW STATUS", icon: "🔒" },
    { id: "certs", label: "CERTIFICATES", icon: "🏆" },
    { id: "stats", label: "ANALYTICS", icon: "📊" },
    { id: "metrics", label: "METRICS", icon: "📈" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: "#A8C4D8", fontFamily: "'Courier New', monospace", fontSize: 12, display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
        @keyframes pulse-border { 0%,100%{border-color:rgba(0,180,255,0.3)} 50%{border-color:rgba(0,180,255,0.8)} }
        @keyframes scan-line { 0%{top:0%} 100%{top:100%} }
        @keyframes slide-in { from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:translateX(0)} }
        @keyframes progress { from{width:0%} to{width:100%} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .row-hover:hover { background: rgba(0,180,255,0.05) !important; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,180,255,0.2); }
      `}</style>

      {/* TOP BAR */}
      <div style={{ background: "#020B14", borderBottom: `1px solid ${C.border}`, padding: "8px 20px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 22 }}>🛃</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: C.accent, letterSpacing: 3 }}>CUSTOMSCLEAR AGENT</div>
            <div style={{ fontSize: 9, color: "#1A3044", letterSpacing: 2 }}>BEZHAS · AI CUSTOMS CLEARANCE · AEAT · EU CUSTOMS · TARIC</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 24, marginLeft: "auto", flexWrap: "wrap" }}>
          {[
            { l: "IN QUEUE", v: queue.filter(q => q.status === "PENDING").length, c: C.accent },
            { l: "ON HOLD", v: queue.filter(q => q.status === "HOLD").length, c: C.amber },
            { l: "CLEARED", v: stats.cleared, c: C.green },
            { l: "BEZ EARNED", v: stats.revenue + " BEZ", c: "#FFD700" },
            { l: "CLAUDE AI", v: "● READY", c: C.purple, blink: true },
          ].map(({ l, v, c, blink }) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 8, color: "#1A3044", letterSpacing: 1 }}>{l}</div>
              <div style={{ color: c, fontWeight: 700, fontSize: 13, animation: blink ? "blink 2s infinite" : "none" }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: "flex", background: "#020B14", borderBottom: `1px solid ${C.border}`, padding: "0 20px" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "9px 16px", background: "none", border: "none",
            borderBottom: `2px solid ${tab === t.id ? C.accent : "transparent"}`,
            color: tab === t.id ? C.accent : "#1A3044",
            cursor: "pointer", fontSize: 10, fontFamily: "inherit", letterSpacing: 1,
            fontWeight: tab === t.id ? 700 : 400, transition: "all 0.15s",
          }}>{t.icon} {t.label}</button>
        ))}
      </div>

      {/* MAIN + LOG */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>

          {/* ══ QUEUE TAB ══ */}
          {tab === "queue" && (
            <div>
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, overflow: "hidden", marginBottom: 14 }}>
                <div style={{ padding: "9px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: C.accent, fontSize: 10, letterSpacing: 2 }}>CLEARANCE QUEUE — LIVE</span>
                  <span style={{ fontSize: 9, color: "#1A3044" }}>AEAT eDUA · EU Customs · WCO DataModel</span>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "rgba(0,0,0,0.4)" }}>
                      {["ID", "VESSEL / B/L", "ROUTE", "CARGO", "VALUE", "DOCS", "STATUS", "PRIORITY", "ACTION"].map(h => (
                        <th key={h} style={{ padding: "6px 10px", fontSize: 8, color: "#1A3044", letterSpacing: 1, textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((q, i) => {
                      const sc = STATUS_CFG[q.status] || STATUS_CFG.PENDING;
                      return (
                        <tr key={q.id} className="row-hover" onClick={() => setSelected(selected?.id === q.id ? null : q)}
                          style={{ borderTop: `1px solid ${C.border}22`, cursor: "pointer", background: selected?.id === q.id ? "rgba(0,180,255,0.06)" : i % 2 ? "rgba(0,0,0,0.15)" : "transparent" }}>
                          <td style={{ padding: "8px 10px", color: C.accent, fontWeight: 700, fontSize: 10 }}>{q.id}</td>
                          <td style={{ padding: "8px 10px" }}>
                            <div style={{ color: "#B8D4E8", fontSize: 11 }}>{q.vessel}</div>
                            <div style={{ color: "#1A3044", fontSize: 9 }}>{q.bl}</div>
                          </td>
                          <td style={{ padding: "8px 10px", color: "#7A9BB5", fontSize: 10 }}>{q.origin} → {q.dest}</td>
                          <td style={{ padding: "8px 10px", color: "#94BAD8" }}>{q.cargo}</td>
                          <td style={{ padding: "8px 10px", color: C.amber, fontWeight: 700 }}>{q.value}</td>
                          <td style={{ padding: "8px 10px" }}>
                            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                              {q.docs.map(d => <span key={d} style={{ padding: "1px 5px", fontSize: 8, background: "rgba(0,180,255,0.1)", color: C.accent, borderRadius: 2 }}>{d}</span>)}
                            </div>
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <span style={{ padding: "2px 8px", background: sc.bg, color: sc.color, borderRadius: 2, fontSize: 9, whiteSpace: "nowrap" }}>{sc.icon} {q.status}</span>
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <span style={{ color: q.priority === "URGENT" ? C.red : q.priority === "HIGH" ? C.amber : "#7A9BB5", fontSize: 9 }}>{q.priority}</span>
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            {q.status === "PENDING" && (
                              <div style={{ display: "flex", gap: 4 }}>
                                <button onClick={(e) => { e.stopPropagation(); setSelected(q); setTab("scanner"); }}
                                  style={{ padding: "3px 8px", background: `${C.purple}18`, border: `1px solid ${C.purple}44`, color: C.purple, cursor: "pointer", fontFamily: "inherit", fontSize: 9, borderRadius: 2 }}>🔍 SCAN</button>
                                <button onClick={(e) => { e.stopPropagation(); executeClearance(q, "APPROVE"); }}
                                  style={{ padding: "3px 8px", background: `${C.green}18`, border: `1px solid ${C.green}44`, color: C.green, cursor: "pointer", fontFamily: "inherit", fontSize: 9, borderRadius: 2 }}>✅</button>
                                <button onClick={(e) => { e.stopPropagation(); executeClearance(q, "HOLD"); }}
                                  style={{ padding: "3px 8px", background: `${C.amber}18`, border: `1px solid ${C.amber}44`, color: C.amber, cursor: "pointer", fontFamily: "inherit", fontSize: 9, borderRadius: 2 }}>⚠️</button>
                              </div>
                            )}
                            {q.status !== "PENDING" && <span style={{ fontSize: 9, color: "#1A3044" }}>{q.status}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Selected shipment detail */}
              {selected && (
                <div style={{ background: C.panel, border: `1px solid ${C.accent}33`, borderRadius: 4, padding: 16, animation: "slide-in 0.3s ease" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#DCF0FF" }}>{selected.id} — {selected.vessel}</div>
                      <div style={{ fontSize: 9, color: "#1A3044", marginTop: 2 }}>B/L: {selected.bl} | ETA: {selected.eta} | {selected.teus ? selected.teus + " TEUs" : "Air Freight"}</div>
                    </div>
                    <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "#1A3044", cursor: "pointer", fontSize: 16 }}>✕</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
                    {[
                      ["ROUTE", `${selected.origin} → ${selected.dest}`],
                      ["CARGO TYPE", selected.cargo],
                      ["DECLARED VALUE", selected.value],
                      ["REQUIRED DOCS", selected.docs.join(", ")],
                      ["STATUS", selected.status],
                      ["PRIORITY", selected.priority],
                    ].map(([l, v]) => (
                      <div key={l} style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: 3 }}>
                        <div style={{ fontSize: 8, color: "#1A3044", letterSpacing: 1, marginBottom: 3 }}>{l}</div>
                        <div style={{ color: "#94BAD8", fontSize: 11 }}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {/* On-chain clearance flow */}
                  {clearStep > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      {[
                        [1, "Verifying document hashes on QualityOracle"],
                        [2, "Updating ContainerStatus on BeZhasCore.sol"],
                        [3, "Writing to immutable customs ledger"],
                        [4, "Releasing / locking QualityEscrow funds"],
                      ].map(([s, label]) => (
                        <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                          <span style={{ color: clearStep > s ? C.green : clearStep === s ? C.accent : "#1A3044", fontSize: 11, width: 14 }}>
                            {clearStep > s ? "✓" : clearStep === s ? "◐" : "○"}
                          </span>
                          <span style={{ color: clearStep >= s ? "#7A9BB5" : "#1A3044", fontSize: 10 }}>{label}</span>
                          {clearStep === s && <div style={{ flex: 1, height: 2, background: C.dim, borderRadius: 1 }}><div style={{ height: "100%", background: C.accent, animation: "progress 0.9s linear infinite", borderRadius: 1 }} /></div>}
                        </div>
                      ))}
                    </div>
                  )}

                  {selected.status === "PENDING" && clearStep === 0 && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => { setTab("scanner"); }}
                        style={{ flex: 1, padding: "9px", background: `${C.purple}18`, border: `1px solid ${C.purple}66`, color: C.purple, cursor: "pointer", fontFamily: "inherit", fontSize: 10, fontWeight: 700, letterSpacing: 1, borderRadius: 3 }}>
                        🤖 SCAN WITH CLAUDE AI
                      </button>
                      <button onClick={() => executeClearance(selected, "APPROVE")}
                        style={{ flex: 1, padding: "9px", background: `${C.green}18`, border: `1px solid ${C.green}66`, color: C.green, cursor: "pointer", fontFamily: "inherit", fontSize: 10, fontWeight: 700, letterSpacing: 1, borderRadius: 3 }}>
                        ✅ APPROVE & RELEASE ON-CHAIN
                      </button>
                      <button onClick={() => executeClearance(selected, "HOLD")}
                        style={{ flex: 1, padding: "9px", background: `${C.amber}18`, border: `1px solid ${C.amber}66`, color: C.amber, cursor: "pointer", fontFamily: "inherit", fontSize: 10, fontWeight: 700, letterSpacing: 1, borderRadius: 3 }}>
                        ⚠️ HOLD FOR REVIEW
                      </button>
                      <button onClick={() => executeClearance(selected, "REJECT")}
                        style={{ flex: 1, padding: "9px", background: `${C.red}18`, border: `1px solid ${C.red}66`, color: C.red, cursor: "pointer", fontFamily: "inherit", fontSize: 10, fontWeight: 700, letterSpacing: 1, borderRadius: 3 }}>
                        🚫 REJECT
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══ AI SCANNER TAB ══ */}
          {tab === "scanner" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {/* Upload + controls */}
              <div>
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, padding: 16, marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: C.accent, letterSpacing: 2, marginBottom: 14 }}>🤖 CLAUDE VISION — DOCUMENT SCANNER</div>
                  <div style={{ fontSize: 9, color: "#1A3044", marginBottom: 14, lineHeight: 1.7 }}>
                    Upload a customs document (DUA, CMR, AWB, Packing List...) and Claude Vision will extract all fields, validate against TARIC codes, detect fraud indicators, and recommend clearance decision — automatically.
                  </div>

                  {/* Doc type selector */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 8, color: "#1A3044", letterSpacing: 1, marginBottom: 6 }}>DOCUMENT TYPE</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {DOC_TYPES.map(t => (
                        <button key={t} onClick={() => setScanDocType(t)} style={{
                          padding: "4px 10px", background: scanDocType === t ? `${C.accent}22` : "rgba(0,0,0,0.3)",
                          border: `1px solid ${scanDocType === t ? C.accent : C.border}`,
                          color: scanDocType === t ? C.accent : "#1A3044",
                          cursor: "pointer", fontFamily: "inherit", fontSize: 9, borderRadius: 2, transition: "all 0.15s",
                        }}>{t}</button>
                      ))}
                    </div>
                  </div>

                  {/* Upload area */}
                  <div
                    onClick={() => fileRef.current.click()}
                    style={{
                      padding: "24px 16px", border: `2px dashed ${C.accent}44`, borderRadius: 4,
                      textAlign: "center", cursor: "pointer", marginBottom: 12,
                      background: uploadedImage ? "rgba(0,180,255,0.05)" : "rgba(0,0,0,0.2)",
                      animation: !uploadedImage ? "pulse-border 3s infinite" : "none",
                      transition: "all 0.2s",
                    }}>
                    {uploadedImage ? (
                      <div>
                        <img src={uploadedImage} alt="doc" style={{ maxHeight: 120, maxWidth: "100%", borderRadius: 3, marginBottom: 8 }} />
                        <div style={{ fontSize: 9, color: C.green }}>✅ Document loaded</div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                        <div style={{ fontSize: 10, color: "#1A3044" }}>Click to upload document</div>
                        <div style={{ fontSize: 9, color: "#0F1F2E", marginTop: 4 }}>PDF, JPG, PNG — customs docs accepted</div>
                      </div>
                    )}
                    <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleFileUpload} style={{ display: "none" }} />
                  </div>

                  <button onClick={scanDocument} disabled={scanning}
                    style={{
                      width: "100%", padding: "11px", cursor: scanning ? "not-allowed" : "pointer",
                      background: scanning ? "rgba(0,0,0,0.3)" : `linear-gradient(135deg, ${C.purple}33, ${C.accent}22)`,
                      border: `1px solid ${scanning ? C.border : C.purple}`,
                      color: scanning ? "#1A3044" : C.purple,
                      fontFamily: "inherit", fontSize: 11, fontWeight: 700, letterSpacing: 2, borderRadius: 3, transition: "all 0.2s",
                    }}>
                    {scanning
                      ? <span>🤖 CLAUDE ANALYZING... <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>◌</span></span>
                      : "🤖 ANALYZE WITH CLAUDE VISION"}
                  </button>

                  {/* Demo buttons */}
                  <div style={{ marginTop: 10, display: "flex", gap: 5 }}>
                    {["DUA", "CMR", "AWB", "PACKING LIST"].map(t => (
                      <button key={t} onClick={() => { setScanDocType(t); setTimeout(() => { setScanDocType(t); }, 50); setUploadedImage(null); setUploadedB64(null); setScanResult(null); }}
                        style={{ flex: 1, padding: "5px", background: "rgba(0,0,0,0.3)", border: `1px solid ${C.border}`, color: "#1A3044", cursor: "pointer", fontFamily: "inherit", fontSize: 8, borderRadius: 2 }}>
                        DEMO {t}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 8, color: "#0F1F2E", textAlign: "center", marginTop: 4 }}>↑ Try demo scans without uploading</div>
                </div>

                {/* Scan progress visual */}
                {scanning && (
                  <div style={{ background: C.panel, border: `1px solid ${C.purple}44`, borderRadius: 4, padding: 14 }}>
                    <div style={{ fontSize: 10, color: C.purple, marginBottom: 12, letterSpacing: 1 }}>CLAUDE VISION — PROCESSING</div>
                    {["Reading document structure", "Extracting field values", "Validating HS/TARIC codes", "Checking against sanctions lists", "Computing fraud risk score", "Generating clearance recommendation"].map((s, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.purple, animation: `blink ${1 + i * 0.2}s infinite` }} />
                        <span style={{ fontSize: 9, color: "#7A9BB5" }}>{s}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Scan results */}
              <div>
                {scanResult ? (
                  <div style={{ animation: "slide-in 0.3s ease" }}>
                    {/* Header result */}
                    <div style={{
                      background: REC_CFG[scanResult.clearanceRecommendation]?.bg || "rgba(0,0,0,0.3)",
                      border: `1px solid ${REC_CFG[scanResult.clearanceRecommendation]?.color || C.border}44`,
                      borderRadius: 4, padding: "12px 16px", marginBottom: 12,
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                      <div>
                        <div style={{ fontSize: 10, color: "#1A3044", marginBottom: 3 }}>AI RECOMMENDATION</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: REC_CFG[scanResult.clearanceRecommendation]?.color || C.accent }}>
                          {REC_CFG[scanResult.clearanceRecommendation]?.icon} {scanResult.clearanceRecommendation}
                        </div>
                        <div style={{ fontSize: 10, color: "#7A9BB5", marginTop: 4 }}>{scanResult.clearanceReason}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 9, color: "#1A3044", marginBottom: 2 }}>CONFIDENCE</div>
                        <div style={{ fontSize: 24, fontWeight: 900, color: scanResult.confidence > 85 ? C.green : scanResult.confidence > 65 ? C.amber : C.red }}>{scanResult.confidence}%</div>
                      </div>
                    </div>

                    {/* Extracted fields */}
                    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, marginBottom: 12 }}>
                      <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 10, letterSpacing: 2, color: C.accent }}>EXTRACTED FIELDS</div>
                      <div style={{ padding: "8px 14px" }}>
                        {[
                          ["Document Type", scanResult.docType],
                          ["Document Number", scanResult.documentNumber],
                          ["Shipper", scanResult.shipper],
                          ["Consignee", scanResult.consignee],
                          ["Origin → Destination", `${scanResult.origin} → ${scanResult.destination}`],
                          ["HS Code", scanResult.hsCode],
                          ["TARIC Code", scanResult.taricCode],
                          ["Description", scanResult.description],
                          ["Quantity", scanResult.quantity],
                          ["Gross Weight", scanResult.weight],
                          ["Declared Value", `${scanResult.currency} ${parseInt(scanResult.value || 0).toLocaleString()}`],
                          ["Issue Date", scanResult.issueDate],
                          ["Duty Rate", scanResult.dutyRate],
                          ["Estimated Duty", scanResult.estimatedDuty],
                        ].map(([l, v]) => (
                          <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${C.border}22` }}>
                            <span style={{ color: "#1A3044", fontSize: 10, minWidth: 140 }}>{l}</span>
                            <span style={{ color: "#94BAD8", fontSize: 10, textAlign: "right" }}>{v || "—"}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Alerts */}
                    {scanResult.alerts && scanResult.alerts.length > 0 && (
                      <div style={{ background: "rgba(255,179,0,0.06)", border: `1px solid ${C.amber}33`, borderRadius: 4, padding: "12px 14px", marginBottom: 12 }}>
                        <div style={{ fontSize: 10, color: C.amber, letterSpacing: 2, marginBottom: 8 }}>⚠️ ALERTS & FLAGS</div>
                        {scanResult.alerts.map((a, i) => (
                          <div key={i} style={{ fontSize: 10, color: "#C8A040", marginBottom: 4, paddingLeft: 10, borderLeft: `2px solid ${C.amber}44` }}>{a}</div>
                        ))}
                      </div>
                    )}

                    {/* Action buttons */}
                    {selected && selected.status === "PENDING" && (
                      <div style={{ display: "flex", gap: 8 }}>
                        {[
                          ["APPROVE & RELEASE ON-CHAIN", "APPROVE", C.green],
                          ["HOLD FOR REVIEW", "HOLD", C.amber],
                          ["REJECT", "REJECT", C.red],
                        ].map(([label, action, color]) => (
                          <button key={action} onClick={() => { executeClearance(selected, action); setTab("queue"); }}
                            style={{ flex: 1, padding: "9px", background: `${color}18`, border: `1px solid ${color}66`, color, cursor: "pointer", fontFamily: "inherit", fontSize: 9, fontWeight: 700, letterSpacing: 1, borderRadius: 3 }}>
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                    {!selected && (
                      <div style={{ fontSize: 9, color: "#1A3044", textAlign: "center", padding: 8 }}>
                        Select a shipment from the Queue tab to execute on-chain action
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, padding: 40, textAlign: "center" }}>
                    <div style={{ fontSize: 40, marginBottom: 14 }}>🤖</div>
                    <div style={{ fontSize: 12, color: "#1A3044", marginBottom: 6 }}>Claude Vision Ready</div>
                    <div style={{ fontSize: 10, color: "#0F1F2E", lineHeight: 1.8 }}>
                      Upload a customs document or click a DEMO button<br />to see AI-powered field extraction and fraud detection
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ CUSTOMS RULES TAB ══ */}
          {tab === "customs" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, marginBottom: 14 }}>
                  <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 10, letterSpacing: 2, color: C.accent }}>TARIC DUTY RATES — KEY CHAPTERS</div>
                  {[
                    { ch: "01–05", desc: "Live animals & products", rate: "0–17.9%", flag: "🐄 CITES check" },
                    { ch: "06–14", desc: "Vegetable products", rate: "0–25%", flag: "🌿 PHYTOSANITARY" },
                    { ch: "25–27", desc: "Mineral products / Energy", rate: "0–6.5%", flag: "⚡ REACH" },
                    { ch: "28–38", desc: "Chemical products", rate: "0–6.5%", flag: "☢️ Dangerous goods" },
                    { ch: "39–40", desc: "Plastics & rubber", rate: "2–6.5%", flag: "♻️ RoHS" },
                    { ch: "84–85", desc: "Machinery / Electronics", rate: "0–3.5%", flag: "🔌 CE mark" },
                    { ch: "87", desc: "Vehicles & parts", rate: "4.5–10%", flag: "🚗 Type approval" },
                    { ch: "90", desc: "Optical / Medical", rate: "0–6.7%", flag: "🏥 MDR" },
                    { ch: "30", desc: "Pharmaceutical products", rate: "0%", flag: "💊 AEMPS permit" },
                  ].map(r => (
                    <div key={r.ch} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 14px", borderBottom: `1px solid ${C.border}22` }}>
                      <div>
                        <span style={{ color: C.accent, fontWeight: 700, fontSize: 10, marginRight: 8 }}>Ch.{r.ch}</span>
                        <span style={{ color: "#7A9BB5", fontSize: 10 }}>{r.desc}</span>
                      </div>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ color: C.amber, fontSize: 10, fontWeight: 700 }}>{r.rate}</span>
                        <span style={{ fontSize: 9, color: "#344A5E" }}>{r.flag}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, marginBottom: 14 }}>
                  <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 10, letterSpacing: 2, color: C.amber }}>REQUIRED DOCUMENTS BY CARGO TYPE</div>
                  {[
                    { type: "General Cargo", docs: ["DUA", "Commercial Invoice", "Packing List", "Bill of Lading"] },
                    { type: "Pharmaceuticals", docs: ["AWB/BL", "AEMPS Import Permit", "CoA", "Cold Chain Cert", "GDP Certificate"] },
                    { type: "Food / Perishables", docs: ["BL", "Phytosanitary Cert", "Health Cert", "TRACES (EU)"] },
                    { type: "Hazardous Materials", docs: ["DUA", "MSDS", "IMDG/ADR", "Emergency Card"] },
                    { type: "Dual-use / Military", docs: ["Export License (origin)", "End-user Certificate", "SIPRI check"] },
                    { type: "Animals / CITES", docs: ["CITES Permit", "Vet Certificate", "TRACES NT"] },
                  ].map(r => (
                    <div key={r.type} style={{ padding: "9px 14px", borderBottom: `1px solid ${C.border}22` }}>
                      <div style={{ color: "#C8D8E8", fontSize: 10, fontWeight: 700, marginBottom: 5 }}>{r.type}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {r.docs.map(d => <span key={d} style={{ padding: "2px 7px", background: "rgba(0,180,255,0.08)", color: C.accent, fontSize: 9, borderRadius: 2 }}>{d}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══ ESCROW TAB ══ */}
          {tab === "escrow" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, padding: 16, marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: C.accent, letterSpacing: 2, marginBottom: 14 }}>🔒 QUALITYESCROW — ON-CHAIN FUNDS</div>
                  {[
                    { label: "CONTRACT ADDRESS", value: "0x3EfC42095E8503d41Ad8001328FC23388E00e8a3", color: C.accent },
                    { label: "NETWORK", value: "Polygon (MATIC)", color: "#B39DDB" },
                    { label: "TOTAL LOCKED", value: "$31.7M USD equivalent", color: C.amber },
                    { label: "PENDING RELEASE", value: "$16.1M (2 shipments)", color: C.amber },
                    { label: "RELEASED TODAY", value: "$3.4M (CLR-2025-0438)", color: C.green },
                    { label: "ON HOLD", value: "$875K (CLR-2025-0440)", color: "#FFB300" },
                    { label: "REJECTED / FROZEN", value: "$2.1M (CLR-2025-0439)", color: C.red },
                    { label: "BEZ FEES EARNED", value: `${stats.revenue} BEZ`, color: "#FFD700" },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}22` }}>
                      <span style={{ fontSize: 9, color: "#1A3044", letterSpacing: 1 }}>{label}</span>
                      <span style={{ fontSize: 10, color, fontWeight: 700 }}>{value}</span>
                    </div>
                  ))}
                </div>

                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, padding: 14 }}>
                  <div style={{ fontSize: 10, color: C.green, letterSpacing: 2, marginBottom: 12 }}>ESCROW FLOW — HOW IT WORKS</div>
                  {[
                    { step: "01", action: "Importer deposits funds in BEZ/USDC to QualityEscrow", icon: "💰" },
                    { step: "02", action: "AI Agent validates all customs documents via Claude Vision", icon: "🤖" },
                    { step: "03", action: "Smart contract checks compliance: HS codes, duty, permits", icon: "⛓️" },
                    { step: "04", action: "APPROVE → funds released to exporter + duty to customs authority", icon: "✅" },
                    { step: "04b", action: "HOLD → funds frozen, dispute resolution period 72h", icon: "⚠️" },
                    { step: "04c", action: "REJECT → funds returned to importer after penalty", icon: "🚫" },
                  ].map(r => (
                    <div key={r.step} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                      <span style={{ color: C.accent, fontSize: 9, fontWeight: 700, minWidth: 24 }}>{r.step}</span>
                      <span style={{ fontSize: 9, color: "#344A5E" }}>{r.icon} {r.action}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4 }}>
                <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 10, letterSpacing: 2, color: C.accent }}>ESCROW TRANSACTIONS — RECENT</div>
                {[
                  { id: "CLR-2025-0438", action: "RELEASED", amount: "$23K", party: "Mercadona S.A.", time: "1 hr ago", color: C.green },
                  { id: "CLR-2025-0440", action: "LOCKED (HOLD)", amount: "€875K", party: "Talgo Ferroviaria", time: "2 hrs ago", color: C.amber },
                  { id: "CLR-2025-0439", action: "FROZEN (REJECT)", amount: "$2.1M", party: "Laboratorios Rovi", time: "3 hrs ago", color: C.red },
                  { id: "CLR-2025-0435", action: "RELEASED", amount: "$8.4M", party: "MediaMarkt España", time: "6 hrs ago", color: C.green },
                  { id: "CLR-2025-0434", action: "RELEASED", amount: "$1.2M", party: "Inditex S.A.", time: "8 hrs ago", color: C.green },
                ].map((t, i) => (
                  <div key={i} style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}22` }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: C.accent, fontWeight: 700, fontSize: 10 }}>{t.id}</span>
                      <span style={{ fontSize: 9, color: "#1A3044" }}>{t.time}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                      <span style={{ fontSize: 9, color: "#7A9BB5" }}>{t.party}</span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ fontSize: 9, color: C.amber }}>{t.amount}</span>
                        <span style={{ fontSize: 9, color: t.color, fontWeight: 700 }}>{t.action}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ TRACKING LIVE TAB ══ */}
          {tab === "tracking" && (
            <div>
              <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                <input type="text" placeholder="Shipment ID (e.g., CLR-2025-0441)"
                  defaultValue={selected?.id || "CLR-2025-0441"}
                  onKeyDown={(e) => e.key === "Enter" && fetchTrackingData(e.target.value)}
                  style={{ flex: 1, padding: "8px 12px", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 3, color: C.accent, fontFamily: "inherit", fontSize: 10 }} />
                <button onClick={() => fetchTrackingData(selected?.id || "CLR-2025-0441")}
                  style={{ padding: "8px 16px", background: `${C.accent}18`, border: `1px solid ${C.accent}44`, color: C.accent, cursor: "pointer", fontFamily: "inherit", fontSize: 10, fontWeight: 700, borderRadius: 3 }}>
                  📡 FETCH LIVE
                </button>
              </div>

              {trackingData ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, padding: 16 }}>
                    <div style={{ fontSize: 10, color: C.accent, letterSpacing: 2, marginBottom: 12, fontWeight: 700 }}>REAL-TIME LOCATION</div>
                    <div style={{ background: "rgba(0,180,255,0.08)", padding: 12, borderRadius: 3, marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: "#94BAD8", marginBottom: 3 }}>📍 {trackingData.lastCheckpoint.location}</div>
                      <div style={{ fontSize: 9, color: "#1A3044" }}>⏰ {new Date(trackingData.lastCheckpoint.timestamp).toLocaleString()}</div>
                      <div style={{ fontSize: 9, color: "#1A3044", marginTop: 3 }}>Container: {trackingData.lastCheckpoint.container}</div>
                      <div style={{ fontSize: 9, color: C.amber }}>🌡️ {trackingData.lastCheckpoint.temperature} | 💧 {trackingData.lastCheckpoint.humidity}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 8, color: "#1A3044", marginBottom: 4 }}>PROGRESS</div>
                        <div style={{ height: 6, background: "#0A1A28", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${trackingData.progress}%`, background: C.green, transition: "width 1s ease" }} />
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 9, color: C.green, fontWeight: 700 }}>{trackingData.progress}%</div>
                        <div style={{ fontSize: 8, color: "#1A3044" }}>ETA {trackingData.eta}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, padding: 16 }}>
                    <div style={{ fontSize: 10, color: C.accent, letterSpacing: 2, marginBottom: 12, fontWeight: 700 }}>📜 CHECKPOINT HISTORY</div>
                    {trackingData.checkpoints.map((cp, i) => (
                      <div key={i} style={{ padding: "8px 12px", background: "rgba(0,0,0,0.3)", borderLeft: `3px solid ${C.green}33`, marginBottom: 6, borderRadius: 2 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: C.accent, fontSize: 9, fontWeight: 700 }}>{cp.loc}</span>
                          <span style={{ color: "#1A3044", fontSize: 9 }}>{cp.ts}</span>
                        </div>
                        <div style={{ fontSize: 9, color: "#94BAD8", marginTop: 2 }}>{cp.status} | {cp.temp}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, padding: 40, textAlign: "center" }}>
                  <div style={{ fontSize: 40, marginBottom: 14 }}>📍</div>
                  <div style={{ fontSize: 12, color: "#1A3044", marginBottom: 6 }}>Real-Time Tracking Ready</div>
                  <div style={{ fontSize: 10, color: "#0F1F2E", lineHeight: 1.8 }}>
                    Enter a shipment ID and click FETCH LIVE to see<br />real-time location, temperature, and checkpoint data
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ DUTY CALCULATOR TAB ══ */}
          {tab === "duty" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, padding: 16 }}>
                <div style={{ fontSize: 10, color: C.accent, letterSpacing: 2, marginBottom: 14, fontWeight: 700 }}>DUTY CALCULATION</div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 9, color: "#1A3044", display: "block", marginBottom: 4 }}>HS CODE (Tariff)</label>
                  <select value={selectedHSCode} onChange={(e) => setSelectedHSCode(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", background: "rgba(0,0,0,0.3)", border: `1px solid ${C.border}`, borderRadius: 3, color: C.accent, fontFamily: "inherit", fontSize: 10 }}>
                    <option value="8471.30.00">8471.30.00 - Laptops & Accessories (0%)</option>
                    <option value="8708.99.97">8708.99.97 - Automotive Parts (4.5%)</option>
                    <option value="3004.90.19">3004.90.19 - Pharmaceuticals (0%)</option>
                    <option value="0803.90.10">0803.90.10 - Bananas (17.9%)</option>
                  </select>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 9, color: "#1A3044", display: "block", marginBottom: 4 }}>CARGO VALUE (EUR)</label>
                  <input type="text" value={cargoValue} onChange={(e) => setCargoValue(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", background: "rgba(0,0,0,0.3)", border: `1px solid ${C.border}`, borderRadius: 3, color: C.accent, fontFamily: "inherit", fontSize: 10 }} />
                </div>

                <button onClick={() => calculateDuty()}
                  style={{ width: "100%", padding: "10px", background: `${C.amber}18`, border: `1px solid ${C.amber}66`, color: C.amber, cursor: "pointer", fontFamily: "inherit", fontSize: 10, fontWeight: 700, letterSpacing: 1, borderRadius: 3 }}>
                  💰 CALCULATE DUTY
                </button>
              </div>

              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, padding: 16 }}>
                <div style={{ fontSize: 10, color: C.accent, letterSpacing: 2, marginBottom: 14, fontWeight: 700 }}>QUICK RATES (EU TARIC)</div>
                {[
                  { code: "8471.30.00", desc: "Laptops", rate: 0 },
                  { code: "8708.99.97", desc: "Auto Parts", rate: 4.5 },
                  { code: "3004.90.19", desc: "Pharma", rate: 0 },
                  { code: "0803.90.10", desc: "Bananas", rate: 17.9 },
                ].map(r => (
                  <div key={r.code} style={{ padding: "8px", borderBottom: `1px solid ${C.border}22`, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setSelectedHSCode(r.code)}>
                    <span style={{ fontSize: 10, color: "#94BAD8" }}>{r.desc} ({r.code})</span>
                    <span style={{ fontSize: 10, color: C.amber, fontWeight: 700 }}>{r.rate}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ CERTIFICATES TAB ══ */}
          {tab === "certs" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14 }}>
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, padding: 16 }}>
                <div style={{ fontSize: 10, color: C.accent, letterSpacing: 2, marginBottom: 14, fontWeight: 700 }}>ISSUE CERTIFICATE</div>

                {selected ? (
                  <div>
                    <div style={{ fontSize: 9, color: "#1A3044", marginBottom: 10 }}>
                      <strong>Shipment:</strong> {selected.id}<br />
                      <strong>Cargo:</strong> {selected.cargo}<br />
                      <strong>Value:</strong> {selected.value}
                    </div>
                    <button onClick={() => generateCertificate()}
                      style={{ width: "100%", padding: "10px", background: `${C.green}18`, border: `1px solid ${C.green}66`, color: C.green, cursor: "pointer", fontFamily: "inherit", fontSize: 10, fontWeight: 700, letterSpacing: 1, borderRadius: 3, marginBottom: 8 }}>
                      🏆 GENERATE NFT CERT
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: 9, color: "#1A3044", padding: "20px", textAlign: "center" }}>
                    Select a shipment<br />from QUEUE tab first
                  </div>
                )}
              </div>

              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, padding: 16 }}>
                <div style={{ fontSize: 10, color: C.accent, letterSpacing: 2, marginBottom: 14, fontWeight: 700 }}>🏆 CLEARANCE CERTIFICATE</div>
                {certificateData ? (
                  <div>
                    <div style={{ background: "rgba(0,230,118,0.08)", padding: 12, borderRadius: 3, marginBottom: 12 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 8, color: "#1A3044", marginBottom: 3 }}>TOKEN ID</div>
                          <div style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>#{certificateData.tokenId}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 8, color: "#1A3044", marginBottom: 3 }}>STATUS</div>
                          <div style={{ fontSize: 11, color: C.green }}>✅ VALID</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 8, color: "#1A3044", marginBottom: 3 }}>ISSUED</div>
                          <div style={{ fontSize: 9, color: "#94BAD8" }}>{certificateData.issuedDate}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 8, color: "#1A3044", marginBottom: 3 }}>EXPIRES</div>
                          <div style={{ fontSize: 9, color: "#94BAD8" }}>{certificateData.expiryDate}</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ background: "rgba(0,0,0,0.3)", padding: 10, borderRadius: 3, marginBottom: 12 }}>
                      <div style={{ fontSize: 8, color: "#1A3044", marginBottom: 4, wordBreak: "break-all" }}>IPFS: {certificateData.ipfsHash}</div>
                      <div style={{ fontSize: 8, color: "#1A3044", marginBottom: 4, wordBreak: "break-all" }}>Officer: {certificateData.officerSignature.slice(0, 16)}...</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={{ flex: 1, padding: "8px", background: `${C.accent}18`, border: `1px solid ${C.accent}44`, color: C.accent, cursor: "pointer", fontFamily: "inherit", fontSize: 9, fontWeight: 700, borderRadius: 3 }}>📥 DOWNLOAD PDF</button>
                      <button style={{ flex: 1, padding: "8px", background: `${C.purple}18`, border: `1px solid ${C.purple}44`, color: C.purple, cursor: "pointer", fontFamily: "inherit", fontSize: 9, fontWeight: 700, borderRadius: 3 }}>⛓️ MINT ON-CHAIN</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 9, color: "#1A3044", padding: "20px", textAlign: "center" }}>
                    Certificate data will appear here<br />after NFT generation
                  </div>
                )}
              </div>
            </div>
          )}


          {tab === "stats" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              {[
                { label: "SHIPMENTS CLEARED", value: stats.cleared, sub: "On-chain confirmations", color: C.green },
                { label: "AVG CLEARANCE TIME", value: "4.2 min", sub: "vs 3-5 days traditional", color: C.accent },
                { label: "FRAUD DETECTED", value: "3", sub: "Auto-rejected by AI", color: C.red },
                { label: "DUTIES CALCULATED", value: "€124,892", sub: "Auto-computed from TARIC", color: C.amber },
                { label: "BEZ FEES COLLECTED", value: `${stats.revenue} BEZ`, sub: `≈ $${(stats.revenue * (bridge.bezPrice || 0.0842)).toFixed(2)}`, color: "#FFD700" },
                { label: "AI ACCURACY", value: "96.4%", sub: "Document field extraction", color: C.purple },
              ].map(m => (
                <div key={m.label} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, padding: 18 }}>
                  <div style={{ fontSize: 8, color: "#1A3044", letterSpacing: 2, marginBottom: 8 }}>{m.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: m.color, marginBottom: 4 }}>{m.value}</div>
                  <div style={{ fontSize: 10, color: "#1A3044" }}>{m.sub}</div>
                </div>
              ))}

              <div style={{ gridColumn: "1 / -1", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4 }}>
                <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 10, letterSpacing: 2, color: C.accent }}>CLEARANCE DECISION BREAKDOWN</div>
                <div style={{ padding: 14, display: "flex", gap: 30, alignItems: "center" }}>
                  {[
                    { label: "APPROVED", pct: 72, color: C.green },
                    { label: "HELD", pct: 18, color: C.amber },
                    { label: "REJECTED", pct: 10, color: C.red },
                  ].map(b => (
                    <div key={b.label} style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 9, color: b.color, letterSpacing: 1 }}>{b.label}</span>
                        <span style={{ fontSize: 10, color: b.color, fontWeight: 700 }}>{b.pct}%</span>
                      </div>
                      <div style={{ height: 6, background: "#0A1A28", borderRadius: 3 }}>
                        <div style={{ height: "100%", width: `${b.pct}%`, background: b.color, borderRadius: 3, transition: "width 1s ease" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ gridColumn: "1 / -1", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, padding: 14 }}>
                <div style={{ fontSize: 10, color: C.accent, letterSpacing: 2, marginBottom: 14 }}>REVENUE PROJECTION — CUSTOMS CLEARANCE AGENT</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                  {[
                    { phase: "PILOT", vol: "10/day", rev: "€50–200/day", annual: "€18K–73K", note: "1 puerto español" },
                    { phase: "REGIONAL", vol: "100/day", rev: "€500–2K/day", annual: "€183K–730K", note: "Mediterráneo Oeste" },
                    { phase: "NATIONAL", vol: "1K/day", rev: "€5K–20K/day", annual: "€1.8M–7.3M", note: "España + Portugal" },
                    { phase: "EU SCALE", vol: "10K+/day", rev: "€50K+/day", annual: "€18M–80M", note: "Todos puertos EU" },
                  ].map(p => (
                    <div key={p.phase} style={{ padding: 12, background: "rgba(0,0,0,0.3)", borderRadius: 3, borderTop: `2px solid ${C.accent}` }}>
                      <div style={{ fontSize: 10, color: C.accent, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>{p.phase}</div>
                      <div style={{ fontSize: 9, color: "#1A3044" }}>VOLUME: {p.vol}</div>
                      <div style={{ fontSize: 9, color: "#1A3044", marginBottom: 4 }}>DAILY: {p.rev}</div>
                      <div style={{ fontSize: 12, color: C.amber, fontWeight: 700, marginBottom: 4 }}>{p.annual}/yr</div>
                      <div style={{ fontSize: 9, color: "#344A5E" }}>{p.note}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {tab === "metrics" && (
            <AgentDetailPanel agentId="customsclear" accentColor="#00B8D4" />
          )}
        </div>

        {/* LIVE LOG */}
        <div style={{ width: 270, flexShrink: 0, background: "#020B14", borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "7px 12px", borderBottom: `1px solid ${C.border}`, fontSize: 9, letterSpacing: 2, color: "#1A3044" }}>
            AGENT LOG <span style={{ color: C.green, animation: "blink 1.5s infinite" }}>●</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
            {log.map((entry, i) => (
              <div key={i} className="log-entry" style={{
                padding: "3px 12px", fontSize: 9.5, lineHeight: 1.6,
                color: i === 0 ? (entry.includes("✅") ? C.green : entry.includes("⚠️") ? C.amber : entry.includes("🚫") ? C.red : "#7A9BB5") : "#1A3044",
              }}>{entry}</div>
            ))}
          </div>
          <div style={{ padding: "10px 12px", borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 8, color: "#1A3044", letterSpacing: 1, marginBottom: 4 }}>SAFE WALLET / ESCROW</div>
            <div style={{ color: C.amber, fontWeight: 700 }}>0x3EfC...e8a3</div>
            <div style={{ fontSize: 8, color: "#1A3044", marginTop: 3 }}>$31.7M locked in escrow</div>
          </div>
        </div>
      </div>
    </div>
  );
}
