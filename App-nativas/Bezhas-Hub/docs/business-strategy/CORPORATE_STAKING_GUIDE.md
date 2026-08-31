# 🏦 Guía de Staking Corporativo y DAO

Este documento explica cómo las empresas pueden utilizar sus activos digitales y tokens BEZ para generar rendimiento pasivo y participar en la gobernanza del protocolo.

## 📊 Niveles de Staking Corporativo

El sistema de staking está diseñado para recompensar el compromiso a largo plazo.

| Nivel | Requisito (BEZ Staked) | Beneficios | Multiplicador de Voto |
|-------|------------------------|------------|-----------------------|
| **Silver** | 10,000 - 49,999 | Descuento 5% en fees logísticos | 1x |
| **Gold** | 50,000 - 199,999 | Descuento 15% en fees logísticos + Acceso a Beta Features | 2x |
| **Platinum** | 200,000+ | Revenue Share aumentado (30%) + Voto Prioritario | 5x |

## 🗳️ Gobernanza DAO (Decentralized Autonomous Organization)

Las empresas Platinum tienen voz y voto en decisiones críticas del protocolo:

1.  **Aprobación de Nuevos Activos:** Votar qué proyectos inmobiliarios se listan en la plataforma.
2.  **Ajuste de Parámetros:** Proponer cambios en los fees del protocolo (ej. bajar del 2.5% al 2.0% para su sector).
3.  **Tesorería:** Decidir el destino de los fondos acumulados en la tesorería de la DAO (marketing, desarrollo, buybacks).

## 💰 Estrategias de Rendimiento (Yield Farming B2B)

### 1. Liquidity Provisioning
Las empresas pueden proveer liquidez a los pares de sus propios tokens (ej. `BPROP/BEZ`).
*   **Riesgo:** Impermanent Loss (bajo en pares estables).
*   **Retorno:** Fees de trading del DEX + Recompensas en BEZ.

### 2. Collateral Staking
Utilizar los NFTs de propiedades (`PropertyNFT`) como colateral para minar stablecoins o pedir préstamos para expansión operativa.

### 3. Insurance Staking
Bloquear BEZ en un fondo de seguro para cubrir posibles fallos en la logística o daños en alquileres.
*   **Retorno:** Alta rentabilidad (APY > 15%) por asumir el riesgo asegurador.

---

## 🛠️ Integración Técnica

Para realizar staking corporativo:

```solidity
// Ejemplo de interacción con StakingPool
IERC20(bezToken).approve(stakingPoolAddress, amount);
IStakingPool(stakingPoolAddress).stake(amount, lockPeriod);
```
