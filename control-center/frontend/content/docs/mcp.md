# MCP — Model Context Protocol

MCP es el protocolo de interoperabilidad que permite que agentes, contratos y servicios compartan contexto y comandos de forma auditable. Es lo que hace posible que un flujo cruce varias empresas sin que ninguna ceda el control de sus sistemas.

## Para qué sirve

- Orquestar procesos multi-agente entre organizaciones (logística → aduanas → seguros)
- Conectar sensores IoT con contratos inteligentes sin exponer claves en el dispositivo
- Automatizar flujos B2B donde cada parte conserva su propia infraestructura

## Payload

```json
{
  "agent": "shiptrack-agent",
  "action": "trackShipment",
  "params": {
    "shipmentId": "SH123456"
  }
}
```

Cada invocación queda registrada con su origen, su acción y su resultado. La auditabilidad no es un añadido: es el motivo por el que dos empresas que no se conocen pueden automatizar un proceso común.

## Agentes sectoriales

Los agentes encapsulan la lógica de un dominio y hablan con los contratos correspondientes. `OpenClawAgent` es el contrato que ancla on-chain la actividad de la capa de agentes.

Un agente **nunca** recibe claves privadas de usuario. Opera con permisos acotados y toda escritura sensible pasa por un oráculo o un rol autorizado.

## Patrón IoT recomendado

```
Dispositivo ──telemetría──► Agente sectorial ──validación──► Oráculo ──► Contrato
```

El dispositivo no firma transacciones. Si un sensor se ve comprometido, el atacante obtiene la capacidad de mentir en un canal validado, no la de escribir directamente en la cadena.

## Seguridad

- Autentica cada invocación; ningún agente debe aceptar comandos anónimos.
- Acota los permisos por acción, no por agente.
- Registra todas las invocaciones con su resultado.
- No incluyas datos personales en los `params`: usa identificadores y hashes.

## Ver también

- [SDK e integraciones](/docs/sdk-integraciones)
- [Seguridad y buenas prácticas](/docs/seguridad)
