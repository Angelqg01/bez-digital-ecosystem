// ─── bezhas-agents-ui.jsx ────────────────────────────────────────────────────
// ARCHIVO 2/6 — Átomos UI compartidos (mismo estilo que bezhas-pay-system.jsx)
// Importar: import { Box, Tag, Btn, StatusDot } from './bezhas-agents-ui'

import { C } from './bezhas-agents-constants';

// Tarjeta base con glow opcional
export function Box({ children, style = {}, glow, col, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: C.card,
        border: `1px solid ${glow && col ? col + "55" : C.border}`,
        borderRadius: 14,
        padding: 14,
        cursor: onClick ? "pointer" : "default",
        boxShadow: glow && col ? `0 0 22px ${col}18` : "none",
        transition: "all 0.18s",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Chip/badge de color
export function Tag({ children, col = "#00C896", sm = false }) {
  return (
    <span
      style={{
        background: `${col}20`,
        color: col,
        border: `1px solid ${col}44`,
        borderRadius: 20,
        padding: sm ? "1px 7px" : "3px 10px",
        fontSize: sm ? 9 : 10,
        fontFamily: C.mono,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

// Botón primario con gradiente
export function Btn({ children, onClick, col = "#00C896", sm = false, full = false, disabled = false }) {
  const isDark = col === "#FFB800" || col === "#EAB308";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: full ? "100%" : undefined,
        background: disabled ? "#101E38" : `linear-gradient(135deg, ${col}, ${col}bb)`,
        color: disabled ? "#3D5E80" : isDark ? "#0a0a0a" : "#03060E",
        border: "none",
        borderRadius: 10,
        padding: sm ? "5px 12px" : "10px 20px",
        fontSize: sm ? 11 : 13,
        fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: C.mono,
        boxShadow: disabled ? "none" : `0 0 14px ${col}44`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        transition: "all 0.18s",
      }}
    >
      {children}
    </button>
  );
}

// Punto de status animado
export function StatusDot({ status }) {
  const map = {
    ACTIVE:  { col: "#00C896", label: "ACTIVE"  },
    BETA:    { col: "#EAB308", label: "BETA"    },
    DEV:     { col: "#3D5E80", label: "DEV"     },
    DESIGN:  { col: "#7C3AED", label: "DESIGN"  },
    LIVE:    { col: "#00C896", label: "LIVE"    },
  };
  const s = map[status] || map.DEV;
  return <Tag col={s.col} sm>{s.label}</Tag>;
}

// Tarjeta de stat con borde superior de color
export function StatCard({ label, value, col, icon }) {
  return (
    <div
      style={{
        background: "#0C1628",
        border: `1px solid ${col}33`,
        borderRadius: 14,
        padding: "12px 14px",
        borderTop: `3px solid ${col}`,
      }}
    >
      {icon && <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>}
      <div style={{ color: "#3D5E80", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ color: col, fontFamily: "'JetBrains Mono','Courier New',monospace", fontSize: 20, fontWeight: 900 }}>
        {value}
      </div>
    </div>
  );
}

// Separador horizontal
export function Divider() {
  return <div style={{ height: 1, background: "#0D2040", margin: "12px 0" }} />;
}
