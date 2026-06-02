# ⚡ BeZhas Energy: Virtual Power Plant & Ciber-physical Hub

Bienvenido a **BeZhas Energy**, la sub-aplicación del ecosistema BeZhas-Blockchain encargada de revolucionar la gestión energética. BeZhas no es solo una blockchain financiera; es una capa L2 que funciona como una **Central Eléctrica Virtual (VPP)** autónoma, impulsada por Inteligencia Artificial y Smart Contracts.

## 🌟 Capacidades Fundamentales

### 1. Arbitraje Energético con Inteligencia Artificial
El **BeZhas Energy Agent** analiza en tiempo real los precios del mercado mayorista (OMIE) y la telemetría de la red (ESIOS). Con base en modelos predictivos (XGBoost/LightGBM), la IA decide:
- **Cargar baterías** cuando el precio del pool eléctrico es bajo o negativo.
- **Descargar/Vender energía** a la red cuando el precio es alto.
- **Optimizar el autoconsumo** prediciendo la radiación solar y la demanda de la instalación.

### 2. Tokenización de Activos Reales (RWA) y CAEs
La energía ahorrada y generada se certifica criptográficamente mediante el contrato `EnergyCAEToken.sol`. 
- **CAEs (Certificados de Ahorro Energético):** Tokenización del ahorro energético comprobable, permitiendo a empresas vender sus CAEs en un mercado secundario 100% on-chain.
- **Micro-mercados P2P:** Los prosumidores pueden vender excedentes de energía directamente a otros nodos BeZhas utilizando el token nativo **BZHS** como medio de intercambio, eliminando al intermediario comercializador tradicional.

### 3. Ajuste Dinámico de Set-Points (SCADA)
Mediante los nodos perimetrales (Edge Nodes) y el control SCADA embebido, la blockchain envía comandos de control físico a inversores y maquinaria industrial.
- Regulación activa y reactiva del inversor solar según los límites de la red.
- Desconexión temporal de maquinaria pesada durante picos de precio eléctrico (*Demand Response*).

### 4. Seguridad Aegis y Cumplimiento Normativo
Toda la telemetría enviada por los inversores físicos pasa por el motor de detección de anomalías **Aegis**.
- Prevención de *spoofing* de energía generada.
- Trazabilidad y auditoría on-chain compatible con el nuevo RD 88/2026 de Agregador Independiente.

---

## 🏗️ Arquitectura del Sistema

El ecosistema opera en 4 capas interconectadas:

1. **Physical Layer:** Hardware IoT (Inversores, Baterías, Medidores Inteligentes) conectados a BeZhas Edge Nodes vía MQTT/Modbus.
2. **Blockchain Layer:** Smart Contracts (`BeZhasVPP.sol`, `EnergyOracle.sol`, `EnergyCAEToken.sol`) en la L2 de BeZhas que garantizan inmutabilidad y orquestan los flujos económicos.
3. **AI Orchestration:** El Agente de Energía de BeZhas (`energy-agent`), que evalúa el contexto en base a las Skills (`get_omie_price`, `execute_battery_arbitrage`) y decide la estrategia óptima de manera autónoma o con *human-in-the-loop*.
4. **Application Layer:** El dashboard de `bez-energy` donde el prosumidor monitoriza la telemetría, el balance de su *Energy Wallet*, y realiza la compra de **créditos de uso mediante Web3**.

---

## 💼 Economía del Token (BZHS en Energía)
En el sector energético, el token **BZHS** adquiere utilidad física:
- **Pago de gas:** Transacciones de telemetría a bajo costo gracias a Account Abstraction.
- **Recompensas de Staking:** Nodos que aportan flexibilidad (baterías) a la VPP son recompensados con un % del yield generado por el arbitraje.
- **Crédito de Uso (Pay-as-you-go):** Recarga del Energy Wallet con Web3 para pagar el alquiler/mantenimiento de equipos o el servicio de optimización por IA.
