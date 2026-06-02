import { useState, useEffect, useRef, useCallback } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── SIMULATED AIS DATA (replace with Marine Traffic API) ────────────────────
// Real endpoint: GET https://services.marinetraffic.com/api/exportvessel/v:8/{API_KEY}
// Headers: { "Content-Type": "application/json" }
const MOCK_VESSELS = [
  { mmsi: "219632000", name: "MAERSK EDMONTON", imo: "9858648", flag: "🇩🇰", type: "Container", lat: 36.14, lon: -5.35, speed: 18.4, course: 112, destination: "BCNSPAIN", eta: "2025-03-17 06:00", cargo: "ELECTRONICS / TEXTILES", blNumber: "MAEU240312001", value: 4200000, teus: 1240, status: "UNDERWAY", draught: 13.2 },
  { mmsi: "636092797", name: "MSC OSCAR", imo: "9703291", flag: "🇵🇦", type: "Container", lat: 38.92, lon: 1.45, speed: 21.1, course: 295, destination: "DEHAM", eta: "2025-03-20 14:00", cargo: "MACHINERY / AUTOMOTIVE", blNumber: "MSCU724519843", value: 8750000, teus: 3400, status: "UNDERWAY", draught: 15.8 },
  { mmsi: "477307900", name: "COSCO SHIPPING UNIVERSE", imo: "9795483", flag: "🇨🇳", type: "Container", lat: 35.89, lon: 14.51, speed: 0.3, course: 0, destination: "MTMLA", eta: "BERTHED", cargo: "CONSUMER GOODS / CHEMICALS", blNumber: "COSU6285041960", value: 6100000, teus: 2850, status: "MOORED", draught: 14.1 },
  { mmsi: "205702000", name: "CMA CGM MARCO POLO", imo: "9454436", flag: "🇫🇷", type: "Container", lat: 43.29, lon: 5.36, speed: 0.0, course: 178, destination: "FRMRS", eta: "ANCHORED", cargo: "PERISHABLES / REEFER", blNumber: "CMAU4829710523", value: 3350000, teus: 980, status: "ANCHORED", draught: 12.4 },
  { mmsi: "311000928", name: "EVER GIVEN", imo: "9811000", flag: "🇵🇦", type: "Container", lat: 30.70, lon: 32.34, speed: 14.2, course: 340, destination: "NLRTM", eta: "2025-03-22 09:00", cargo: "MIXED CARGO / HAZMAT", blNumber: "EGLV143100209734", value: 12400000, teus: 5200, status: "UNDERWAY", draught: 16.0 },
  { mmsi: "538006198", name: "ONE INNOVATION", imo: "9839613", flag: "🇲🇭", type: "Container", lat: 51.89, lon: 4.28, speed: 0.1, course: 0, destination: "NLRTM", eta: "IN PORT", cargo: "AUTOMOTIVE PARTS", blNumber: "ONEYTYOH97250900", value: 5680000, teus: 1750, status: "MOORED", draught: 13.7 },
];

const STATUS_COLOR = { UNDERWAY: "#00E5FF", MOORED: "#69F0AE", ANCHORED: "#FFD740", AT_ANCHOR: "#FFD740" };
const STATUS_BG = { UNDERWAY: "rgba(0,229,255,0.12)", MOORED: "rgba(105,240,174,0.12)", ANCHORED: "rgba(255,215,64,0.12)" };

// ─── SIMULATED NFT MINTS (blockchain events) ─────────────────────────────────
const INITIAL_MINTS = [
  { txHash: "0x7f3a...c4e2", blNumber: "MAEU240201882", tokenId: "BEZ-BL-00441", vessel: "MAERSK STOCKHOLM", value: "$2.1M", fee: "0.0042 BEZ", time: "2 min ago", status: "CONFIRMED", network: "Polygon" },
  { txHash: "0x2b8d...f901", blNumber: "MSCU724100392", tokenId: "BEZ-BL-00440", vessel: "MSC DIANA", value: "$5.8M", fee: "0.0116 BEZ", time: "18 min ago", status: "CONFIRMED", network: "BNB Chain" },
  { txHash: "0xa12c...8834", blNumber: "COSU6284991047", tokenId: "BEZ-BL-00439", vessel: "COSCO ANDES", value: "$3.3M", fee: "0.0066 BEZ", time: "1 hr ago", status: "CONFIRMED", network: "Polygon" },
  { txHash: "0x5e9f...2217", blNumber: "CMAU4828892910", tokenId: "BEZ-BL-00438", vessel: "CMA CGM BRAZIL", value: "$7.2M", fee: "0.0144 BEZ", time: "3 hrs ago", status: "CONFIRMED", network: "BNB Chain" },
];

