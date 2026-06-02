


¡Perfecto! Llegamos a la capa más visible y comercial del proyecto. En el mundo B2B, **la interfaz de usuario (UI/UX) lo es todo**. Si a un director de logística le muestras un explorador de bloques lleno de *hashes* hexadecimales o le pides que instale MetaMask, saldrá corriendo. 

El **BeZhas Enterprise Dashboard** debe sentirse como usar Stripe, AWS o Shopify: limpio, profesional y en moneda fiduciaria (Fiat), ocultando toda la complejidad de la blockchain L2, la IA y los Smart Contracts en el *backend*. A esto se le llama una **Experiencia "Web2.5"**.

Aquí tienes el Blueprint Arquitectónico y el código base para el Frontend de tus clientes.

---

### 1. Mapa del Sitio (Sitemap) del Dashboard B2B

El panel de control se dividirá en 5 módulos principales:

1.  📊 **Overview (Centro de Mando):** Resumen de contenedores en tránsito, saldo de Gas y BEZ minados.
2.  📦 **Logistics & RWA (Activos Tokenizados):** Una tabla en vivo donde ven sus manifiestos convertidos en NFTs. Muestra el estado del sensor IoT y si la IA aprobó o rechazó la mercancía.
3.  ⛽ **Corporate Gas Tank (Facturación):** Integración con Stripe. Aquí ven su saldo pre-cargado (ej. $500), el consumo a $0.05 por transacción, y pueden activar la "Recarga Automática".
4.  ⛏️ **Mining Rewards (DePIN):** Su panel de "ganancias". Cuántos BEZ han acumulado por validar operaciones y un botón para "Liquidar a Dólares/Euros" o "Retirar a Billetera Fría".
5.  ⚙️ **Edge Node Setup (Integración):** Donde generan su `API_KEY` y copian el comando de Docker para instalar el nodo en su servidor.

---

### 2. Stack Tecnológico del Frontend

*   **Framework:** Next.js 14 (React) con App Router.
*   **Estilos:** TailwindCSS (para un diseño rápido y corporativo).
*   **Componentes UI:** Shadcn UI o Lucide React (Iconos minimalistas).
*   **Lógica Web3:** Estará oculta. El Frontend no se conecta directamente a la blockchain con MetaMask, sino que hace peticiones HTTP REST a tu servidor Node.js, y es tu servidor quien lee tu red L2.

---

### 3. Código Base: El Componente Principal (Overview Dashboard)

Este es el código de cómo se vería la pantalla principal de un cliente (ej. *Maersk* o *CMA CGM*) al iniciar sesión. Crea este archivo en tu monorepo en `control-center/frontend/app/dashboard/page.tsx`:

