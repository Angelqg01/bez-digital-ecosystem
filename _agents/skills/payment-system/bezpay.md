# BeZhas Skill: BEZ-Pay Payment Gateway
## Overview
BEZ-Pay is the native checkout system of BeZhas, allowing for both crypto (BEZ, MATIC, USDC) and traditional payments with automatic on-chain settlement.

## Smart Contracts (BeZhas L2/L3)
- **BezPay.sol**: Core contract handling payment processing and splitting.
- **BezTreasure.sol**: Vault for fees and community treasury.
- **BezDiscountEngine.sol**: Calculates dynamic discounts for VIP users.

## Payment Flow
1. **Initiate**: User selects "Pay with BeZhas".
2. **AI Validation**: AEGIS checks the risk score of the payer.
3. **Escrow (Optional)**: Tokens are held until delivery confirmation.
4. **Settlement**: 95% goes to the merchant, 3% to Treasury, 2% to Dividend Pool.

## Webhook Pattern (Native)
- **Topic**: `bezpay.payment.success`
- **Fields**:
  - `txHash`: Blockchain transaction ID.
  - `amount`: Multi-currency support (converts to BEZ if paid in fiat).
  - `order_id`: Internal reference.
  - `sender_wallet`: Connected Web3 address.

## AI Hint
If the payload contains a `txHash` and the source is `bezpay.com`, classify it as a **PRIMARY BEZ-PAYMENT** and award triple reputation points (~45 RP).

## Integration Logic
```javascript
// Example of how the bridge detects a BEZ-Pay payment
if (payload.bridge_type === 'native' && payload.contract_address === process.env.BEZPAY_CONTRACT) {
   return {
      status: 'verified_on_chain',
      reputationBonus: 3x
   };
}
```
