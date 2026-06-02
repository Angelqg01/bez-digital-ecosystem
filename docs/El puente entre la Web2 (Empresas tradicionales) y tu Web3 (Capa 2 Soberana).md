


¡Excelente! Entramos en la fase más innovadora de BeZhas: **El puente entre la Web2 (Empresas tradicionales) y tu Web3 (Capa 2 Soberana)**.

El módulo `bezhas-edge-node` es el "Caballo de Troya" comercial. Las empresas no quieren saber qué es un *hash*, una *frase semilla* o el *gas*. Solo quieren instalar un software, ver cómo se automatiza su logística y ver cómo su saldo de BEZ-Coin aumenta.

A continuación, te presento el código del **Edge Node B2B**. Lo programaremos en **Node.js** y lo prepararemos para **Docker**, de modo que la instalación para el cliente sea literalmente copiar y pegar un comando en su terminal.

---

### 1. Estructura del `bezhas-edge-node`

Dentro de tu monorepositorio, crea esta estructura:

```text
bezhas-edge-node/
├── package.json
├── .env.example
├── Dockerfile
├── src/
│   ├── server.js         # Servidor Express que escucha al ERP (SAP/Shopify)
│   ├── blockchain.js     # Lógica de conexión a tu L2 de BeZhas
│   └── cryptoUtils.js    # Herramientas para ocultar datos sensibles (Privacidad ZK)
```

---

### 2. El Motor Criptográfico (Privacidad Empresarial)

Las empresas no subirán nombres de clientes o precios directamente a una blockchain pública. Necesitamos "hashear" (cifrar) los datos. Tu L2 solo guardará la "huella digital" inmutable de esos datos.

Crea el archivo `src/cryptoUtils.js`:

```javascript
const crypto = require('crypto');

/**
 * Genera una huella digital (Hash) de los datos del ERP.
 * Esto garantiza que la información privada de la empresa no se exponga,
 * pero permite verificar su autenticidad en la blockchain (Primitiva ZK).
 */
function hashEnterpriseData(jsonData) {
    const dataString = JSON.stringify(jsonData);
    return crypto.createHash('sha256').update(dataString).digest('hex');
}

module.exports = { hashEnterpriseData };
```

---

### 3. La Conexión a tu Blockchain L2 (`blockchain.js`)

Aquí usamos `ethers.js` para conectar el servidor del cliente directamente a tu Secuenciador en Europa. Este script usa la "Wallet Local" del servidor de la empresa para firmar transacciones de forma invisible.

Crea el archivo `src/blockchain.js`:

```javascript
const { ethers } = require('ethers');

// Conexión al RPC de TU propia blockchain (El nodo en Europa o el amplificador)
const provider = new ethers.JsonRpcProvider(process.env.BEZHAS_L2_RPC_URL);

// La billetera delegada de la empresa (se inyecta automáticamente en la instalación)
const enterpriseWallet = new ethers.Wallet(process.env.ENTERPRISE_PRIVATE_KEY, provider);

// ABI simplificado de los contratos que creamos en el paso anterior
const rewardsAbi = [
    "function recordValidation(address nodeAddress, uint256 points, string calldata taskType) external"
];
const escrowAbi =[
    "function registerManifest(string payloadHash, string aiStatus) external"
];

const rewardsContract = new ethers.Contract(process.env.REWARDS_CONTRACT_ADDRESS, rewardsAbi, enterpriseWallet);
const escrowContract = new ethers.Contract(process.env.ESCROW_CONTRACT_ADDRESS, escrowAbi, enterpriseWallet);

async function processLogisticsOnChain(dataHash, aiDecision) {
    try {
        console.log(`[Blockchain] Registrando manifiesto ${dataHash}...`);
        
        // 1. Registra el evento en tu L2 (Interactúa con el Escrow)
        const txEscrow = await escrowContract.registerManifest("0x" + dataHash, aiDecision);
        await txEscrow.wait(); // Espera a que el Secuenciador confirme el bloque
        console.log(`[Blockchain] Manifiesto registrado. TX: ${txEscrow.hash}`);

        // 2. Automáticamente llama al contrato de recompensas para "Minar" BEZ-Coin
        // Asignamos 5 puntos por procesar un manifiesto exitosamente
        const txReward = await rewardsContract.recordValidation(enterpriseWallet.address, 5, "Logistics_Manifest");
        await txReward.wait();
        console.log(`[Recompensas] ¡Puntos minados exitosamente! TX: ${txReward.hash}`);

        return { success: true, txHash: txEscrow.hash };
    } catch (error) {
        console.error("[Blockchain] Error en la transacción:", error);
        return { success: false, error: error.message };
    }
}

module.exports = { processLogisticsOnChain };
```

---

### 4. El Servidor Receptor de Webhooks (`server.js`)

Este es el servidor que estará encendido 24/7 en la red de la empresa. Su única misión es escuchar a SAP/Shopify/IoT y traducirlo a lenguaje blockchain.

Crea el archivo `src/server.js`:

