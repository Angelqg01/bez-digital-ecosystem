# Validador y Edge Node

El nodo incluye una primera capa de operacion de validador. Por seguridad, las acciones write solo funcionan si se configura `VALIDATOR_PRIVATE_KEY`.

## Variables

- `VALIDATOR_PRIVATE_KEY`: clave que firma transacciones.
- `VALIDATOR_ADDRESS`: direccion publica del operador.
- `VALIDATOR_COMPANY_NAME`: nombre de la empresa.
- `VALIDATOR_STAKE_AMOUNT_BEZ`: stake deseado.
- `VALIDATOR_REGISTRY_ADDRESS`: contrato ValidatorRegistry.
- `EDGE_NODE_REWARDS_ADDRESS`: contrato EdgeNodeRewards.

## Estado

```bash
curl -H "Authorization: TU_API_KEY" http://localhost:4100/validator/status
```

Devuelve si el nodo esta configurado, si puede escribir en cadena y la informacion on-chain del operador cuando el contrato esta disponible.

## Flujo de registro

1. Configurar contratos y clave privada.
2. Aprobar stake:

```bash
curl -X POST http://localhost:4100/validator/approve-stake \
  -H "Authorization: TU_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"amount_bez\":\"1000\"}"
```

3. Registrar validador:

```bash
curl -X POST http://localhost:4100/validator/register \
  -H "Authorization: TU_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"company_name\":\"Mi Empresa\",\"stake_amount_bez\":\"1000\"}"
```

4. Enviar heartbeat:

```bash
curl -X POST http://localhost:4100/validator/heartbeat \
  -H "Authorization: TU_API_KEY"
```

## Seguridad

- No uses claves privadas en equipos compartidos.
- Usa firewall y acceso por VPN.
- No expongas `/validator/*` a internet sin proxy, rate limit y logs.
- Considera separar la firma en un signer/HSM en una fase posterior.

## Rentabilidad

El validador puede aportar recompensas si la red premia uptime, stake y participacion. Debe activarse solo si el coste de infraestructura y riesgo operativo son menores que las recompensas y el valor comercial del plan premium.

