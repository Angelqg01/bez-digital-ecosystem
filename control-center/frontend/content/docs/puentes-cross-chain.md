# Puentes cross-chain

BEZ existe en varias redes a la vez: como token nativo y de gas en la L2, y como ERC-20/BEP-20 en Polygon y BNB Chain. Los puentes mantienen esa coherencia.

## Contratos de puente

| Contrato | Función |
| --- | --- |
| `BeZhasBridgeL2` | Puente entre la L2 y la L1 de anclaje |
| `BEZPolygonBridge` | Puente BeZhas ↔ Polygon |
| `WrappedBEZ` | Representación envuelta de BEZ en redes destino |
| `L1_Ethereum_Bridge` | Entrada/salida hacia Ethereum |

## Rutas disponibles

| Origen | Destino | Uso típico |
| --- | --- | --- |
| BeZhas L2 | Polygon | Salida a liquidez DeFi |
| BeZhas L2 | BNB Chain | Acceso a mercados BEP-20 |
| Polygon / BNB | BeZhas L2 | Entrada de capital operativo |
| BeZhas L2 | Ethereum | Anclaje y liquidación institucional |

## Iniciar un bridge por API

```bash
curl -X POST https://api.bez.digital/api/gateway/v1/bridge/initiate \
  -H "Authorization: Bearer $JWT" \
  -H "X-API-Key: $BEZHAS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "fromChainId": 2708,
        "toChainId": 137,
        "amount": "1000000000000000000000",
        "recipient": "0xDestino"
      }'
```

Requiere scope `bridge:write`.

## Cómo funciona por debajo

El mecanismo es **bloqueo y acuñación**, no transferencia directa: no existe una transacción que cruce cadenas.

```
1. Origen  : los tokens se bloquean o recolectan (rol BRIDGE_ROLE)
2. Relay   : se observa el evento y se valida
3. Destino : se acuña o libera el equivalente
4. Cierre  : se confirma en ambos lados
```

### Detalle crítico para contabilidad

`bridgeBurn()` en `BEZCoinV2` **no destruye tokens**: los transfiere a `treasuryWallet`. Por tanto, la reserva del puente debe cuadrar **con el saldo recolectado en tesorería**, no con una reducción de `totalSupply()`. Si tu conciliación asume una quema real, los números no cuadrarán. Ver [BEZ-Coin](/docs/bez-coin).

## Antes de puentear

- [ ] Confirma el `chainId` de origen y destino. Enviar a la red equivocada es, en la práctica, irreversible.
- [ ] Verifica que la dirección de destino existe y es controlable en la red destino. Una dirección de contrato válida en una cadena puede no serlo en otra.
- [ ] Prueba primero con un importe mínimo.
- [ ] Ten en cuenta el tiempo de finalidad: el destino no acredita hasta que el origen es firme.
- [ ] Guarda el identificador de la operación para seguimiento y soporte.

## Riesgos que debes comunicar a tus usuarios

Los puentes son, históricamente, el componente más atacado de la infraestructura cross-chain. Si integras esta funcionalidad:

- No presentes el bridge como instantáneo si depende de finalidad y relay.
- Muestra el estado real de la operación en cada fase, no una barra de progreso ficticia.
- No muestres un `txHash` de destino antes de que exista.
- Advierte de forma visible que la red destino no se puede cambiar una vez iniciada la operación.

## Ver también

- [BEZ-Coin](/docs/bez-coin)
- [Smart contracts y ABIs](/docs/smart-contracts)
- [Referencia de API](/docs/api-reference)
