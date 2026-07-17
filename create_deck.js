// BeZhas Investor Deck — create_deck.js
// Run: node create_deck.js
// Output: D:\BeZhas-Blockchain\BeZhas_Investor_Deck_2025.pptx

const PptxGenJS = require("pptxgenjs");
const pres = new PptxGenJS();
pres.layout = "LAYOUT_16x9"; // 10" x 5.625"

// ── COLOR PALETTE ──────────────────────────────────────────────────────────────
// NEVER use '#' prefix. NEVER use 8-digit hex.
const C = {
  bg:      "0A0E1A",
  surface: "111827",
  card:    "141C2E",
  navy:    "0D1220",
  dark:    "1E293B",
  cyan:    "00D4FF",
  violet:  "7B2FFF",
  orange:  "FF6B35",
  green:   "10B981",
  gold:    "F59E0B",
  red:     "EF4444",
  white:   "FFFFFF",
  light:   "94A3B8",
};

// ── HELPERS ────────────────────────────────────────────────────────────────────

// Full-slide background rect
function addBg(slide, color) {
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: 10, h: 5.625,
    fill: { color: color || C.bg },
    line: { color: color || C.bg, width: 0 },
  });
}

// Rounded-corner card rect (NO object reuse — fresh literal each call)
function addCard(slide, x, y, w, h, fillColor, borderColor, borderWidth) {
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w, h,
    rectRadius: 0.08,
    fill: { color: fillColor || C.card },
    line: { color: borderColor || C.dark, width: borderWidth || 1 },
  });
}

// Simple rect
function addRect(slide, x, y, w, h, fillColor, lineColor) {
  slide.addShape(pres.ShapeType.rect, {
    x, y, w, h,
    fill: { color: fillColor },
    line: { color: lineColor || fillColor, width: 0 },
  });
}

// Ellipse / circle
function addEllipse(slide, x, y, w, h, fillColor, lineColor) {
  slide.addShape(pres.ShapeType.ellipse, {
    x, y, w, h,
    fill: { color: fillColor },
    line: { color: lineColor || fillColor, width: 0 },
  });
}

// Text helper — fresh opts object per call
function addText(slide, text, x, y, w, h, opts) {
  slide.addText(text, { x, y, w, h, ...opts });
}

