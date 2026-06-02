import React from 'react';

// ─── DESIGN TOKENS — BeZhas Brand ─────────────────────────────────────────
export const C = {
  bg:        "#03060E",
  surf:      "#070D1C",
  card:      "#0C1628",
  card2:     "#101E38",
  card3:     "#142444",
  border:    "#0D2040",
  border2:   "#163560",
  border3:   "#1E4A8A",
  // Brand
  primary:   "#00C896",
  primary2:  "#00A87E",
  gold:      "#FFB800",
  gold2:     "#CC9200",
  neon:      "#00FFB2",
  // Accents
  blue:      "#2563EB",
  violet:    "#7C3AED",
  pink:      "#EC4899",
  orange:    "#F97316",
  red:       "#EF4444",
  yellow:    "#EAB308",
  // Text
  text:      "#E8F4FF",
  text2:     "#A8C4E0",
  muted:     "#3D5E80",
  // Fonts
  mono:      "'JetBrains Mono','Courier New',monospace",
  sans:      "'Inter','Segoe UI',system-ui,sans-serif",
};

export const TOKENS_DATA = [
  { s: "BEZ", n: "BEZ-Coin", icon: "🪙", color: C.gold, pUSD: 1.24 },
  { s: "USDT", n: "Tether", icon: "₮", color: "#26A17B", pUSD: 1.0 },
  { s: "USDC", n: "USD Coin", icon: "$", color: "#2775CA", pUSD: 1.0 },
  { s: "MATIC", n: "Polygon", icon: "⬟", color: "#8247E5", pUSD: 0.88 },
  { s: "ETH", n: "Ethereum", icon: "⬡", color: "#627EEA", pUSD: 3420 },
  { s: "BNB", n: "BNB Chain", icon: "⬡", color: "#F3BA2F", pUSD: 420 },
  { s: "USD", n: "US Dollar", icon: "$", color: "#10B981", pUSD: 1.0 },
  { s: "EUR", n: "Euro", icon: "€", color: "#3B82F6", pUSD: 1.09 },
];

const fmtUSD = n => "$" + (+n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── UI PRIMITIVES ────────────────────────────────────────────────────────────

export const Card = ({ children, style = {}, glow, color, className }) => (
  <div className={className} style={{
    background: C.card,
    border: `1px solid ${glow && color ? color + "66" : C.border}`,
    borderRadius: 16,
    padding: 18,
    boxShadow: glow && color ? `0 0 28px ${color}28,inset 0 0 16px ${color}06` : "none",
    ...style
  }}>
    {children}
  </div>
);

export const Chip = ({ color = C.primary, children, size = "sm", style = {} }) => (
  <span style={{
    background: `${color}22`, color, border: `1px solid ${color}44`, borderRadius: 20,
    padding: size === "lg" ? "5px 14px" : "2px 9px", fontSize: size === "lg" ? 12 : 10,
    fontFamily: C.mono, fontWeight: 800, ...style
  }}>
    {children}
  </span>
);

export const Btn = ({ children, onClick, disabled, color = C.primary, variant = "fill", icon, full, size = "md", style = {} }) => {
  const isFill = variant === "fill";
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: full ? "100%" : undefined,
      background: disabled ? C.card3 : isFill ? `linear-gradient(135deg,${color},${color}cc)` : "transparent",
      color: disabled ? C.muted : isFill ? (color === C.gold || color === C.yellow ? "#0a0a0a" : C.bg) : color,
      border: isFill ? "none" : `2px solid ${disabled ? C.border3 : color}`,
      borderRadius: 12, padding: size === "lg" ? "15px 24px" : size === "sm" ? "6px 12px" : "10px 20px",
      fontSize: size === "lg" ? 14 : size === "sm" ? 11 : 13, fontWeight: 800, cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: C.mono, boxShadow: disabled || !isFill ? "none" : `0 0 20px ${color}44`,
      transition: "all 0.18s", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, ...style,
    }}>
      {icon && <span style={{ fontSize: (size === "lg" ? 16 : size === "sm" ? 12 : 14) }}>{icon}</span>}
      <span>{children}</span>
    </button>
  );
};

export const Input = ({ value, onChange, label, sym, usd, type = "number", placeholder = "0.00", bp }) => (
  <div style={{ background: C.card2, border: `1px solid ${C.border2}`, borderRadius: 12, padding: "12px 14px", width: "100%", boxSizing: 'border-box' }}>
    {label && <div style={{ color: C.muted, fontSize: 9, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>{label}</div>}
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{
          flex: 1, background: "transparent", border: "none", outline: "none", color: C.text,
          fontFamily: C.mono, fontSize: bp === "mobile" ? 20 : 24, fontWeight: 800, minWidth: 0
        }} />
      {sym && <span style={{ color: C.muted, fontFamily: C.mono, fontSize: 13, flexShrink: 0 }}>{sym}</span>}
    </div>
    {usd != null && <div style={{ color: C.muted, fontSize: 10, marginTop: 3 }}>≈ {fmtUSD(usd)}</div>}
  </div>
);

export const TokBtn = ({ sym, sel, onClick, bp }) => {
  const tok = TOKENS_DATA.find(t => t.s === sym) || { icon: "?", color: C.muted, s: sym };
  const M = bp === "mobile";
  return (
    <button onClick={onClick} title={tok.n} style={{
      width: M ? 50 : 60, height: M ? 50 : 60, borderRadius: 14, flexShrink: 0, padding: 0,
      border: `2px solid ${sel ? tok.color : C.border2}`, background: sel ? `${tok.color}30` : C.card,
      cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
      boxShadow: sel ? `0 0 12px ${tok.color}55` : "none", transition: "all 0.16s",
    }}>
      <span style={{ fontSize: M ? 16 : 18 }}>{tok.icon}</span>
      <span style={{ color: sel ? tok.color : C.muted, fontFamily: C.mono, fontSize: M ? 8 : 9, fontWeight: 800 }}>{tok.s}</span>
    </button>
  );
};

export const StatusBadge = ({ status }) => {
  const m = {
    pending: { c: C.yellow, l: "⏳ Pendiente" }, processing: { c: C.blue, l: "🔄 Procesando" },
    completed: { c: C.primary, l: "✅ Completado" }, failed: { c: C.red, l: "❌ Fallido" },
    active: { c: C.primary, l: "✅ Activo" }, finalized: { c: C.violet, l: "🏁 Finalizado" },
    disputed: { c: C.red, l: "⚠️ Disputa" }, deploying: { c: C.violet, l: "📋 Desplegando" }
  };
  const s = m[status] || m.pending;
  return (
    <span style={{
      color: s.c, background: `${s.c}22`, border: `1px solid ${s.c}44`,
      borderRadius: 20, padding: "2px 10px", fontSize: 10, fontFamily: C.mono, fontWeight: 800
    }}>
      {s.l}
    </span>
  );
};