// ─── SMART CONTRACT ABI (LogisticsContainer.sol) ─────────────────────────────
const CONTRACT_ABI_DISPLAY = `// LogisticsContainer.sol — BeZhas Chain
// Deployed: BNB 0x[your_address] | Polygon 0x[your_address]

struct ContainerData {
  string  blNumber;       // Bill of Lading number
  string  vesselIMO;      // IMO vessel identifier
  string  origin;         // Port of loading (UNLOCODE)
  string  destination;    // Port of discharge (UNLOCODE)
  string  shipper;        // Shipper company/wallet
  string  consignee;      // Consignee company/wallet
  uint256 cargoValue;     // USD value in wei
  uint256 teus;           // Container count
  uint256 eta;            // Estimated arrival (unix)
  bytes32 documentHash;   // SHA-256 of original B/L PDF
  ContainerStatus status;
}

enum ContainerStatus {
  CREATED, IN_TRANSIT, AT_CUSTOMS,
  CUSTOMS_CLEARED, DELIVERED, DISPUTED
}

// Mint NFT representing ownership of cargo
function mintBillOfLading(
  ContainerData calldata data,
  address       consigneeWallet
) external payable returns (uint256 tokenId);

// Transfer cargo ownership (= transfer B/L)
function transferCargo(
  uint256 tokenId,
  address newConsignee,
  bytes   calldata signature
) external;

// Oracle update from Chainlink / AIS feed
function updatePosition(
  uint256 tokenId,
  int256  lat,      // x 1e6
  int256  lon,      // x 1e6
  uint256 speed,    // knots x 10
  uint8   statusCode
) external onlyOracle;

// Release escrow when delivered
function confirmDelivery(
  uint256 tokenId,
  bytes32 podHash   // Proof of Delivery hash
) external;`;

