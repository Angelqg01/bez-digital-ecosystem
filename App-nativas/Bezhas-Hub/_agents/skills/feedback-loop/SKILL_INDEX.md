# 🧠 BeZhas AI Skill Index & Learning Hub
Este documento es el repositorio central de conocimientos dinámicos para la IA de BeZhas.
Aquí se consolidan los descubrimientos, fallos corregidos y optimizaciones realizadas de forma autónoma.

## 📡 Bridge & Webhooks (Aprendizaje Dinámico)
*Módulos: bridgeCore.js, Universal Bridge*
- **[Pattern] MercadoLibre Dynamic Discovery**: La IA ha aprendido a identificar el objeto `data.transaction_amount` como campo primario de pago en webhooks de MercadoLibre.
- **[Pattern] Heuristic Safety**: Se ha establecido una red de seguridad (fallback) que detecta palabras clave (`approved`, `confirmed`) ante fallos de conectividad de los LLMs.

## 🔐 OpenClaw Agent (Aprovisionamiento y Seguridad)
*Módulos: payment-openclaw-bridge.js*
- **[Skill] Auto-Provisioning**: Capacidad de generar credenciales multinivel (Starter, Pro, Enterprise) vinculadas a pagos on-chain.
- **[Skill] Autonomous Revocation**: Detección de claves expiradas y limpieza automática de la base de datos de clientes.

## ⛓️ Blockchain Services (Reputación On-Chain)
*Módulos: blockchain.service.js*
- **[Skill] Reward Automation**: El sistema vincula cada éxito del Bridge con un "Mint de Reputación" en el contrato `SettlementContract`.

---
## 🛠️ Cómo usar estos Skills
Cada vez que un agente de IA de BeZhas (OpenClaw o Aegis) se inicie, debe leer la carpeta `_agents/skills` para:
1.  **Evitar errores repetidos.**
2.  **Identificar patrones exitosos** de webhooks de terceros sin re-analizarlos desde cero (ahorro de tokens).
3.  **Seguir el estándar arquitectónico** definido por el usuario para BeZhas.

---
> [!IMPORTANT]
> Este archivo es actualizado automáticamente por el `FeedbackLoopService`.
