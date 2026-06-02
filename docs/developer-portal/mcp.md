# MCP (Model Context Protocol)

> Protocolo de integración modular para agentes, contratos y servicios en BeZhas.

## ¿Qué es MCP?
El Model Context Protocol (MCP) es un estándar de interoperabilidad que permite a agentes, contratos y servicios compartir contexto, datos y comandos de forma segura y auditable.

## Ejemplos de Uso
- Orquestación de flujos multi-agente (ej: logística + aduanas + seguros)
- Integración de sensores IoT con contratos inteligentes
- Automatización de procesos B2B entre empresas

### Ejemplo de payload MCP
```json
{
	"agent": "shiptrack-agent",
	"action": "trackShipment",
	"params": {
		"shipmentId": "SH123456"
	}
}
```

## Descarga de Especificaciones
- [MCP Spec PDF](../MCP_SPEC.pdf)
- [Librería JS](https://github.com/bezhas/bezhas-mcp-js)
- [Librería Python](https://github.com/bezhas/bezhas-mcp-py)
