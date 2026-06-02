# Arquitectura y Despliegue: Oráculo de Precios y Balanceador RPC para BeZhas L2

## 1. Servidor Oráculo de Precios B2B (Price Feeds)

Dado que en `bezhas-pay-system.jsx` el costo fiat de la IA, los servicios y licencias empresariales varía en dólares o euros (fijos) y el token de cobro interno (y Gas) siempre será BEZ (volátil), la blockchain demanda un Oráculo de Precios (Price Oracle) que se actualice constantemente.

### Arquitectura Propuesta del Oráculo
Dado que las empresas pagan en la Mainnet de Polygon o Ethereum los tokens BEZ, el suministro en la red base debe ser rastreado e internalizado (Oracle Node).
1. **Contrato Oráculo (L2):** Desplegar `.sol` en la red BeZhas L2 que contenga variables públicas: `BEZ_USD`, `ETH_USD`, `BNB_USD`, `SOL_USD`, `EUR_USD`. Solamente la Wallet ("Oracle EOA Address") estará autorizada para editar estos datos.
2. **Servicio Oracle (Daemon / Cron Job en Servidor Controlador):** Un script en Node.js o Go, aislado del Nodo Secuenciador, que toma los precios de APIs de Binance / CoinMarketCap y del Exchange Descentralizado (DEX) donde BEZ cotice y ejecuta el `updatePrices(uint256[] arr)` en el Oráculo.

### Consideraciones Económicas del Oráculo B2B
- Actualizar precios en vivo cada 3 segundos costaría **millones** en Gas en Ethereum. Afortunadamente en BeZhas L2, tú controlas el gas nativo.
- Sin embargo, **saturarías tu propia mempool** y agrandarías la Data Availability que pagas en la L1 (Ethereum).
- **Frecuencia Óptima Recomendada:** Ejecutar la actualización en vivo (On-Chain) mediante el script *cada 10 minutos*, o bien, mediante un Disyuntor (Circuit Breaker) que dispare la actualización inmediata solo cuando exista una volatilidad mayor al `>3%`.


## 2. Balanceador de Carga RPC (RPC Load Balancer) - Protección B2B

Para evitar cuellos de botella y maximizar la seguridad empresarial B2B B2C para BeZhas.

### ¿Por qué lo necesitas?
Miles de corporaciones conectarán MetaMask o la Extensión Wallet de forma constante para ver el saldo en vivo (`eth_getBalance` request). Si 50,000 requests golpean el nodo Sequencer (el núcleo que arma los bloques `op-geth`), **se caerá la blockchain y las empresas no podrán operar**.

### Estructura Nginx Inverso "Nodos Réplica"
1. Servidor Principal: Corre el Secuenciador (Cobra y emite Bloques). Puerto `8545` bloqueado de todo acceso TCP externo. Sólo el "Balanceador" lo alcanza.
2. Servidores "Read-Replica": 3 u 8 Servidores menores (`$20 / $40 mensual c/u`) que **solo** sincronizan la DB y levantan `op-geth` en modo `--syncmode full` + el parámetro `--rpc.gascap 0` apagando la posibilidad de inyectar transacciones o minar por ellos.
3. Servidor de Balanceo Carga/Proxy (Nginx o HAProxy): `rpc.bez.digital`. Toda petición externa (como Metamask, Web3.js en el frontend) golpea este servidor que inspecciona el cuerpo del POST JSON-RPC.

```nginx
# Extracto Ejemplo: nginx_rpc.conf a incorporar en el 'Control Center' B2B
upstream bezhas_read_nodes {
    server 10.0.0.12:8545; # Replica Europa
    server 10.0.0.13:8545; # Replica America
    # server 10.0.0.14:8545; # Replica Asia (Apagado preventivo/Mantenimiento)
}

upstream bezhas_sequencer {
    server 10.0.0.2:8545; # EL CORE PRINCIPAL (Escritura) Mision Critica
}

server {
    listen 80;
    server_name rpc.bez.digital;
    
    # 1. Rutear operaciones de Consulta (Lectura pura)
    location / {
        proxy_pass http://bezhas_read_nodes;
        # Cache opcional agresivo por 3 secs para 'eth_chainId' o 'eth_blockNumber'
    }

    # 2. Rutear Transacciones Oficiales e Inyecciones de contratos (Escritura / Gas Fees Payment)
    location ~* "eth_sendRawTransaction" {
        proxy_pass http://bezhas_sequencer;
        # Solo entra si la empresa pagó el Gas internamente
    }
}
```

### Seguridad B2B
- Limitar el caudal de IP (Rate Limiting) de las empresas a máximo `100 solicitudes / IP` por segundo para prevenir ataques (DDoS L7 Extremo).
- Eliminar cabeceras reveladoras como el `Server: nginx/1.22`.
