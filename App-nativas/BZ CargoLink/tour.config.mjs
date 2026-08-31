// Recorrido "Cómo usar BZ CargoLink" — contenido de las escenas.
// Genera public/como-usar.html con:  pnpm tour:build
// Motor + mecánica: @bezhas/guided-tour (packages/guided-tour).

export default {
  appName: 'BZ CargoLink',
  subtitle: 'Cómo funciona',
  logo: '⚓',
  durationMs: 7000,
  theme: {
    primary: '#00F0FF',
    secondary: '#79ff5b',
    gold: '#FFD700',
    pink: '#FF6B9D',
    purple: '#a855f7',
    bg: '#0A0A0C',
  },
  scenes: [
    {
      label: 'Introducción', kicker: 'BZ CargoLink',
      title: 'El validador irrefutable de tu logística',
      body: 'Tokeniza cada evento físico de la carga (RWA) y automatiza aduanas, estiba y pagos sobre una L2. Los sensores son tus oráculos físicos; el token BEZ es el combustible.',
      tags: [['c', 'Capa 2 · Polygon'], ['g', 'Escrow en BEZ'], ['p', 'Anti-manipulación']],
      visual: `
        <div class="phone">
          <div class="bar">{{ico:anchor}}<b>VALIDATOR_TERMINAL</b><span class="rt">live</span></div>
          <div class="mini pop"><div class="h">{{ico:map}} Ruta activa</div><div class="s">Algeciras → Frankfurt · pharma</div></div>
          <div class="mini pop d1"><div class="h">{{ico:radio}} 4 sensores vinculados</div><div class="s">temp · humedad · e-seal · GPS</div></div>
          <div class="mini pop d2"><div class="h">{{ico:scale}} Escrow</div><div class="row" style="margin-top:6px"><span class="chip cyan">100 BEZ</span><span class="chip green">LOCKED</span></div></div>
          <div class="mini pop d3" style="text-align:center"><div class="float">{{ico:shield}}</div><div class="s">Prueba on-chain a cada paso</div></div>
        </div>`,
    },
    {
      label: 'Ruta Activa', kicker: 'Pestaña · Active',
      title: 'Sigue la ruta y genera la prueba de entrega',
      body: 'La pantalla principal muestra la red global de puertos, el progreso de entrega del B-UID y el botón para generar la Prueba de Entrega (POD) firmada al cerrar el ciclo.',
      tags: [['c', 'Mapa de puertos'], ['', 'Progreso por etapas'], ['g', 'POD firmado']],
      visual: `
        <div class="phone">
          <div class="bar">{{ico:map}}<b>RED GLOBAL DE PUERTOS</b></div>
          <div class="mini" style="height:150px;position:relative;overflow:hidden">
            <svg viewBox="0 0 240 120" style="position:absolute;inset:0;width:100%;height:100%">
              <path class="draw" d="M30 90 C 90 20, 150 100, 210 34" stroke="var(--primary)" stroke-width="2.5" fill="none"/>
              <circle cx="30" cy="90" r="5" fill="var(--secondary)"/>
              <circle cx="210" cy="34" r="5" fill="var(--pink)"/>
              <circle cx="210" cy="34" r="9" fill="none" stroke="var(--pink)" stroke-width="2" class="ping"/>
            </svg>
          </div>
          <div class="mini pop d1"><div class="h">Progreso de entrega</div><div class="bars"><b class="b1" style="width:78%"></b></div><div class="s" style="margin-top:6px">IN_TRANSIT · 4/6 etapas</div></div>
          <div class="mini pop d2 float" style="text-align:center;color:var(--secondary)"><div class="h" style="justify-content:center">{{ico:finger}} GENERAR PRUEBA DE ENTREGA</div></div>
        </div>`,
    },
    {
      label: 'Cargo Fingerprint', kicker: 'Pestaña · Audit',
      title: 'Huella fotogramétrica anclada en la L2',
      body: 'Registra el hash forense de la carga (Cargo Fingerprint). Cualquier discrepancia posterior es detectable: la integridad queda sellada de forma inmutable en la cadena.',
      tags: [['c', 'Hash forense'], ['g', 'Inmutable'], ['', 'Integrity Module v2.4']],
      visual: `
        <div class="phone">
          <div class="bar">{{ico:finger}}<b>CARGO FINGERPRINT</b></div>
          <div class="mini pop" style="text-align:center;padding:22px"><div class="float">{{ico:finger}}</div><div class="s" style="margin-top:10px">Escaneando activo físico…</div></div>
          <div class="mini pop d1"><div class="s" style="font-family:monospace;color:var(--secondary);word-break:break-all">0x7a6b…3f2c ✓ anclado</div></div>
          <div class="mini pop d2 row"><span class="chip green">SELLADO EN L2</span><span class="chip cyan">bloque #48210</span></div>
        </div>`,
    },
    {
      label: 'Smart Stowage', kicker: 'Pestaña · Stowage',
      title: 'Estiba segura: centro de gravedad validado',
      body: 'Calcula y valida el centro de gravedad (COG) del contenedor en el buque antes de zarpar. Solo avanza a DEPARTED si la distribución de peso es segura.',
      tags: [['c', 'COG en tiempo real'], ['g', 'Bloquea si es inseguro'], ['', 'Physical Layout v1.0']],
      visual: `
        <div class="phone">
          <div class="bar">{{ico:box}}<b>SMART STOWAGE</b></div>
          <div class="mini" style="height:140px;position:relative">
            <svg viewBox="0 0 220 120" style="width:100%;height:100%">
              <rect x="20" y="70" width="180" height="34" rx="4" fill="#1f1f26" stroke="var(--border)"/>
              <rect x="30" y="52" width="40" height="18" rx="2" fill="rgba(0,240,255,0.25)" stroke="var(--primary)"/>
              <rect x="78" y="44" width="40" height="26" rx="2" fill="rgba(168,85,247,0.25)" stroke="var(--purple)"/>
              <rect x="126" y="56" width="40" height="14" rx="2" fill="rgba(121,255,91,0.25)" stroke="var(--secondary)"/>
              <line x1="110" y1="30" x2="110" y2="112" stroke="var(--gold)" stroke-dasharray="4 3" class="draw"/>
              <circle cx="110" cy="88" r="5" fill="var(--gold)" class="float"/>
            </svg>
          </div>
          <div class="mini pop d1 row"><div class="h">COG</div><span class="chip amber" style="margin-left:auto">x 45.8 · y 36.4</span></div>
          <div class="mini pop d2 row"><span class="chip green">DISTRIBUCIÓN SEGURA</span><span class="chip cyan">1.270 t</span></div>
        </div>`,
    },
    {
      label: 'Customs Sync', kicker: 'Pestaña · Customs',
      title: 'Despacho aduanero automatizado',
      body: 'Sincroniza el manifiesto con la autoridad aduanera (formato UBL 2.1) y dispara el evento ON_CUSTOMS_CLEARED. El paso de aduana deja de ser papeleo manual.',
      tags: [['c', 'UBL 2.1'], ['g', 'Ventanilla única'], ['', 'Webhook firmado']],
      visual: `
        <div class="phone">
          <div class="bar">{{ico:globe}}<b>CUSTOMS SYNC</b></div>
          <div class="mini pop"><div class="h">{{ico:globe}} Manifiesto → ASYCUDA</div><div class="s">enviado · UBL 2.1</div></div>
          <div class="mini pop d1" style="text-align:center;padding:18px"><div class="float">{{ico:shield}}</div><div class="s" style="margin-top:8px">Despacho aprobado</div></div>
          <div class="mini pop d2 row"><span class="chip green">CUSTOMS_CLEARED</span><span class="chip cyan">ON_CUSTOMS_CLEARED</span></div>
        </div>`,
    },
    {
      label: 'Sensores IoT', kicker: 'Config › Sensores · Telemetría',
      title: 'Sensores en vivo: el oráculo físico',
      body: 'Registra dispositivos (e-seal, reefer, GPS, luz, presión, BLE) desde Configuración › Sensores. La telemetría llega en tiempo real y detecta brechas: cadena de frío, impacto, intrusión de luz o apertura del precinto.',
      tags: [['c', 'Feed en vivo'], ['p', 'Brechas automáticas'], ['g', 'Firma edge secp256k1']],
      visual: `
        <div class="phone">
          <div class="bar">{{ico:radio}}<b>TELEMETRÍA</b><span class="rt">LIVE ●</span></div>
          <div class="mini pop row"><div class="h">{{ico:radio}} Temp</div><b style="margin-left:auto;color:var(--secondary)">4.8°C</b></div>
          <div class="mini pop d1 row"><div class="h" style="color:var(--danger)">Temp</div><b style="margin-left:auto;color:var(--danger)">14.0°C</b><span class="chip red">BREACH</span></div>
          <div class="mini pop d2 row"><div class="h" style="color:var(--danger)">{{ico:shield}} E-seal</div><span class="chip red" style="margin-left:auto">TAMPER</span><span class="chip green">signed</span></div>
          <div class="mini pop d3" style="border-color:rgba(248,113,113,0.4);background:rgba(248,113,113,0.05)"><div class="h" style="color:var(--danger)">⚠ TAMPER DETECTADO</div><div class="s">e-seal abierto fuera de zona autorizada</div></div>
        </div>`,
    },
    {
      label: 'Geocercas & Terceros', kicker: 'Config › Sensores',
      title: 'Geocercas e ingesta de terceros',
      body: 'Define zonas aduaneras autorizadas y corredores de ruta. Un precinto abierto fuera de zona = manipulación. Además, carriers y aduanas (DHL, autoridad portuaria, LoRaWAN) entran por webhook HMAC al mismo pipeline.',
      tags: [['c', 'Zonas + corredores'], ['p', 'Fuera de zona = tamper'], ['g', 'Webhook HMAC']],
      visual: `
        <div class="phone">
          <div class="bar">{{ico:pin}}<b>GEOCERCAS</b></div>
          <div class="mini" style="height:150px;position:relative">
            <svg viewBox="0 0 220 130" style="width:100%;height:100%">
              <circle cx="70" cy="70" r="42" fill="rgba(0,240,255,0.08)" stroke="var(--primary)" stroke-dasharray="4 3"/>
              <text x="70" y="70" fill="var(--primary)" font-size="9" text-anchor="middle">Aduana</text>
              <circle cx="70" cy="70" r="4" fill="var(--secondary)"/>
              <circle cx="176" cy="40" r="4" fill="var(--danger)" class="float"/>
              <circle cx="176" cy="40" r="10" fill="none" stroke="var(--danger)" stroke-width="2" class="ping"/>
              <text x="176" y="60" fill="var(--danger)" font-size="8" text-anchor="middle">fuera</text>
            </svg>
          </div>
          <div class="mini pop d1 row"><div class="h">{{ico:globe}} DHL_API</div><span class="chip cyan" style="margin-left:auto">HMAC ✓</span></div>
          <div class="mini pop d2 row"><span class="chip green">PROPRIETARY_DEVICE</span><span class="chip cyan">CHECKPOINT</span></div>
        </div>`,
    },
    {
      label: 'Disputas & Escrow', kicker: 'Oráculo de disputas',
      title: 'La brecha retiene el pago automáticamente',
      body: 'El oráculo gradúa cada brecha (leve→crítica). Una brecha grave pone el escrow BEZ en DISPUTED y propone la liquidación: liberar al vendedor, reembolsar al comprador o un acuerdo parcial. Tú decides con un clic.',
      tags: [['p', 'Escrow DISPUTED'], ['g', 'Propuesta de settlement'], ['', 'release / refund / partial']],
      visual: `
        <div class="phone">
          <div class="bar">{{ico:scale}}<b>DISPUTAS DEL ESCROW</b></div>
          <div class="mini pop" style="border-color:rgba(248,113,113,0.4)"><div class="row"><span class="chip red">Crítico · AUTO_CLAIM</span></div><div class="s" style="margin-top:6px">CONTAINER_UNSEALED · fuera de zona</div><div class="row" style="margin-top:8px"><span class="chip red">100 BEZ ↩ comprador</span></div></div>
          <div class="mini pop d1" style="border-color:rgba(255,215,0,0.35)"><div class="row"><span class="chip amber">Moderado · HOLD_ESCROW</span></div><div class="row" style="margin-top:8px"><span class="chip amber">30 BEZ</span><span class="chip green">70 BEZ vendedor</span></div></div>
          <div class="mini pop d2 row" style="gap:6px"><span class="chip green">Liberar</span><span class="chip cyan">Parcial</span><span class="chip red">Reembolsar</span></div>
        </div>`,
    },
    {
      label: 'Anclaje & Wallet', kicker: 'Prueba on-chain · Wallet · API',
      title: 'Prueba criptográfica de una ruta sin alteraciones',
      body: 'La telemetría se consolida en un merkle root anclado en la L2: cualquier lectura se prueba on-chain. En Wallet ves tus saldos y escrows en BEZ; en API HUB integras todo en tu ERP con webhooks y el SDK.',
      tags: [['c', 'Merkle on-chain'], ['g', 'Wallet · BEZ'], ['', 'API & Webhooks']],
      visual: `
        <div class="phone">
          <div class="bar">{{ico:anchor}}<b>ANCLAJE CRIPTOGRÁFICO</b></div>
          <div class="mini pop"><div class="h">{{ico:anchor}} Merkle root</div><div class="s" style="font-family:monospace;color:var(--secondary);word-break:break-all;margin-top:4px">0x098b43dc… · 13 lecturas</div></div>
          <div class="mini pop d1 row"><div class="h">{{ico:wallet}} Wallet</div><b style="margin-left:auto;color:var(--gold)">1.240 BEZ</b></div>
          <div class="mini pop d2 row"><div class="h">{{ico:code}} API HUB</div><span class="chip cyan" style="margin-left:auto">SDK + Webhooks</span></div>
          <div class="mini pop d3 float" style="text-align:center;color:var(--secondary)"><div class="h" style="justify-content:center">{{ico:shield}} Verificable por terceros</div></div>
        </div>`,
    },
  ],
};