```jsx
import React from 'react';
import { Activity, Box, Zap, CreditCard, Server } from 'lucide-react';

export default function EnterpriseDashboard() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">BeZhas Control Center</h1>
          <p className="text-sm text-gray-500">Bienvenido, Global Logistics S.A.</p>
        </div>
        <div className="flex items-center space-x-4">
          <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold flex items-center">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
            Edge Node: Online
          </span>
        </div>
      </header>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        
        {/* Tarjeta 1: Gas Tank (Facturación) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-gray-500 font-medium">Corporate Gas Tank</h3>
            <CreditCard className="text-blue-500" size={24} />
          </div>
          <p className="text-3xl font-bold text-gray-900">$425.50</p>
          <p className="text-sm text-gray-400 mt-2">~8,510 TXs restantes (a $0.05/tx)</p>
          <button className="mt-4 w-full bg-blue-50 hover:bg-blue-100 text-blue-600 py-2 rounded-lg font-medium transition">
            Recargar Saldo (Stripe)
          </button>
        </div>

        {/* Tarjeta 2: Operaciones Automatizadas */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-gray-500 font-medium">Manifiestos Tokenizados</h3>
            <Box className="text-indigo-500" size={24} />
          </div>
          <p className="text-3xl font-bold text-gray-900">1,240</p>
          <p className="text-sm text-green-500 mt-2 font-medium">+15% este mes</p>
        </div>

        {/* Tarjeta 3: Validaciones de IA */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-gray-500 font-medium">Escrow IA (Aprobados)</h3>
            <Activity className="text-purple-500" size={24} />
          </div>
          <p className="text-3xl font-bold text-gray-900">1,180</p>
          <p className="text-sm text-gray-400 mt-2">Resolución en &lt; 2 segundos</p>
        </div>

        {/* Tarjeta 4: El Minado (DePIN Rewards) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-orange-200 bg-gradient-to-br from-white to-orange-50">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-orange-600 font-medium">BEZ Mined (Recompensas)</h3>
            <Zap className="text-orange-500" size={24} />
          </div>
          <p className="text-3xl font-bold text-gray-900">2,450 BEZ</p>
          <p className="text-sm text-gray-500 mt-2">≈ $2,450 USD en valor</p>
          <button className="mt-4 w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg font-medium shadow-sm transition">
            Reclamar Ganancias
          </button>
        </div>
      </div>

      {/* Logística Reciente Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Actividad Logística Reciente</h2>
          <a href="#" className="text-blue-500 hover:underline text-sm font-medium">Ver todo el historial &rarr;</a>
        </div>
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-500 text-sm">
            <tr>
              <th className="p-4">ID Contenedor</th>
              <th className="p-4">Hash L2 (Blockchain)</th>
              <th className="p-4">Estado Sensor</th>
              <th className="p-4">Dictamen IA</th>
              <th className="p-4">Costo Gas</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            <tr className="border-b border-gray-50 hover:bg-gray-50">
              <td className="p-4 font-medium text-gray-900">MSKU1811882</td>
              <td className="p-4 text-blue-500 font-mono text-xs">0x7a3...f4b2</td>
              <td className="p-4">-18.5°C (Estable)</td>
              <td className="p-4"><span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">APROBADO</span></td>
              <td className="p-4 text-gray-500">$0.05</td>
            </tr>
            <tr className="border-b border-gray-50 hover:bg-gray-50">
              <td className="p-4 font-medium text-gray-900">HLBU3349910</td>
              <td className="p-4 text-blue-500 font-mono text-xs">0x2b1...e99a</td>
              <td className="p-4">-12.0°C (Alerta)</td>
              <td className="p-4"><span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">RECHAZADO - SEGURO ACTIVADO</span></td>
              <td className="p-4 text-gray-500">$0.05</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

### 4. La Pestaña de Configuración del Edge Node (El Onboarding)

El objetivo de tu interfaz es que la empresa implemente la solución en 5 minutos. En la sección "Edge Node Setup", el cliente verá un asistente (Wizard) que le dirá:

1.  **Paso 1:** Haz clic para generar tu Clave de API Segura. *(Por detrás, tu backend genera una wallet criptográfica delegada, la guarda encriptada en la base de datos y le muestra solo una API Key tradicional).*
2.  **Paso 2:** Ejecute este comando en la terminal de su servidor de la fábrica/puerto:

```bash
# Este recuadro aparecerá en el Frontend con un botón de "Copiar"
docker run -d --name bezhas-edge \
  -e API_KEY="<TU_API_KEY_AQUI>" \
  -e RPC_URL="https://l2.bez.digital" \
  -p 4000:4000 \
  bezhas/edge-node:latest
```

3.  **Paso 3:** Configure su ERP (SAP/Shopify) para enviar un *Webhook* a `http://[su-ip-local]:4000/logistics` cada vez que se escanee un código de barras.

---

### 5. ¿Cómo se conecta esto con la Blockchain real? (Account Abstraction)

La gran duda técnica: *Si el cliente paga en dólares con Stripe, ¿cómo firma la transacción en la blockchain?*

**La solución es la "Custodia Delegada" (Delegated Custody):**
1.  Cuando la empresa se registra en tu panel, tu backend de Node.js genera una billetera (Wallet A).
2.  Esa Wallet A se financia con el gas (BEZ-Coin) que tu script de Auto-TopUp recargó cuando la empresa pagó con Stripe.
3.  El *Edge Node* que instala la empresa tiene acceso a los permisos para usar la Wallet A.
4.  Por tanto, cada vez que la empresa manda un dato de logística, el *Edge Node* firma la transacción matemáticamente en su servidor y la envía a la L2. La transacción es 100% criptográfica y real, pero el humano solo vio un saldo en dólares en una pantalla web bonita.

---

### Resumen de la Fase Actual

En este punto, hemos definido y estructurado:
1.  **La Arquitectura del Servidor Tricontinental:** Empezando con el Master Node en Europa.
2.  **La Blockchain (L2) Soberana:** Forkeando OP Stack con BEZ como moneda nativa de gas y precompilados de IA.
3.  **Los Smart Contracts:** El nuevo BEZCoinV2 y el motor DePIN B2B (EdgeNodeRewards).
4.  **El Software Cliente:** El Edge Node Dockerizado que procesa los webhooks de las empresas.
5.  **El Frontend / Control Center:** El panel B2B estilo "SaaS" con recarga en Fiat y cobro de gas a $0.05.

### ¿Cuál es el siguiente paso para ejecutar todo esto?

Si presentas este plan a fondos de inversión europeos o socios logísticos, la arquitectura es impecable y está alineada con normativas institucionales. 

Para que tu equipo técnico comience la fase de **producción real**, el siguiente paso lógico es la **Preparación del Entorno de Pruebas (Testnet Local)**. 

¿Quieres que te prepare el **Guión de Despliegue de la Devnet (Testnet Privada)**? Es decir, los comandos exactos para levantar toda esta red localmente en una sola computadora para que tu equipo pruebe que la IA, los contratos y los $0.05 de gas funcionan antes de alquilar los servidores en Europa.