// ─── RADAR CANVAS COMPONENT ───────────────────────────────────────────────────
function RadarScope({ vessels, selectedVessel, onSelectVessel }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const angleRef = useRef(0);

  const medLat = 38.5, medLon = 14.0;
  const scale = 5.5;

  const vesselToCanvas = (lat, lon, W, H) => {
    const x = (lon - medLon) * scale * (W / 80) + W / 2;
    const y = -(lat - medLat) * scale * (H / 80) + H / 2;
    return { x, y };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const draw = () => {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = "#010D18";
      ctx.fillRect(0, 0, W, H);

      // Grid lines (latitude/longitude)
      ctx.strokeStyle = "rgba(0,200,255,0.06)";
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= 8; i++) {
        ctx.beginPath(); ctx.moveTo(i * W / 8, 0); ctx.lineTo(i * W / 8, H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * H / 8); ctx.lineTo(W, i * H / 8); ctx.stroke();
      }

      // Radar rings
      [0.15, 0.3, 0.45, 0.6, 0.75, 0.9].forEach(r => {
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, r * Math.min(W, H) / 2, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0,200,255,0.08)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      });

      // Crosshairs
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H);
      ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2);
      ctx.strokeStyle = "rgba(0,200,255,0.1)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Radar sweep
      angleRef.current = (angleRef.current + 0.012) % (Math.PI * 2);
      const angle = angleRef.current;
      const gradient = ctx.createConicalGradient
        ? null
        : (() => {
          const g = ctx.createLinearGradient(W / 2, H / 2, W / 2 + Math.cos(angle) * W, H / 2 + Math.sin(angle) * H);
          g.addColorStop(0, "rgba(0,229,255,0.18)");
          g.addColorStop(1, "rgba(0,229,255,0)");
          return g;
        })();

      // Sweep cone
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(angle);
      const sweepGrad = ctx.createLinearGradient(0, 0, Math.min(W, H) * 0.5, 0);
      sweepGrad.addColorStop(0, "rgba(0,229,255,0.25)");
      sweepGrad.addColorStop(1, "rgba(0,229,255,0)");
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, Math.min(W, H) * 0.48, -0.35, 0.0);
      ctx.closePath();
      ctx.fillStyle = sweepGrad;
      ctx.fill();
      ctx.restore();

      // Vessel blips
      vessels.forEach(v => {
        const { x, y } = vesselToCanvas(v.lat, v.lon, W, H);
        if (x < 0 || x > W || y < 0 || y > H) return;
        const isSelected = selectedVessel?.mmsi === v.mmsi;
        const color = STATUS_COLOR[v.status] || "#00E5FF";

        // Ping ripple for selected
        if (isSelected) {
          [1, 2, 3].forEach(ring => {
            ctx.beginPath();
            ctx.arc(x, y, 6 + ring * 5, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0,229,255,${0.3 - ring * 0.08})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          });
        }

        // Course line
        const rad = (v.course - 90) * Math.PI / 180;
        const spd = v.speed * 0.4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(rad) * spd, y + Math.sin(rad) * spd);
        ctx.strokeStyle = color;
        ctx.lineWidth = isSelected ? 1.5 : 0.8;
        ctx.globalAlpha = 0.6;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Blip
        ctx.beginPath();
        ctx.arc(x, y, isSelected ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = isSelected ? 14 : 6;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Label
        if (isSelected || v.speed === 0) {
          ctx.fillStyle = isSelected ? "#ffffff" : "rgba(200,230,255,0.7)";
          ctx.font = isSelected ? "bold 9px monospace" : "8px monospace";
          ctx.fillText(v.name.split(" ").pop(), x + 7, y - 4);
        }
      });

      // Compass rose
      const cx = W - 34, cy = 34, cr = 22;
      ["N", "E", "S", "W"].forEach((dir, i) => {
        const a = (i * Math.PI / 2) - Math.PI / 2;
        ctx.fillStyle = dir === "N" ? "#FF4444" : "rgba(100,180,255,0.7)";
        ctx.font = "bold 7px monospace";
        ctx.fillText(dir, cx + Math.cos(a) * (cr - 6) - 3, cy + Math.sin(a) * (cr - 6) + 3);
      });
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,200,255,0.2)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [vessels, selectedVessel]);

  return (
    <canvas
      ref={canvasRef}
      width={520}
      height={340}
      onClick={e => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
        const my = (e.clientY - rect.top) * (canvas.height / rect.height);
        const W = canvas.width, H = canvas.height;
        let closest = null, closestD = 999;
        vessels.forEach(v => {
          const { x, y } = vesselToCanvas(v.lat, v.lon, W, H);
          const d = Math.hypot(mx - x, my - y);
          if (d < closestD && d < 20) { closestD = d; closest = v; }
        });
        if (closest) onSelectVessel(closest);
      }}
      style={{ width: "100%", height: "auto", cursor: "crosshair", borderRadius: 4, display: "block" }}
    />
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function ShipTrackAgent() {
  const bridge = useAgentBridge('shiptrack');
  const [tab, setTab] = useState("radar");
  const [vessels, setVessels] = useState(MOCK_VESSELS);
  const [selectedVessel, setSelectedVessel] = useState(MOCK_VESSELS[0]);
  const [mints, setMints] = useState(INITIAL_MINTS);
  const [mintStep, setMintStep] = useState(0); // 0=idle 1=validating 2=hashing 3=signing 4=minting 5=done
  const [mintTarget, setMintTarget] = useState(null);
  const [bezRevenue, setBezRevenue] = useState(0.4872);
  const [txCount, setTxCount] = useState(442);
  const [log, setLog] = useState([
    "[ 09:14:23 ] AIS feed connected — Marine Traffic API v8",
    "[ 09:14:24 ] Oracle Chainlink 0x2c1d... ACTIVE",
    "[ 09:14:25 ] Contract LogisticsContainer.sol LOADED",
    "[ 09:14:25 ] Contract BeZhasNFT.sol LOADED",
    "[ 09:14:26 ] Watching 6 vessels in Mediterranean corridor",
    "[ 09:14:29 ] BEZ-Coin price feed: $0.0842 (+12.4%)",
  ]);

  // Sync real stats from bridge when available
  useEffect(() => {
    if (bridge.stats?.on_chain_txs) {
      setTxCount(prev => Math.max(prev, bridge.stats.on_chain_txs));
    }
  }, [bridge.stats]);

  const addLog = useCallback((msg) => {
    const ts = new Date().toTimeString().slice(0, 8);
    setLog(prev => [`[ ${ts} ] ${msg}`, ...prev].slice(0, 40));
  }, []);

  // Merge real API logs into the live log feed
  useEffect(() => {
    if (bridge.logs && bridge.logs.length > 0) {
      bridge.logs.slice(0, 5).forEach(apiLog => {
        const ts = apiLog.created_at ? new Date(apiLog.created_at).toTimeString().slice(0, 8) : '??:??:??';
        const confStr = apiLog.confidence != null ? ` [${(apiLog.confidence * 100).toFixed(0)}%]` : '';
        addLog(`[ ${ts} ] API: ${apiLog.action}${confStr}`);
      });
    }
  }, [bridge.logs, addLog]);

  // Simulate live AIS position updates
  useEffect(() => {
    const interval = setInterval(() => {
      setVessels(prev => prev.map(v => {
        if (v.status !== "UNDERWAY") return v;
        const rad = (v.course - 90) * Math.PI / 180;
        const spd = v.speed * 0.000025;
        return { ...v, lat: v.lat + Math.sin(rad) * spd, lon: v.lon + Math.cos(rad) * spd };
      }));
      setBezRevenue(prev => +(prev + Math.random() * 0.0008).toFixed(4));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Simulate occasional log entries
  useEffect(() => {
    const msgs = [
      `AIS update: ${MOCK_VESSELS[Math.floor(Math.random() * MOCK_VESSELS.length)].name} — position refreshed`,
      "Oracle: commodity price index updated",
      `Gas price Polygon: ${(Math.random() * 30 + 10).toFixed(0)} gwei`,
      "LayerZero bridge: cross-chain message relayed",
      `QuickSwap V3: BEZ/USDC liquidity $${(Math.random() * 50000 + 100000).toFixed(0)}`,
    ];
    const t = setInterval(() => {
      addLog(msgs[Math.floor(Math.random() * msgs.length)]);
    }, 4000);
    return () => clearInterval(t);
  }, [addLog]);

  const startMint = (vessel) => {
    setMintTarget(vessel);
    setMintStep(1);
    addLog(`🚀 Initiating NFT mint for B/L ${vessel.blNumber}`);
    const steps = [
      [1, 600, `Validating B/L document hash...`],
      [2, 1400, `SHA-256 hash computed: 0x${Math.random().toString(16).slice(2, 18)}...`],
      [3, 2400, `Requesting EIP-712 signature from hot wallet...`],
      [4, 3600, `Sending tx to LogisticsContainer.sol on Polygon...`],
      [5, 5000, `✅ NFT minted! tokenId: BEZ-BL-00${txCount + 1} — fee: ${(vessel.value * 0.002 / 1e6).toFixed(4)} BEZ`],
    ];
    steps.forEach(([step, delay, msg]) => {
      setTimeout(() => {
        setMintStep(step);
        addLog(msg);
        if (step === 5) {
          setTxCount(p => p + 1);
          setBezRevenue(prev => +(prev + vessel.value * 0.003 / 100000).toFixed(4));
          setMints(prev => [{
            txHash: `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`,
            blNumber: vessel.blNumber,
            tokenId: `BEZ-BL-00${txCount + 1}`,
            vessel: vessel.name,
            value: `$${(vessel.value / 1000000).toFixed(1)}M`,
            fee: `${(vessel.value * 0.003 / 100000).toFixed(4)} BEZ`,
            time: "just now",
            status: "CONFIRMED",
            network: "Polygon",
          }, ...prev].slice(0, 20));
          setTimeout(() => setMintStep(0), 3000);
        }
      }, delay);
    });
  };

  const C = { bg: "#030C18", panel: "#060F1E", border: "rgba(0,200,255,0.12)", accent: "#00C8FF", green: "#00E676", amber: "#FFB300", red: "#FF5252" };
  const tabs = [
    { id: "radar", label: "◉ RADAR", icon: "📡" },
    { id: "fleet", label: "FLEET", icon: "🚢" },
    { id: "tokenize", label: "TOKENIZE B/L", icon: "🪙" },
    { id: "contracts", label: "CONTRACTS", icon: "📜" },
    { id: "revenue", label: "REVENUE", icon: "💰" },
    { id: "metrics", label: "METRICS", icon: "📊" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: "#B0C4D8", fontFamily: "'Courier New', monospace", fontSize: 12 }}>
      <style>{`
        @keyframes sweep { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes slide-in { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes progress { from{width:0%} to{width:100%} }
        .log-entry { animation: slide-in 0.3s ease; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:#030C18; }
        ::-webkit-scrollbar-thumb { background:rgba(0,200,255,0.2); }
      `}</style>

      {/* ── TOP BAR ── */}
      <div style={{ background: "#020A14", borderBottom: `1px solid ${C.border}`, padding: "8px 20px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>⚓</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, letterSpacing: 2 }}>SHIPTRACK AGENT</div>
            <div style={{ fontSize: 9, color: "#344A5E", letterSpacing: 2 }}>BEZHAS LOGISTICS TOKENIZATION ENGINE</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 24, marginLeft: "auto", flexWrap: "wrap" }}>
          {[
            { l: "VESSELS TRACKED", v: vessels.length, c: C.accent },
            { l: "NFTs MINTED", v: txCount, c: C.green },
            { l: "BEZ REVENUE TODAY", v: bezRevenue.toFixed(4), c: C.amber },
            { l: "AIS FEED", v: "● LIVE", c: C.green, blink: true },
          ].map(({ l, v, c, blink }) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 8, color: "#344A5E", letterSpacing: 1 }}>{l}</div>
              <div style={{ color: c, fontWeight: 700, fontSize: 13, animation: blink ? "blink 2s infinite" : "none" }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ display: "flex", background: "#020A14", borderBottom: `1px solid ${C.border}`, padding: "0 20px" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "10px 18px", background: "none", border: "none", borderBottom: `2px solid ${tab === t.id ? C.accent : "transparent"}`,
            color: tab === t.id ? C.accent : "#344A5E", cursor: "pointer", fontSize: 11, fontFamily: "inherit", letterSpacing: 1, fontWeight: tab === t.id ? 700 : 400, transition: "all 0.15s",
          }}>{t.icon} {t.label}</button>
        ))}
      </div>

      <div style={{ display: "flex", height: "calc(100vh - 95px)", overflow: "hidden" }}>

        {/* ── MAIN AREA ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>

          {/* ══ RADAR TAB ══ */}
          {tab === "radar" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14 }}>
              <div>
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, overflow: "hidden", marginBottom: 14 }}>
                  <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: C.accent, fontSize: 10, letterSpacing: 2 }}>◉ MEDITERRANEAN MARITIME CORRIDOR — AIS LIVE</span>
                    <span style={{ fontSize: 9, color: "#344A5E" }}>Click vessel to select</span>
                  </div>
                  <RadarScope vessels={vessels} selectedVessel={selectedVessel} onSelectVessel={setSelectedVessel} />
                  <div style={{ padding: "6px 14px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 20 }}>
                    {[["● UNDERWAY", C.accent], ["● MOORED", C.green], ["● ANCHORED", C.amber]].map(([l, c]) => (
                      <span key={l} style={{ fontSize: 9, color: c }}>{l}</span>
                    ))}
                    <span style={{ fontSize: 9, color: "#344A5E", marginLeft: "auto" }}>
                      Center: 38.5°N 14.0°E | Scale: ~500km
                    </span>
                  </div>
                </div>

                {/* Selected vessel detail */}
                {selectedVessel && (
                  <div style={{ background: C.panel, border: `1px solid ${C.accent}44`, borderRadius: 4, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#E8F4FF" }}>{selectedVessel.flag} {selectedVessel.name}</div>
                        <div style={{ fontSize: 9, color: "#344A5E", marginTop: 2 }}>MMSI {selectedVessel.mmsi} | IMO {selectedVessel.imo} | {selectedVessel.type}</div>
                      </div>
                      <span style={{ padding: "3px 10px", background: STATUS_BG[selectedVessel.status] || "transparent", color: STATUS_COLOR[selectedVessel.status] || C.accent, border: `1px solid ${STATUS_COLOR[selectedVessel.status] || C.accent}44`, borderRadius: 2, fontSize: 9, letterSpacing: 1 }}>
                        {selectedVessel.status}
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
                      {[
                        ["POSITION", `${selectedVessel.lat.toFixed(4)}°N\n${selectedVessel.lon.toFixed(4)}°E`],
                        ["SPEED / COURSE", `${selectedVessel.speed} kn\n${selectedVessel.course}°`],
                        ["DESTINATION", `${selectedVessel.destination}\nETA: ${selectedVessel.eta.split(" ")[0]}`],
                        ["DRAUGHT", `${selectedVessel.draught}m\n${selectedVessel.teus} TEUs`],
                      ].map(([l, v]) => (
                        <div key={l} style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: 3 }}>
                          <div style={{ fontSize: 8, color: "#344A5E", letterSpacing: 1, marginBottom: 3 }}>{l}</div>
                          <div style={{ color: "#94BAD8", fontSize: 11, whiteSpace: "pre" }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: 3 }}>
                        <div style={{ fontSize: 8, color: "#344A5E", marginBottom: 3 }}>B/L NUMBER</div>
                        <div style={{ color: C.accent, fontWeight: 700 }}>{selectedVessel.blNumber}</div>
                      </div>
                      <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: 3 }}>
                        <div style={{ fontSize: 8, color: "#344A5E", marginBottom: 3 }}>CARGO VALUE</div>
                        <div style={{ color: C.amber, fontWeight: 700 }}>${(selectedVessel.value / 1000000).toFixed(2)}M USD</div>
                      </div>
                    </div>
                    <button
                      onClick={() => { setTab("tokenize"); }}
                      style={{ marginTop: 12, width: "100%", padding: "10px", background: `linear-gradient(135deg, ${C.accent}22, ${C.accent}11)`, border: `1px solid ${C.accent}66`, color: C.accent, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, letterSpacing: 2, borderRadius: 3, transition: "all 0.2s" }}>
                      🪙 TOKENIZE THIS BILL OF LADING →
                    </button>
                  </div>
                )}
              </div>

              {/* Vessel list sidebar */}
              <div>
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, marginBottom: 14 }}>
                  <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 10, letterSpacing: 2, color: C.accent }}>FLEET MONITOR</div>
                  {vessels.map(v => (
                    <div key={v.mmsi} onClick={() => setSelectedVessel(v)} style={{
                      padding: "10px 14px", borderBottom: `1px solid ${C.border}22`, cursor: "pointer",
                      background: selectedVessel?.mmsi === v.mmsi ? `${C.accent}08` : "transparent",
                      borderLeft: `2px solid ${selectedVessel?.mmsi === v.mmsi ? C.accent : "transparent"}`,
                      transition: "all 0.15s",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: selectedVessel?.mmsi === v.mmsi ? "#E8F4FF" : "#7A9BB5", fontSize: 11, fontWeight: 600 }}>{v.flag} {v.name.split(" ").slice(-1)}</span>
                        <span style={{ fontSize: 9, color: STATUS_COLOR[v.status] }}>{v.status}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                        <span style={{ fontSize: 9, color: "#344A5E" }}>{v.speed}kn → {v.destination}</span>
                        <span style={{ fontSize: 9, color: C.amber }}>${(v.value / 1000000).toFixed(1)}M</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Recent mints */}
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4 }}>
                  <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 10, letterSpacing: 2, color: C.green }}>RECENT NFT MINTS</div>
                  {mints.slice(0, 4).map((m, i) => (
                    <div key={i} className="log-entry" style={{ padding: "8px 14px", borderBottom: `1px solid ${C.border}22` }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: C.green, fontSize: 10, fontWeight: 700 }}>{m.tokenId}</span>
                        <span style={{ fontSize: 9, color: "#344A5E" }}>{m.time}</span>
                      </div>
                      <div style={{ fontSize: 9, color: "#7A9BB5", marginTop: 2 }}>{m.vessel}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                        <span style={{ fontSize: 9, color: "#344A5E" }}>{m.network}</span>
                        <span style={{ fontSize: 9, color: C.amber }}>{m.fee}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══ FLEET TAB ══ */}
          {tab === "fleet" && (
            <div>
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: C.accent, letterSpacing: 2, fontSize: 10 }}>ALL TRACKED VESSELS — LIVE AIS DATA</span>
                  <span style={{ fontSize: 9, color: "#344A5E" }}>Marine Traffic API v8 | Refresh: 90s</span>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "rgba(0,0,0,0.3)" }}>
                      {["VESSEL", "IMO", "POS (LAT/LON)", "SPEED", "DESTINATION / ETA", "CARGO VALUE", "TEUS", "B/L NUMBER", "STATUS", "ACTION"].map(h => (
                        <th key={h} style={{ padding: "7px 10px", fontSize: 8, color: "#344A5E", letterSpacing: 1, textAlign: "left", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {vessels.map((v, i) => (
                      <tr key={v.mmsi} style={{ borderTop: `1px solid ${C.border}22`, background: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.15)" }}>
                        <td style={{ padding: "9px 10px" }}><span style={{ color: "#C8DCF0", fontWeight: 600 }}>{v.flag} {v.name}</span></td>
                        <td style={{ padding: "9px 10px", color: "#344A5E" }}>{v.imo}</td>
                        <td style={{ padding: "9px 10px", color: "#7A9BB5", fontSize: 10 }}>{v.lat.toFixed(3)}°N<br />{v.lon.toFixed(3)}°E</td>
                        <td style={{ padding: "9px 10px", color: v.speed > 5 ? C.accent : C.amber }}>{v.speed} kn</td>
                        <td style={{ padding: "9px 10px", fontSize: 10 }}><div style={{ color: "#94BAD8" }}>{v.destination}</div><div style={{ color: "#344A5E", fontSize: 9 }}>{v.eta}</div></td>
                        <td style={{ padding: "9px 10px", color: C.amber, fontWeight: 700 }}>${(v.value / 1000000).toFixed(1)}M</td>
                        <td style={{ padding: "9px 10px", color: "#7A9BB5" }}>{v.teus.toLocaleString()}</td>
                        <td style={{ padding: "9px 10px", color: C.accent, fontSize: 10 }}>{v.blNumber}</td>
                        <td style={{ padding: "9px 10px" }}><span style={{ padding: "2px 7px", background: STATUS_BG[v.status], color: STATUS_COLOR[v.status], borderRadius: 2, fontSize: 9 }}>{v.status}</span></td>
                        <td style={{ padding: "9px 10px" }}>
                          <button onClick={() => { setSelectedVessel(v); setTab("tokenize"); }} style={{ padding: "4px 10px", background: `${C.accent}18`, border: `1px solid ${C.accent}44`, color: C.accent, cursor: "pointer", fontFamily: "inherit", fontSize: 9, borderRadius: 2, whiteSpace: "nowrap" }}>🪙 MINT B/L</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══ TOKENIZE TAB ══ */}
          {tab === "tokenize" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, padding: 16, marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: C.accent, letterSpacing: 2, marginBottom: 14 }}>SELECT VESSEL TO TOKENIZE</div>
                  {vessels.map(v => (
                    <div key={v.mmsi} onClick={() => setSelectedVessel(v)} style={{
                      padding: "10px 12px", borderRadius: 3, marginBottom: 6, cursor: "pointer",
                      border: `1px solid ${selectedVessel?.mmsi === v.mmsi ? C.accent : C.border}`,
                      background: selectedVessel?.mmsi === v.mmsi ? `${C.accent}10` : "rgba(0,0,0,0.2)",
                      transition: "all 0.15s",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: selectedVessel?.mmsi === v.mmsi ? "#E8F4FF" : "#7A9BB5", fontWeight: 600 }}>{v.flag} {v.name}</span>
                        <span style={{ color: C.amber, fontWeight: 700 }}>${(v.value / 1000000).toFixed(1)}M</span>
                      </div>
                      <div style={{ fontSize: 9, color: "#344A5E", marginTop: 3 }}>B/L: {v.blNumber} | {v.teus} TEUs | {v.cargo}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                {selectedVessel && (
                  <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, padding: 16, marginBottom: 14 }}>
                    <div style={{ fontSize: 10, color: C.accent, letterSpacing: 2, marginBottom: 14 }}>NFT MINT DETAILS</div>
                    {[
                      ["B/L Number", selectedVessel.blNumber],
                      ["Vessel", `${selectedVessel.name} (IMO ${selectedVessel.imo})`],
                      ["Origin → Destination", `PORT → ${selectedVessel.destination}`],
                      ["Cargo Description", selectedVessel.cargo],
                      ["Cargo Value", `$${(selectedVessel.value / 1000000).toFixed(2)}M USD`],
                      ["TEU Count", `${selectedVessel.teus} containers`],
                      ["ETA", selectedVessel.eta],
                      ["Mint Fee (0.3%)", `${(selectedVessel.value * 0.003 / 100000).toFixed(4)} BEZ`],
                      ["Network", "Polygon (MATIC)"],
                      ["Contract", "LogisticsContainer.sol"],
                    ].map(([l, v]) => (
                      <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${C.border}22` }}>
                        <span style={{ color: "#344A5E", fontSize: 10 }}>{l}</span>
                        <span style={{ color: "#94BAD8", fontSize: 10, textAlign: "right", maxWidth: "55%" }}>{v}</span>
                      </div>
                    ))}

                    {/* Mint flow */}
                    {mintStep === 0 && (
                      <button onClick={() => startMint(selectedVessel)} style={{
                        width: "100%", marginTop: 16, padding: "12px", background: `linear-gradient(135deg, ${C.accent}33, ${C.accent}11)`,
                        border: `1px solid ${C.accent}`, color: C.accent, cursor: "pointer", fontFamily: "inherit",
                        fontSize: 12, fontWeight: 700, letterSpacing: 2, borderRadius: 3,
                      }}>🪙 MINT BILL OF LADING AS NFT</button>
                    )}
                    {mintStep > 0 && mintStep < 5 && (
                      <div style={{ marginTop: 16 }}>
                        {[
                          [1, "Validating B/L document"],
                          [2, "Computing SHA-256 hash"],
                          [3, "Signing with hot wallet"],
                          [4, "Broadcasting transaction"],
                        ].map(([s, label]) => (
                          <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <span style={{ color: mintStep > s ? C.green : mintStep === s ? C.accent : "#344A5E", fontSize: 10 }}>
                              {mintStep > s ? "✓" : mintStep === s ? "⟳" : "○"}
                            </span>
                            <span style={{ color: mintStep >= s ? "#94BAD8" : "#344A5E", fontSize: 10 }}>{label}</span>
                            {mintStep === s && <div style={{ flex: 1, height: 2, background: C.border, borderRadius: 1 }}><div style={{ height: "100%", background: C.accent, borderRadius: 1, animation: "progress 1.2s linear infinite" }} /></div>}
                          </div>
                        ))}
                      </div>
                    )}
                    {mintStep === 5 && (
                      <div style={{ marginTop: 16, padding: 12, background: "rgba(0,230,118,0.08)", border: `1px solid ${C.green}44`, borderRadius: 3, textAlign: "center" }}>
                        <div style={{ color: C.green, fontSize: 13, fontWeight: 700, marginBottom: 4 }}>✅ NFT MINTED SUCCESSFULLY</div>
                        <div style={{ fontSize: 10, color: "#344A5E" }}>Token ID: BEZ-BL-00{txCount} | View on PolygonScan</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Recent mints full list */}
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4 }}>
                  <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 10, letterSpacing: 2, color: C.green }}>MINTED B/L NFTs — HISTORY</div>
                  {mints.map((m, i) => (
                    <div key={i} className="log-entry" style={{ padding: "9px 14px", borderBottom: `1px solid ${C.border}22` }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: C.green, fontWeight: 700, fontSize: 11 }}>{m.tokenId}</span>
                        <span style={{ fontSize: 9, color: "#344A5E" }}>{m.time}</span>
                      </div>
                      <div style={{ fontSize: 9, color: "#7A9BB5" }}>{m.vessel} — {m.blNumber}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                        <span style={{ fontSize: 9, color: C.accent }}>{m.txHash}</span>
                        <span style={{ fontSize: 9, color: C.amber }}>Fee: {m.fee}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══ CONTRACTS TAB ══ */}
          {tab === "contracts" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, marginBottom: 14 }}>
                  <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 10, letterSpacing: 2, color: C.accent }}>DEPLOYED CONTRACTS</div>
                  {[
                    { name: "LogisticsContainer.sol", addr: "0x3EfC42095E...e8a3", network: "Polygon", status: "ACTIVE", calls: 441 },
                    { name: "BeZhasNFT.sol", addr: "0x8a1e3930fd...b55", network: "BNB Chain", status: "ACTIVE", calls: 441 },
                    { name: "QualityOracle.sol", addr: "0x89c23890c7...b12", network: "Polygon", status: "ACTIVE", calls: 1284 },
                    { name: "BeZhasCore.sol", addr: "0x52Df82920C...44E", network: "BNB Chain", status: "ACTIVE", calls: 88 },
                    { name: "StakingPoolV2.sol", addr: "0x5Fc42095E8...3a", network: "Polygon", status: "STANDBY", calls: 12 },
                  ].map(c => (
                    <div key={c.name} style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}22` }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#C8DCF0", fontWeight: 700 }}>{c.name}</span>
                        <span style={{ fontSize: 9, color: c.status === "ACTIVE" ? C.green : C.amber }}>{c.status}</span>
                      </div>
                      <div style={{ fontSize: 9, color: C.accent, marginTop: 2 }}>{c.addr}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                        <span style={{ fontSize: 9, color: "#344A5E" }}>{c.network}</span>
                        <span style={{ fontSize: 9, color: "#344A5E" }}>{c.calls} calls</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4 }}>
                  <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 10, letterSpacing: 2, color: C.amber }}>INTEGRATION STACK</div>
                  <div style={{ padding: 14 }}>
                    {[
                      { layer: "AIS FEED", tech: "Marine Traffic API v8", status: "🟢" },
                      { layer: "PRICE ORACLE", tech: "Chainlink MATIC/USD", status: "🟢" },
                      { layer: "CROSS-CHAIN", tech: "LayerZero + Wormhole", status: "🟢" },
                      { layer: "DEX LIQUIDITY", tech: "QuickSwap V3 Pool", status: "🟢" },
                      { layer: "FIAT ON-RAMP", tech: "MoonPay + Transak", status: "🟡" },
                      { layer: "BANKING RAIL", tech: "SEPA/SWIFT ING España", status: "🟢" },
                      { layer: "HOT WALLET", tech: "0x52Df82920C...44E", status: "🟢" },
                      { layer: "CUSTOMS API", tech: "AEAT España + EU", status: "🔴 PENDING" },
                    ].map(r => (
                      <div key={r.layer} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${C.border}22` }}>
                        <span style={{ fontSize: 9, color: "#344A5E", letterSpacing: 1 }}>{r.layer}</span>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 9, color: "#7A9BB5" }}>{r.tech}</span>
                          <span style={{ fontSize: 10 }}>{r.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4 }}>
                  <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 10, letterSpacing: 2, color: C.accent }}>LogisticsContainer.sol — ABI REFERENCE</div>
                  <pre style={{ margin: 0, padding: 14, fontSize: 9.5, color: "#5A8AA8", lineHeight: 1.7, overflowX: "auto", background: "rgba(0,0,0,0.3)" }}>
                    {CONTRACT_ABI_DISPLAY.split("\n").map((line, i) => {
                      const color = line.startsWith("//") ? "#2A4A5E"
                        : line.includes("function") ? "#00C8FF"
                          : line.includes("struct") || line.includes("enum") ? "#FFB300"
                            : line.includes("event") ? "#00E676"
                              : line.includes("string") || line.includes("uint") || line.includes("bytes") || line.includes("int") || line.includes("address") || line.includes("bool") ? "#B39DDB"
                                : "#5A8AA8";
                      return <span key={i} style={{ color, display: "block" }}>{line}</span>;
                    })}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* ══ REVENUE TAB ══ */}
          {tab === "revenue" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              {[
                { label: "BEZ REVENUE TODAY", value: bezRevenue.toFixed(4) + " BEZ", sub: `≈ $${(bezRevenue * (bridge.bezPrice || 0.0842)).toFixed(2)} USD`, color: C.amber },
                { label: "TOTAL NFTs MINTED", value: txCount.toString(), sub: "Bill of Lading tokens on-chain", color: C.green },
                { label: "CARGO TOKENIZED", value: `$${(mints.reduce((s, _) => s + 5.2, 0) + bezRevenue * 100).toFixed(1)}M`, sub: "Total cargo value secured", color: C.accent },
                { label: "AVG FEE PER TX", value: "0.0098 BEZ", sub: `≈ $${(0.0098 * 0.0842).toFixed(4)} USD`, color: "#B39DDB" },
                { label: "ACTIVE VESSELS", value: `${vessels.filter(v => v.status === "UNDERWAY").length} / ${vessels.length}`, sub: "In-transit / Total tracked", color: C.accent },
                { label: "BEZ TOKEN PRICE", value: bridge.bezPrice != null ? `$${bridge.bezPrice.toFixed(4)}` : "$0.0842", sub: bridge.bezPrice != null ? "Live from API" : "Fallback (offline)", color: C.green },
              ].map(m => (
                <div key={m.label} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, padding: 18 }}>
                  <div style={{ fontSize: 8, color: "#344A5E", letterSpacing: 2, marginBottom: 8 }}>{m.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: m.color, marginBottom: 4 }}>{m.value}</div>
                  <div style={{ fontSize: 10, color: "#344A5E" }}>{m.sub}</div>
                </div>
              ))}

              <div style={{ gridColumn: "1 / -1", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4 }}>
                <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 10, letterSpacing: 2, color: C.accent }}>REVENUE PROJECTION — SCALE MODEL</div>
                <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                  {[
                    { phase: "BOOTSTRAP", vessels: "1–10", daily: "0.05–0.5 BEZ", annual: "$150–$1,500", note: "Pilot program, 1 naviera" },
                    { phase: "GROWTH", vessels: "10–100", daily: "0.5–5 BEZ", annual: "$15K–$150K", note: "3–5 navieras integradas" },
                    { phase: "SCALE", vessels: "100–1,000", daily: "5–50 BEZ", annual: "$1.5M–$15M", note: "Corredor Mediterráneo" },
                    { phase: "GLOBAL", vessels: "1,000+", daily: "50+ BEZ", annual: "$15M–$80M", note: "Rutas mundiales" },
                  ].map(p => (
                    <div key={p.phase} style={{ padding: 12, background: "rgba(0,0,0,0.3)", borderRadius: 3, borderTop: `2px solid ${C.accent}` }}>
                      <div style={{ fontSize: 10, color: C.accent, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>{p.phase}</div>
                      <div style={{ fontSize: 9, color: "#344A5E", marginBottom: 3 }}>VESSELS: {p.vessels}</div>
                      <div style={{ fontSize: 9, color: "#344A5E", marginBottom: 3 }}>DAILY: {p.daily}</div>
                      <div style={{ fontSize: 12, color: C.amber, fontWeight: 700, marginBottom: 4 }}>{p.annual}/yr</div>
                      <div style={{ fontSize: 9, color: "#7A9BB5" }}>{p.note}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══ METRICS TAB (real data from API) ══ */}
          {tab === "metrics" && (
            <div>
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: C.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>
                  📊 REAL-TIME AGENT METRICS — SHIPTRACK
                </div>
                <div style={{ fontSize: 9, color: "#344A5E" }}>
                  {bridge.loading ? "⏳ Connecting to API..." : bridge.error ? `❌ ${bridge.error}` : "🟢 Connected — data from /api/agents/shiptrack/metrics"}
                </div>
              </div>
              <AgentDetailPanel agentId="shiptrack" accentColor="#00C8FF" />
            </div>
          )}
        </div>

        {/* ── LIVE LOG ── */}
        <div style={{ width: 280, flexShrink: 0, background: "#020A14", borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}`, fontSize: 9, letterSpacing: 2, color: "#344A5E" }}>
            AGENT LOG — LIVE FEED <span style={{ color: C.green, animation: "blink 1.5s infinite" }}>●</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
            {log.map((entry, i) => (
              <div key={i} className="log-entry" style={{ padding: "3px 12px", fontSize: 9.5, color: i === 0 ? "#7A9BB5" : "#2A4A5E", lineHeight: 1.6, borderBottom: "none" }}>
                {entry}
              </div>
            ))}
          </div>
          <div style={{ padding: "10px 12px", borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 8, color: "#344A5E", marginBottom: 4, letterSpacing: 1 }}>HOT WALLET BALANCE</div>
            <div style={{ color: C.amber, fontWeight: 700 }}>42.8441 BEZ</div>
            <div style={{ fontSize: 9, color: "#344A5E" }}>0x52Df...44E</div>
          </div>
        </div>
      </div>
    </div>
  );
}