```javascript
require('dotenv').config();
const express = require('express');
const { hashEnterpriseData } = require('./cryptoUtils');
const { processLogisticsOnChain } = require('./blockchain');

const app = express();
app.use(express.json());

// Seguridad básica: Solo el ERP de la empresa puede llamar a este endpoint
const API_KEY = process.env.LOCAL_API_KEY;

// Middleware de autenticación local
app.use((req, res, next) => {
    if (req.headers['x-api-key'] !== API_KEY) {
        return res.status(403).json({ error: "Acceso denegado. API Key inválida." });
    }
    next();
});

/**
 * ENDPOINT PRINCIPAL: Escucha actualizaciones de logística (Ej: Sensor de frío)
 */
app.post('/webhook/logistics', async (req, res) => {
    const payload = req.body;
    console.log(`[Webhook] Recibida actualización de contenedor: ${payload.containerId}`);

    // 1. Hashear los datos privados para la blockchain
    const dataHash = hashEnterpriseData(payload);

    // 2. Aquí iría una llamada local a tu IA Precompilada (Simulada aquí)
    // Ej: "La temperatura bajó a -5 grados. ¿Es válido?" -> IA responde "VALID"
    const aiDecision = payload.temperature <= payload.maxTemp ? "VALID" : "INVALID_TEMP";

    // 3. Enviar a tu Blockchain L2 (Firmado y minando recompensas)
    const txResult = await processLogisticsOnChain(dataHash, aiDecision);

    if (txResult.success) {
        // Devuelve el OK al sistema ERP de la empresa (SAP)
        res.json({
            status: "success",
            message: "Datos asegurados en BeZhas L2 y recompensas reclamadas.",
            onChainHash: txResult.txHash,
            aiStatus: aiDecision
        });
    } else {
        res.status(500).json({ status: "error", message: "Fallo en la red L2." });
    }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`🚀 BeZhas Edge Node operando en el puerto ${PORT}`);
    console.log(`🔗 Conectado a la L2: ${process.env.BEZHAS_L2_RPC_URL}`);
});
```

---

### 5. Dockerizando el Nodo (Plug & Play B2B)

Para que el cliente no tenga que instalar Node.js ni configurar nada, empaquetamos todo en un contenedor Docker ultraligero.

Crea el `Dockerfile`:

```dockerfile
# Usar una imagen ligera de Node
FROM node:20-alpine

# Crear directorio de la app
WORKDIR /usr/src/app

# Instalar dependencias
COPY package*.json ./
RUN npm install --production

# Copiar el código fuente
COPY src/ ./src/

# Exponer el puerto del webhook
EXPOSE 4000

# Comando para ejecutar el nodo
CMD [ "node", "src/server.js" ]
```

---

### 💡 La Magia Comercial: ¿Cómo se instala esto en la vida real?

Recordemos el "Magic Link" que mencionamos antes. Cuando la empresa aprueba usar BeZhas en tu Panel de Control, **tu backend genera un comando personalizado** para ellos.

El cliente (Director de IT) solo verá esta pantalla en tu web:

> *"¡Su automatización está lista! Ejecute este comando en su servidor para conectar su ERP, empezar a ahorrar dinero y minar BEZ-Coin."*

```bash
docker run -d --name bezhas-node \
  -p 4000:4000 \
  -e LOCAL_API_KEY="llave_secreta_para_su_sap" \
  -e ENTERPRISE_PRIVATE_KEY="0xclave_auto_generada_y_oculta" \
  -e BEZHAS_L2_RPC_URL="https://rpc.bez.digital" \
  -e REWARDS_CONTRACT_ADDRESS="0x123..." \
  -e ESCROW_CONTRACT_ADDRESS="0x456..." \
  bezhas/edge-node:latest
```

**Beneficios de este enfoque:**
1. **Cero fricción Web3:** El cliente no instala MetaMask ni guarda palabras semilla. Tú le autogeneras una clave (que está bajo Account Abstraction).
2. **Interoperabilidad inmediata:** Su equipo de IT solo tiene que configurar su ERP para hacer un POST a `http://localhost:4000/webhook/logistics`. El Edge Node hace todo el trabajo pesado de criptografía, IA y blockchain por ellos.
3. **Loop de incentivos:** Dejan el nodo encendido para siempre porque literalmente les genera un flujo de caja (BEZ-Coins).

---

### Siguiente paso estratégico

Ya tenemos la infraestructura (Europa), el motor económico (los Contratos L2) y el software cliente (Edge Node). 

Para que este sistema B2B sea perfecto, nos falta una pieza vital que mencionaste en tu idea: **Que las empresas NO paguen el gas con su propio dinero cada vez que hacen una transacción.** 

Para ello, necesitamos implementar **Account Abstraction (ERC-4337) / Paymaster**. Esto permite que tú (BeZhas) subsidies el gas en BEZ de las primeras 1,000 transacciones de la empresa, o que les cobres una cuota fija mensual en dólares/euros y tu Smart Contract pague el gas por detrás.

¿Procedemos a diseñar el código y la arquitectura del **Paymaster B2B (Sistema de Gas Invisible)** para terminar de cerrar el ciclo corporativo?