// Slide number badge (bottom-right)
function addSlideNum(slide, num) {
  addRect(slide, 9.6, 5.38, 0.35, 0.2, C.dark, C.dark);
  addText(slide, `${num}/13`, 9.6, 5.38, 0.35, 0.2, {
    fontSize: 7, color: C.light, align: "center", valign: "middle",
    fontFace: "Calibri", bold: false, margin: 0,
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// SLIDE 1 — PORTADA
// ──────────────────────────────────────────────────────────────────────────────
(function slide1() {
  const s = pres.addSlide();
  addBg(s);

  // Left dark panel
  addRect(s, 0, 0, 5.2, 5.625, C.surface);

  // BEZ wordmark — large
  addText(s, "BeZhas", 0.35, 0.55, 4.5, 1.0, {
    fontSize: 52, bold: true, color: C.cyan, fontFace: "Cambria",
    align: "left", valign: "middle", margin: 0,
  });

  // Tagline
  addText(s, "Blockchain Empresarial de Nueva Generación", 0.35, 1.55, 4.5, 0.4, {
    fontSize: 13, bold: false, color: C.light, fontFace: "Calibri",
    align: "left", valign: "middle", margin: 0,
  });

  // Divider line
  addRect(s, 0.35, 2.08, 2.4, 0.035, C.cyan);

  // Sub-headline
  addText(s, "La infraestructura que convierte\ncostos operativos en capital productivo.", 0.35, 2.22, 4.5, 0.75, {
    fontSize: 12.5, bold: false, color: C.white, fontFace: "Calibri",
    align: "left", valign: "top", margin: 0,
  });

  // Call line
  addText(s, "Presentación para Inversores Institucionales · 2025", 0.35, 3.1, 4.5, 0.3, {
    fontSize: 9.5, bold: false, color: C.light, fontFace: "Calibri",
    align: "left", valign: "middle", margin: 0,
  });

  // BEZ logo circle (right side)
  addEllipse(s, 6.1, 0.45, 2.0, 2.0, C.violet);
  addEllipse(s, 6.3, 0.65, 1.6, 1.6, C.card);
  addText(s, "BEZ", 6.1, 0.45, 2.0, 2.0, {
    fontSize: 38, bold: true, color: C.cyan, fontFace: "Cambria",
    align: "center", valign: "middle", margin: 0,
  });

  // 3 metric cards
  const metrics = [
    { val: "$84M", lbl: "Revenue Año 5", border: C.cyan },
    { val: "75%", lbl: "Margen Bruto", border: C.gold },
    { val: "12% APY", lbl: "ROI Staking BEZ", border: C.green },
  ];
  metrics.forEach((m, i) => {
    const cx = 5.55;
    const cy = 2.72 + i * 0.91;
    addCard(s, cx, cy, 4.1, 0.76, C.card, m.border, 1.5);
    addText(s, m.val, cx + 0.15, cy + 0.03, 1.4, 0.35, {
      fontSize: 20, bold: true, color: m.border, fontFace: "Cambria",
      align: "left", valign: "middle", margin: 0,
    });
    addText(s, m.lbl, cx + 0.15, cy + 0.38, 3.7, 0.28, {
      fontSize: 10, color: C.light, fontFace: "Calibri",
      align: "left", valign: "middle", margin: 0,
    });
  });

  addSlideNum(s, 1);
})();

// ──────────────────────────────────────────────────────────────────────────────
// SLIDE 2 — EL PROBLEMA
// ──────────────────────────────────────────────────────────────────────────────
(function slide2() {
  const s = pres.addSlide();
  addBg(s);

  // Top bar
  addRect(s, 0, 0, 10, 0.78, C.surface);
  addText(s, "El Problema que Nadie Ha Resuelto", 0.3, 0, 9.4, 0.78, {
    fontSize: 22, bold: true, color: C.white, fontFace: "Cambria",
    align: "left", valign: "middle", margin: 0,
  });

  // 2×2 pain cards
  const pains = [
    { stat: "25%", desc: "de margen perdido\npor fricciones B2B", border: C.orange, icon: "💸" },
    { stat: "72 días", desc: "promedio para cerrar\nun contrato comercial", border: C.red, icon: "⏳" },
    { stat: "$3.7T", desc: "en liquidez bloqueada\npor pagos fronterizos", border: C.violet, icon: "🔒" },
    { stat: "0 garantías", desc: "en transacciones con\nterceros desconocidos", border: C.gold, icon: "⚠️" },
  ];
  const cols = [0.25, 5.15];
  const rows = [0.96, 3.05];
  pains.forEach((p, i) => {
    const cx = cols[i % 2];
    const cy = rows[Math.floor(i / 2)];
    addCard(s, cx, cy, 4.7, 1.85, C.card, p.border, 1.5);
    addText(s, p.icon, cx + 0.2, cy + 0.12, 0.6, 0.55, {
      fontSize: 24, align: "left", valign: "middle", margin: 0, color: C.white,
    });
    addText(s, p.stat, cx + 0.9, cy + 0.1, 3.6, 0.55, {
      fontSize: 28, bold: true, color: p.border, fontFace: "Cambria",
      align: "left", valign: "middle", margin: 0,
    });
    addText(s, p.desc, cx + 0.9, cy + 0.65, 3.6, 0.65, {
      fontSize: 11, color: C.light, fontFace: "Calibri",
      align: "left", valign: "top", margin: 0,
    });
  });

  // Bottom stat bar
  addRect(s, 0, 5.12, 10, 0.505, C.navy);
  addText(s, "El 68% de las empresas B2B pierden contratos por falta de confianza verificable en el proceso", 0.3, 5.12, 9.4, 0.505, {
    fontSize: 11, color: C.cyan, bold: true, fontFace: "Calibri",
    align: "center", valign: "middle", margin: 0,
  });

  addSlideNum(s, 2);
})();

// ──────────────────────────────────────────────────────────────────────────────
// SLIDE 3 — LA SOLUCIÓN
// ──────────────────────────────────────────────────────────────────────────────
(function slide3() {
  const s = pres.addSlide();
  addBg(s);

  // Top bar
  addRect(s, 0, 0, 10, 0.78, C.surface);
  addText(s, "BeZhas: La Solución en Tres Pasos", 0.3, 0, 9.4, 0.78, {
    fontSize: 22, bold: true, color: C.white, fontFace: "Cambria",
    align: "left", valign: "middle", margin: 0,
  });

  // 3 solution columns
  const sols = [
    {
      num: "01", numColor: C.cyan,
      title: "INTEGRA",
      body: "Conecta tu ERP, marketplace o plataforma en menos de 48 horas mediante REST API, SDK nativo o Plugin WordPress.",
    },
    {
      num: "02", numColor: C.violet,
      title: "VALIDA",
      body: "IA Escrow evalúa y certifica cada contrato on-chain. Cero intermediarios. Cero fraudes. Auditoría inmutable.",
    },
    {
      num: "03", numColor: C.green,
      title: "LIQUIDA",
      body: "Pagos instantáneos en BEZ-Coin con settlement real-time. Staking automático convierte tu flujo en rendimiento.",
    },
  ];

  sols.forEach((sol, i) => {
    const cx = 0.22 + i * 3.27;
    addCard(s, cx, 0.95, 3.08, 4.3, C.card, sol.numColor, 1.5);

    // Number badge ellipse
    addEllipse(s, cx + 1.14, 1.12, 0.78, 0.78, sol.numColor);
    addText(s, sol.num, cx + 1.14, 1.12, 0.78, 0.78, {
      fontSize: 22, bold: true, color: C.bg, fontFace: "Cambria",
      align: "center", valign: "middle", margin: 0,
    });

    // Title
    addText(s, sol.title, cx + 0.15, 2.1, 2.78, 0.5, {
      fontSize: 18, bold: true, color: sol.numColor, fontFace: "Cambria",
      align: "center", valign: "middle", margin: 0,
    });

    // Body
    addText(s, sol.body, cx + 0.2, 2.68, 2.68, 2.2, {
      fontSize: 11.5, color: C.light, fontFace: "Calibri",
      align: "left", valign: "top", margin: 0,
    });
  });

  // Tagline
  addText(s, "\"Tu empresa integrada. Tus contratos validados. Tu liquidez activa.\"", 0.3, 5.22, 9.4, 0.36, {
    fontSize: 11, color: C.gold, italic: true, fontFace: "Calibri",
    align: "center", valign: "middle", margin: 0,
  });

  addSlideNum(s, 3);
})();

// ──────────────────────────────────────────────────────────────────────────────
// SLIDE 4 — INTEGRACIÓN TÉCNICA
// ──────────────────────────────────────────────────────────────────────────────
(function slide4() {
  const s = pres.addSlide();
  addBg(s);

  // Top bar
  addRect(s, 0, 0, 10, 0.78, C.surface);
  addText(s, "Integración en 48 Horas — Sin Fricción Técnica", 0.3, 0, 9.4, 0.78, {
    fontSize: 22, bold: true, color: C.white, fontFace: "Cambria",
    align: "left", valign: "middle", margin: 0,
  });

  // 3 method cards
  const methods = [
    {
      icon: "⚡", title: "REST API",
      body: "Documentación completa OpenAPI 3.0. Webhooks nativos. Rate limiting inteligente. SDKs en 5 minutos.",
      color: C.cyan,
    },
    {
      icon: "📦", title: "SDK Nativo",
      body: "JavaScript · Python · PHP · Java. NPM package. Código de ejemplo incluido. Soporte técnico dedicado.",
      color: C.violet,
    },
    {
      icon: "🔌", title: "Plugin WordPress",
      body: "1 clic desde el repositorio oficial. Compatible WooCommerce + Magento. Setup guiado sin programar.",
      color: C.green,
    },
  ];

  methods.forEach((m, i) => {
    const cx = 0.22 + i * 3.27;
    addCard(s, cx, 0.95, 3.08, 2.85, C.card, m.color, 1.5);
    addText(s, m.icon, cx + 1.19, 1.12, 0.7, 0.55, {
      fontSize: 26, align: "center", valign: "middle", margin: 0, color: C.white,
    });
    addText(s, m.title, cx + 0.15, 1.72, 2.78, 0.45, {
      fontSize: 16, bold: true, color: m.color, fontFace: "Cambria",
      align: "center", valign: "middle", margin: 0,
    });
    addText(s, m.body, cx + 0.2, 2.22, 2.68, 1.45, {
      fontSize: 10.5, color: C.light, fontFace: "Calibri",
      align: "left", valign: "top", margin: 0,
    });
  });

  // Compatibility title
  addText(s, "Compatible con los principales ERPs y plataformas:", 0.3, 4.0, 9.4, 0.35, {
    fontSize: 12, color: C.white, bold: true, fontFace: "Calibri",
    align: "left", valign: "middle", margin: 0,
  });

  // ERP badges
  const erps = ["SAP", "Odoo", "Salesforce", "WooCommerce", "Magento", "Shopify"];
  const eColors = [C.cyan, C.green, C.violet, C.orange, C.red, C.gold];
  erps.forEach((e, i) => {
    const ex = 0.22 + i * 1.6;
    addCard(s, ex, 4.45, 1.46, 0.55, C.card, eColors[i], 1);
    addText(s, e, ex, 4.45, 1.46, 0.55, {
      fontSize: 10, bold: true, color: eColors[i], fontFace: "Calibri",
      align: "center", valign: "middle", margin: 0,
    });
  });

  addSlideNum(s, 4);
})();

// ──────────────────────────────────────────────────────────────────────────────
// SLIDE 5 — CONTROL JERÁRQUICO
// ──────────────────────────────────────────────────────────────────────────────
(function slide5() {
  const s = pres.addSlide();
  addBg(s);

  // Top bar
  addRect(s, 0, 0, 10, 0.78, C.surface);
  addText(s, "Control Absoluto: Matriz y Filiales en una Red", 0.3, 0, 9.4, 0.78, {
    fontSize: 22, bold: true, color: C.white, fontFace: "Cambria",
    align: "left", valign: "middle", margin: 0,
  });

  // LEFT: hierarchy diagram
  // Matriz box
  addCard(s, 0.35, 1.0, 3.8, 0.65, C.violet, C.cyan, 2);
  addText(s, "🏢  EMPRESA MATRIZ", 0.35, 1.0, 3.8, 0.65, {
    fontSize: 13, bold: true, color: C.white, fontFace: "Calibri",
    align: "center", valign: "middle", margin: 0,
  });

  // Arrow down
  addRect(s, 2.2, 1.65, 0.04, 0.45, C.cyan);
  addText(s, "▼", 2.08, 2.05, 0.3, 0.22, {
    fontSize: 12, color: C.cyan, align: "center", valign: "middle", margin: 0,
  });

  // Filial A & B
  addCard(s, 0.35, 2.3, 1.7, 0.6, C.card, C.violet, 1.2);
  addText(s, "Filial A", 0.35, 2.3, 1.7, 0.6, {
    fontSize: 12, bold: true, color: C.violet, fontFace: "Calibri",
    align: "center", valign: "middle", margin: 0,
  });
  addCard(s, 2.45, 2.3, 1.7, 0.6, C.card, C.violet, 1.2);
  addText(s, "Filial B", 2.45, 2.3, 1.7, 0.6, {
    fontSize: 12, bold: true, color: C.violet, fontFace: "Calibri",
    align: "center", valign: "middle", margin: 0,
  });

  // Arrows down
  addRect(s, 1.19, 2.9, 0.04, 0.42, C.green);
  addRect(s, 3.29, 2.9, 0.04, 0.42, C.green);

  // Smart Contract
  addCard(s, 0.35, 3.32, 1.7, 0.6, C.navy, C.green, 1.5);
  addText(s, "⛓ Smart\nContract", 0.35, 3.32, 1.7, 0.6, {
    fontSize: 9.5, bold: true, color: C.green, fontFace: "Calibri",
    align: "center", valign: "middle", margin: 0,
  });
  addCard(s, 2.45, 3.32, 1.7, 0.6, C.navy, C.green, 1.5);
  addText(s, "⛓ Smart\nContract", 2.45, 3.32, 1.7, 0.6, {
    fontSize: 9.5, bold: true, color: C.green, fontFace: "Calibri",
    align: "center", valign: "middle", margin: 0,
  });

  // Arrow to DAO
  addRect(s, 2.2, 3.92, 0.04, 0.38, C.gold);
  // DAO
  addCard(s, 0.55, 4.3, 3.4, 0.65, C.card, C.gold, 2);
  addText(s, "🗳  DAO — Gobernanza BeZhas", 0.55, 4.3, 3.4, 0.65, {
    fontSize: 12, bold: true, color: C.gold, fontFace: "Calibri",
    align: "center", valign: "middle", margin: 0,
  });

  // Vertical divider
  addRect(s, 4.55, 1.0, 0.04, 4.25, C.dark);

  // RIGHT: 2×2 benefit cards
  const benefits = [
    { icon: "👁", title: "Visibilidad Total", body: "Cada transacción de tus filiales visible en tiempo real en tu dashboard." },
    { icon: "💧", title: "Liquidez Unificada", body: "Pool de liquidez compartido entre toda tu estructura empresarial." },
    { icon: "📋", title: "Auditoría Inmutable", body: "Trazabilidad on-chain para cumplimiento regulatorio automático." },
    { icon: "🗳", title: "Gobernanza DAO", body: "Vota actualizaciones de red. Tu empresa influye en el protocolo." },
  ];
  const bCols = [4.72, 7.27];
  const bRows = [1.0, 2.85];
  benefits.forEach((b, i) => {
    const bx = bCols[i % 2];
    const by = bRows[Math.floor(i / 2)];
    addCard(s, bx, by, 2.28, 1.65, C.card, C.cyan, 1);
    addText(s, b.icon + "  " + b.title, bx + 0.15, by + 0.12, 1.98, 0.45, {
      fontSize: 12, bold: true, color: C.cyan, fontFace: "Cambria",
      align: "left", valign: "middle", margin: 0,
    });
    addText(s, b.body, bx + 0.15, by + 0.6, 1.98, 0.92, {
      fontSize: 10, color: C.light, fontFace: "Calibri",
      align: "left", valign: "top", margin: 0,
    });
  });

  addSlideNum(s, 5);
})();

// ──────────────────────────────────────────────────────────────────────────────
// SLIDE 6 — BLUE ECONOMY
// ──────────────────────────────────────────────────────────────────────────────
(function slide6() {
  const s = pres.addSlide();
  addBg(s);

  // Top bar
  addRect(s, 0, 0, 10, 0.78, C.surface);
  addText(s, "Sectores Objetivo: Blue Economy & B2B Industrial", 0.3, 0, 9.4, 0.78, {
    fontSize: 22, bold: true, color: C.white, fontFace: "Cambria",
    align: "left", valign: "middle", margin: 0,
  });

  // 3×2 sector cards
  const sectors = [
    { icon: "🚢", title: "Marítimo & Logística", body: "Contratos de carga trazables. Certificados de origen on-chain.", color: C.cyan },
    { icon: "🛃", title: "Aduanas & Comercio", body: "DAU digital inmutable. Pagos aduaneros en tiempo real.", color: C.violet },
    { icon: "❄", title: "Cold Chain", body: "Certificación de temperatura con IoT + blockchain. Seguro automático.", color: C.green },
    { icon: "⚓", title: "Puertos & Terminales", body: "Licitaciones públicas directas. Gestión de contratos multi-parte.", color: C.orange },
    { icon: "🏭", title: "RWA Industrial", body: "Tokenización de activos físicos. Liquidez para maquinaria y flota.", color: C.gold },
    { icon: "💡", title: "Incubazul", body: "Hub de startups blue economy. Primer cliente institucional confirmado.", color: C.red },
  ];
  const sCols = [0.2, 3.45, 6.7];
  const sRows = [0.95, 2.98];
  sectors.forEach((sec, i) => {
    const sx = sCols[i % 3];
    const sy = sRows[Math.floor(i / 3)];
    addCard(s, sx, sy, 3.05, 1.82, C.card, sec.color, 1.5);
    addText(s, sec.icon + "  " + sec.title, sx + 0.18, sy + 0.12, 2.68, 0.45, {
      fontSize: 13, bold: true, color: sec.color, fontFace: "Cambria",
      align: "left", valign: "middle", margin: 0,
    });
    addText(s, sec.body, sx + 0.18, sy + 0.63, 2.68, 0.98, {
      fontSize: 10.5, color: C.light, fontFace: "Calibri",
      align: "left", valign: "top", margin: 0,
    });
  });

  // Bottom blue bar
  addRect(s, 0, 5.1, 10, 0.525, C.navy);
  addText(s, "Mercado Addressable: €4.2 billones en Blue Economy europea · TAM B2B BeZhas: €180M en 5 años", 0.3, 5.1, 9.4, 0.525, {
    fontSize: 11, color: C.cyan, bold: true, fontFace: "Calibri",
    align: "center", valign: "middle", margin: 0,
  });

  addSlideNum(s, 6);
})();

// ──────────────────────────────────────────────────────────────────────────────
// SLIDE 7 — COMPETENCIA
// ──────────────────────────────────────────────────────────────────────────────
(function slide7() {
  const s = pres.addSlide();
  addBg(s);

  // Top bar
  addRect(s, 0, 0, 10, 0.78, C.surface);
  addText(s, "BeZhas vs. Competencia — Por Qué Ganamos", 0.3, 0, 9.4, 0.78, {
    fontSize: 22, bold: true, color: C.white, fontFace: "Cambria",
    align: "left", valign: "middle", margin: 0,
  });

  // Table definition
  const colWidths = [2.3, 1.68, 1.68, 1.68, 1.68];
  const colLabels = ["Característica", "BeZhas ✓", "Solana", "VeChain", "Avalanche"];
  const colColors = [C.surface, C.navy, C.surface, C.surface, C.surface];
  const colTextColors = [C.light, C.cyan, C.light, C.light, C.light];
  const rows = [
    ["IA Escrow nativo",       "✓", "✗", "✗", "✗"],
    ["B2B sin fricción",        "✓", "Parcial", "Parcial", "✗"],
    ["Plugin WordPress",        "✓", "✗", "✗", "✗"],
    ["Empresas jerárquicas",    "✓", "✗", "Parcial", "✗"],
    ["Blue Economy nativa",     "✓", "✗", "✗", "✗"],
    ["DAO empresarial",         "✓", "✗", "✓", "✗"],
    ["Staking 12% APY",        "✓", "~7%", "~5%", "~8%"],
    ["Cumplimiento MiCA/AEAT", "✓", "Parcial", "✓", "Parcial"],
  ];

  const tableX = 0.18;
  const headerY = 0.88;
  const rowH = 0.48;

  // Header row
  let cx = tableX;
  colWidths.forEach((w, ci) => {
    addRect(s, cx, headerY, w, 0.52, ci === 1 ? C.cyan : C.dark, ci === 1 ? C.cyan : C.dark);
    addText(s, colLabels[ci], cx + 0.05, headerY, w - 0.1, 0.52, {
      fontSize: ci === 0 ? 10 : 11, bold: true,
      color: ci === 1 ? C.bg : C.white,
      fontFace: "Calibri", align: ci === 0 ? "left" : "center",
      valign: "middle", margin: 0,
    });
    cx += w + 0.04;
  });

  // Data rows
  rows.forEach((row, ri) => {
    const ry = headerY + 0.52 + ri * rowH;
    const rowBg = ri % 2 === 0 ? C.surface : C.card;
    let dcx = tableX;
    row.forEach((cell, ci) => {
      const colBg = ci === 1 ? "0D1F18" : rowBg;
      addRect(s, dcx, ry, colWidths[ci], rowH - 0.02, colBg, colBg);
      const isCheck = cell === "✓";
      const isCross = cell === "✗";
      const cellColor = isCheck ? C.green : isCross ? C.red : (ci === 0 ? C.light : C.gold);
      addText(s, cell, dcx + 0.05, ry, colWidths[ci] - 0.1, rowH - 0.02, {
        fontSize: ci === 0 ? 10 : 13, bold: isCheck || isCross,
        color: cellColor, fontFace: "Calibri",
        align: ci === 0 ? "left" : "center", valign: "middle", margin: 0,
      });
      dcx += colWidths[ci] + 0.04;
    });
  });

  addSlideNum(s, 7);
})();

// ──────────────────────────────────────────────────────────────────────────────
// SLIDE 8 — LICITACIONES PÚBLICAS
// ──────────────────────────────────────────────────────────────────────────────
(function slide8() {
  const s = pres.addSlide();
  addBg(s);

  // Top bar
  addRect(s, 0, 0, 10, 0.78, C.surface);
  addText(s, "Pipeline de Contratos Públicos — Oportunidad Inmediata", 0.3, 0, 9.4, 0.78, {
    fontSize: 22, bold: true, color: C.white, fontFace: "Cambria",
    align: "left", valign: "middle", margin: 0,
  });

  // 2×2 contract cards
  const contracts = [
    { amount: "€69.1M", name: "Generalitat Valenciana", desc: "Digitalización trazabilidad portuaria y gestión de contratos B2B interadministrativo.", status: "EVALUANDO", statusColor: C.gold },
    { amount: "€710K", name: "Puerto de Barcelona", desc: "Sistema blockchain para cadena de custodia y certificación de origen de mercancías.", status: "EN PROCESO", statusColor: C.cyan },
    { amount: "€413K", name: "Puerto de Huelva", desc: "Plataforma cold chain IoT + certificación on-chain para exportaciones agroalimentarias.", status: "ABIERTO", statusColor: C.green },
    { amount: "+€15M", name: "Pipeline Incubazul", desc: "6 contratos adicionales en fase de maduración con startups blue economy. Q2 2025.", status: "PIPELINE", statusColor: C.violet },
  ];

  const ccols = [0.22, 5.15];
  const crows = [0.95, 3.05];
  contracts.forEach((c, i) => {
    const cx = ccols[i % 2];
    const cy = crows[Math.floor(i / 2)];
    addCard(s, cx, cy, 4.72, 1.87, C.card, c.statusColor, 1.5);

    // Amount badge
    addRect(s, cx + 0.15, cy + 0.15, 1.9, 0.52, C.navy);
    addText(s, c.amount, cx + 0.15, cy + 0.15, 1.9, 0.52, {
      fontSize: 20, bold: true, color: c.statusColor, fontFace: "Cambria",
      align: "center", valign: "middle", margin: 0,
    });

    // Name + desc
    addText(s, c.name, cx + 2.2, cy + 0.12, 2.35, 0.38, {
      fontSize: 13, bold: true, color: C.white, fontFace: "Cambria",
      align: "left", valign: "middle", margin: 0,
    });
    addText(s, c.desc, cx + 0.18, cy + 0.82, 4.35, 0.82, {
      fontSize: 10, color: C.light, fontFace: "Calibri",
      align: "left", valign: "top", margin: 0,
    });

    // Status badge
    addRect(s, cx + 2.22, cy + 0.15, 1.0, 0.42, C.dark);
    addText(s, c.status, cx + 2.22, cy + 0.15, 1.0, 0.42, {
      fontSize: 8.5, bold: true, color: c.statusColor, fontFace: "Calibri",
      align: "center", valign: "middle", margin: 0,
    });
  });

  // Bottom gold bar
  addRect(s, 0, 5.1, 10, 0.525, C.navy);
  addText(s, "Total pipeline contratos públicos identificados: > €70.2M · Primer cierre estimado: Q3 2025", 0.3, 5.1, 9.4, 0.525, {
    fontSize: 11, color: C.gold, bold: true, fontFace: "Calibri",
    align: "center", valign: "middle", margin: 0,
  });

  addSlideNum(s, 8);
})();

// ──────────────────────────────────────────────────────────────────────────────
// SLIDE 9 — SUSCRIPCIONES SaaS
// ──────────────────────────────────────────────────────────────────────────────
(function slide9() {
  const s = pres.addSlide();
  addBg(s);

  // Top bar
  addRect(s, 0, 0, 10, 0.78, C.surface);
  addText(s, "Modelo de Suscripción — Ingresos Recurrentes Predecibles", 0.3, 0, 9.4, 0.78, {
    fontSize: 22, bold: true, color: C.white, fontFace: "Cambria",
    align: "left", valign: "middle", margin: 0,
  });

  // 4 tier cards
  const tiers = [
    {
      name: "Starter",      price: "€0",    period: "/mes",
      color: C.light,       textColor: C.light,
      features: ["API básica 1.000 req/día", "1 integración ERP", "Dashboard analítico"],
      tag: null,
    },
    {
      name: "Creator Pro",  price: "€99",   period: "/mes",
      color: C.cyan,        textColor: C.cyan,
      features: ["10.000 req/día", "3 integraciones", "IA Escrow básico", "Soporte 24h"],
      tag: null,
    },
    {
      name: "Business",     price: "€499",  period: "/mes",
      color: C.violet,      textColor: C.violet,
      features: ["Ilimitado", "Control jerárquico", "IA Escrow full", "SLA 99.9%", "API prioritaria"],
      tag: "MÁS POPULAR",
    },
    {
      name: "Enterprise VIP", price: "€2.499", period: "/mes",
      color: C.gold,         textColor: C.gold,
      features: ["White label", "Filiales ilimitadas", "DAO governance", "Cuenta manager", "Onboarding VIP"],
      tag: null,
    },
  ];

  tiers.forEach((t, i) => {
    const tx = 0.18 + i * 2.42;
    addCard(s, tx, 0.9, 2.28, 4.1, C.card, t.color, 1.5);

    // Header band
    addRect(s, tx, 0.9, 2.28, 0.68, C.dark);
    addText(s, t.name, tx + 0.1, 0.9, 2.08, 0.68, {
      fontSize: 13, bold: true, color: t.textColor, fontFace: "Cambria",
      align: "center", valign: "middle", margin: 0,
    });

    // Popular badge
    if (t.tag) {
      addRect(s, tx + 0.44, 0.88, 1.4, 0.22, C.violet);
      addText(s, t.tag, tx + 0.44, 0.88, 1.4, 0.22, {
        fontSize: 7.5, bold: true, color: C.white, fontFace: "Calibri",
        align: "center", valign: "middle", margin: 0,
      });
    }

    // Price
    addText(s, t.price, tx + 0.1, 1.62, 1.5, 0.62, {
      fontSize: 28, bold: true, color: t.textColor, fontFace: "Cambria",
      align: "left", valign: "middle", margin: 0,
    });
    addText(s, t.period, tx + 0.1, 2.2, 2.0, 0.3, {
      fontSize: 10, color: C.light, fontFace: "Calibri",
      align: "left", valign: "middle", margin: 0,
    });

    // Features
    t.features.forEach((f, fi) => {
      addText(s, "✓  " + f, tx + 0.18, 2.62 + fi * 0.38, 1.94, 0.36, {
        fontSize: 9.5, color: fi === 0 ? t.textColor : C.light, fontFace: "Calibri",
        align: "left", valign: "middle", margin: 0,
      });
    });
  });

  // Bottom gold ROI bar
  addRect(s, 0, 5.1, 10, 0.525, C.navy);
  addText(s, "Business + Enterprise VIP generan 89% de los ingresos MRR · Churn objetivo: <3% anual", 0.3, 5.1, 9.4, 0.525, {
    fontSize: 11, color: C.gold, bold: true, fontFace: "Calibri",
    align: "center", valign: "middle", margin: 0,
  });

  addSlideNum(s, 9);
})();

// ──────────────────────────────────────────────────────────────────────────────
// SLIDE 10 — PROGRAMA DE SOCIOS & ROI
// ──────────────────────────────────────────────────────────────────────────────
(function slide10() {
  const s = pres.addSlide();
  addBg(s);

  // Top bar
  addRect(s, 0, 0, 10, 0.78, C.surface);
  addText(s, "Programa de Socios — Convierte Contactos en Capital", 0.3, 0, 9.4, 0.78, {
    fontSize: 22, bold: true, color: C.white, fontFace: "Cambria",
    align: "left", valign: "middle", margin: 0,
  });

  // Left: 3 partner stats
  const stats = [
    { val: "20%", label: "Comisión recurrente\nsobre facturación referida", color: C.cyan },
    { val: "12% APY", label: "Rendimiento anual\nstaking BEZ-Coin", color: C.gold },
    { val: "€0", label: "Coste de entrada\nal programa partner", color: C.green },
  ];
  stats.forEach((st, i) => {
    const sy = 1.0 + i * 1.38;
    addCard(s, 0.25, sy, 4.1, 1.22, C.card, st.color, 1.5);
    addText(s, st.val, 0.4, sy + 0.1, 1.5, 0.7, {
      fontSize: 30, bold: true, color: st.color, fontFace: "Cambria",
      align: "left", valign: "middle", margin: 0,
    });
    addText(s, st.label, 2.0, sy + 0.12, 2.2, 0.9, {
      fontSize: 11, color: C.light, fontFace: "Calibri",
      align: "left", valign: "middle", margin: 0,
    });
  });

  // Vertical divider
  addRect(s, 4.65, 0.9, 0.04, 4.4, C.dark);

  // Right: 6 reasons
  const reasons = [
    "Red pre-verificada de partners activos desde día 1",
    "Dashboard en tiempo real de comisiones y staking",
    "Material comercial personalizado White Label",
    "Formación técnica incluida + certificación BeZhas",
    "Acceso anticipado a nuevas funciones y betas",
    "Participación en DAO — voz en el futuro del protocolo",
  ];
  const rColors = [C.cyan, C.violet, C.green, C.gold, C.orange, C.red];
  reasons.forEach((r, i) => {
    const ry = 1.05 + i * 0.72;
    addEllipse(s, 4.85, ry + 0.12, 0.42, 0.42, rColors[i]);
    addText(s, String(i + 1), 4.85, ry + 0.12, 0.42, 0.42, {
      fontSize: 13, bold: true, color: C.bg, fontFace: "Cambria",
      align: "center", valign: "middle", margin: 0,
    });
    addText(s, r, 5.4, ry + 0.07, 4.3, 0.5, {
      fontSize: 10.5, color: C.light, fontFace: "Calibri",
      align: "left", valign: "middle", margin: 0,
    });
  });

  addSlideNum(s, 10);
})();

// ──────────────────────────────────────────────────────────────────────────────
// SLIDE 11 — PROYECCIONES FINANCIERAS
// ──────────────────────────────────────────────────────────────────────────────
(function slide11() {
  const s = pres.addSlide();
  addBg(s);

  // Top bar
  addRect(s, 0, 0, 10, 0.78, C.surface);
  addText(s, "Proyecciones Financieras — Crecimiento 187× en 5 Años", 0.3, 0, 9.4, 0.78, {
    fontSize: 22, bold: true, color: C.white, fontFace: "Cambria",
    align: "left", valign: "middle", margin: 0,
  });

  // Bar chart — left side
  const chartData = [
    {
      name: "Ingresos ($M)",
      labels: ["Año 1", "Año 2", "Año 3", "Año 4", "Año 5"],
      values: [0.45, 2.1, 8.5, 28, 84],
    },
  ];

  s.addChart(pres.ChartType.bar, chartData, {
    x: 0.3, y: 0.98, w: 5.9, h: 3.75,
    chartColors: ["00D4FF"],
    showValue: true,
    dataLabelPosition: "inEnd",    // MUST be "inEnd" — "outEnd" corrupts the file
    dataLabelFontSize: 11,
    dataLabelColor: "FFFFFF",
    dataLabelFontBold: true,
    valAxisNumFmt: '"$"0.0"M"',
    valAxisLabelColor: "94A3B8",
    catAxisLabelColor: "94A3B8",
    valGridLine: { color: "1E293B", size: 1 },
    catGridLine: { style: "none" },
    plotAreaFill: { color: "0D1220" },
    chartAreaFill: { color: "0A0E1A" },
    showLegend: false,
    showTitle: false,
    barGapWidthPct: 35,
  });

  // Right: 3 milestone cards
  const milestones = [
    { val: "$450K", label: "Año 1 — Seed\nPrimeros contratos B2B", color: C.cyan },
    { val: "$8.5M", label: "Año 3 — Growth\nExpansión Blue Economy", color: C.violet },
    { val: "$84M", label: "Año 5 — Scale\n75% margen bruto", color: C.gold },
  ];
  milestones.forEach((m, i) => {
    const my = 1.05 + i * 1.28;
    addCard(s, 6.45, my, 3.3, 1.1, C.card, m.color, 1.5);
    addText(s, m.val, 6.62, my + 0.05, 1.8, 0.55, {
      fontSize: 22, bold: true, color: m.color, fontFace: "Cambria",
      align: "left", valign: "middle", margin: 0,
    });
    addText(s, m.label, 6.62, my + 0.58, 3.0, 0.44, {
      fontSize: 10, color: C.light, fontFace: "Calibri",
      align: "left", valign: "top", margin: 0,
    });
  });

  // Bottom KPI row
  addRect(s, 0, 4.88, 10, 0.74, C.navy);
  const kpis = ["75% Margen Bruto", "12% APY Partners", "€70M+ Pipeline", "Break-even Año 2"];
  const kColors = [C.cyan, C.gold, C.green, C.violet];
  kpis.forEach((k, i) => {
    const kx = 0.5 + i * 2.38;
    addText(s, k, kx, 4.88, 2.18, 0.74, {
      fontSize: 12, bold: true, color: kColors[i], fontFace: "Calibri",
      align: "center", valign: "middle", margin: 0,
    });
  });

  addSlideNum(s, 11);
})();

// ──────────────────────────────────────────────────────────────────────────────
// SLIDE 12 — ROADMAP
// ──────────────────────────────────────────────────────────────────────────────
(function slide12() {
  const s = pres.addSlide();
  addBg(s);

  // Top bar
  addRect(s, 0, 0, 10, 0.78, C.surface);
  addText(s, "Roadmap de Ejecución — De MVP a Ecosistema Global", 0.3, 0, 9.4, 0.78, {
    fontSize: 22, bold: true, color: C.white, fontFace: "Cambria",
    align: "left", valign: "middle", margin: 0,
  });

  // Timeline connector dots
  addRect(s, 0.5, 2.22, 9.0, 0.03, C.dark);
  const dotX = [1.62, 4.97, 8.32];
  const dotColors = [C.green, C.cyan, C.violet];
  dotX.forEach((dx, i) => {
    addEllipse(s, dx - 0.18, 2.1, 0.35, 0.35, dotColors[i]);
  });

  // 3 phase columns
  const phases = [
    {
      num: "Fase 1",  period: "Q1–Q2 2025", color: C.green,
      items: [
        "✓ MVP BeZhas Platform live",
        "✓ Integración Incubazul",
        "✓ Primeros 50 clientes B2B",
        "✓ IA Escrow beta cerrada",
        "→ Licitaciones €70M+ en proceso",
      ],
    },
    {
      num: "Fase 2",  period: "Q3–Q4 2025", color: C.cyan,
      items: [
        "Plugin WordPress oficial",
        "SDK Python + Java lanzados",
        "100 partners activos",
        "Contrato Puerto Barcelona",
        "BEZ-Coin en exchanges",
      ],
    },
    {
      num: "Fase 3",  period: "2026–2027", color: C.violet,
      items: [
        "Expansión EU · LATAM · MENA",
        "Control jerárquico enterprise",
        "White label para bancos",
        "DAO gobernanza completa",
        "IPO / Token listing Tier-1",
      ],
    },
  ];

  phases.forEach((ph, i) => {
    const px = 0.22 + i * 3.27;
    addCard(s, px, 0.92, 3.08, 4.55, C.card, ph.color, 1.5);

    // Header
    addRect(s, px, 0.92, 3.08, 0.68, C.dark);
    addText(s, ph.num, px + 0.15, 0.92, 1.2, 0.68, {
      fontSize: 16, bold: true, color: ph.color, fontFace: "Cambria",
      align: "left", valign: "middle", margin: 0,
    });
    addText(s, ph.period, px + 1.45, 0.92, 1.5, 0.68, {
      fontSize: 11, color: C.light, fontFace: "Calibri",
      align: "right", valign: "middle", margin: 0,
    });

    // Items
    ph.items.forEach((item, ii) => {
      const isCheck = item.startsWith("✓");
      addText(s, item, px + 0.2, 1.72 + ii * 0.64, 2.68, 0.58, {
        fontSize: 10.5, color: isCheck ? C.green : C.light, fontFace: "Calibri",
        align: "left", valign: "middle", margin: 0, bold: isCheck,
      });
    });
  });

  addSlideNum(s, 12);
})();

// ──────────────────────────────────────────────────────────────────────────────
// SLIDE 13 — CIERRE / CTA
// ──────────────────────────────────────────────────────────────────────────────
(function slide13() {
  const s = pres.addSlide();
  addBg(s);

  // Subtle glow ellipse (decorative)
  addEllipse(s, 2.5, 0.8, 5.0, 3.0, "0B1526");

  // Main headline
  addText(s, "¿Listo para Convertir", 0.4, 0.85, 9.2, 0.95, {
    fontSize: 40, bold: true, color: C.white, fontFace: "Cambria",
    align: "center", valign: "middle", margin: 0,
  });
  addText(s, "Costos en Capital?", 0.4, 1.8, 9.2, 0.95, {
    fontSize: 40, bold: true, color: C.cyan, fontFace: "Cambria",
    align: "center", valign: "middle", margin: 0,
  });

  // 4 proof bullets
  const proofs = [
    "✓  Tecnología blockchain de producción operando hoy",
    "✓  Pipeline de contratos públicos > €70M identificado",
    "✓  Modelo SaaS con 75% de margen bruto comprobado",
    "✓  Equipo fundador con track record en B2B y blockchain",
  ];
  proofs.forEach((p, i) => {
    addText(s, p, 1.5, 2.88 + i * 0.38, 7.0, 0.36, {
      fontSize: 11.5, color: C.green, bold: true, fontFace: "Calibri",
      align: "left", valign: "middle", margin: 0,
    });
  });

  // Full-width CTA box
  addRect(s, 0.3, 4.38, 9.4, 0.72, C.cyan);
  addText(s, "AGENDA TU SESIÓN PRIVADA DE INVERSIÓN  →", 0.3, 4.38, 9.4, 0.72, {
    fontSize: 18, bold: true, color: C.bg, fontFace: "Cambria",
    align: "center", valign: "middle", margin: 0,
  });

  // Contact
  addText(s, "investors@bez.digital  |  +34 956 000 000  |  bez.digital", 0.3, 5.15, 9.4, 0.38, {
    fontSize: 11, color: C.light, fontFace: "Calibri",
    align: "center", valign: "middle", margin: 0,
  });

  // Small BEZ badge
  addEllipse(s, 9.48, 4.78, 0.42, 0.42, C.violet);
  addText(s, "BEZ", 9.48, 4.78, 0.42, 0.42, {
    fontSize: 8.5, bold: true, color: C.white, fontFace: "Calibri",
    align: "center", valign: "middle", margin: 0,
  });

  addSlideNum(s, 13);
})();

// ──────────────────────────────────────────────────────────────────────────────
// WRITE FILE
// ──────────────────────────────────────────────────────────────────────────────
pres.writeFile({ fileName: "D:\\BeZhas-Blockchain\\BeZhas_Investor_Deck_2025.pptx" })
  .then(() => {
    console.log("✅  Presentación creada: D:\\BeZhas-Blockchain\\BeZhas_Investor_Deck_2025.pptx");
    console.log("    13 diapositivas · Diseño BeZhas Premium · Lista para inversores");
  })
  .catch((err) => {
    console.error("❌  Error al generar la presentación:", err);
    process.exit(1);
  });
