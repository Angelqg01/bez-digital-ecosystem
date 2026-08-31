import React, { useState, useEffect, useRef } from 'react';
import { useBEZBalance } from '@bezhas/platform-sdk/wallet';

// Diseño basado en stitch_payment_successful/bezhas_pay_system.jsx
const C = {
  surf: "#070D1C",
  border: "#0D2040",
  mono: "'JetBrains Mono','Courier New',monospace",
};

const TOKENS = [
  { s: "BEZ", n: "BEZ-Coin", icon: "🪙", color: "#FFB800" }, // Gold
  { s: "USDT", n: "Tether", icon: "₮", color: "#26A17B" },
  { s: "USDC", n: "USD Coin", icon: "$", color: "#2775CA" },
  { s: "MATIC", n: "Polygon", icon: "⬟", color: "#8247E5" },
  { s: "ETH", n: "Ethereum", icon: "⬡", color: "#627EEA" },
];

export default function LiveTicker() {
  const { usd_value } = useBEZBalance();
  const [prices, setPrices] = useState({ BEZ: usd_value || 1.24, USDT: 1.0, USDC: 1.0, MATIC: 0.88, ETH: 3420 });
  const [dirs, setDirs] = useState({});
  const prev = useRef({ ...prices });

  useEffect(() => {
    if (usd_value) {
      setPrices(p => ({ ...p, BEZ: usd_value }));
    }
  }, [usd_value]);

  useEffect(() => {
    // Simulación de fluctuaciones menores para tokens no-stables (diseño original)
    const iv = setInterval(() => {
      const n = { ...prices }, d = {};
      Object.keys(n).forEach(k => {
        if (!["USDT", "USDC", "BEZ"].includes(k)) {
          const delta = (Math.random() - 0.498) * 0.008;
          n[k] = Math.max(0.0001, +(n[k] * (1 + delta)).toFixed(8));
        }
        d[k] = n[k] >= (prev.current[k] || n[k]) ? "up" : "dn";
      });
      prev.current = n;
      setPrices(n);
      setDirs(d);
    }, 2500);
    return () => clearInterval(iv);
  }, [prices]);

  return (
    <div style={{ background: C.surf, borderBottom: `1px solid ${C.border}`, padding: "6px 0", marginBottom: "1rem", borderRadius: "8px" }}>
      <div style={{ display: "flex", gap: 22, padding: "0 14px", overflowX: "auto", scrollbarWidth: "none", whiteSpace: "nowrap" }}>
        {TOKENS.map(tok => {
          const p = prices[tok.s] || 0;
          const up = dirs[tok.s] === "up" || dirs[tok.s] === undefined;
          return (
            <span key={tok.s} style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <span style={{ fontSize: 11 }}>{tok.icon}</span>
              <span style={{ color: tok.color, fontFamily: C.mono, fontSize: 10, fontWeight: 800 }}>
                {tok.s === "BEZ" ? "🪙BEZ" : tok.s}
              </span>
              <span style={{ color: up ? "#10B981" : "#EF4444", fontFamily: C.mono, fontSize: 11, transition: "color 0.25s" }}>
                {p >= 1 ? "$" + p.toFixed(2) : "$" + p.toFixed(5)}
              </span>
              <span style={{ fontSize: 7, color: up ? "#10B981" : "#EF4444" }}>{up ? "▲" : "▼"}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
