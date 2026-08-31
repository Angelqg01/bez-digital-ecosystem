# Seguridad y buenas prácticas

## Reglas absolutas

Estas no admiten excepción, ni en desarrollo, ni "temporalmente", ni en una rama que no vas a mergear:

1. **Nunca** commitees claves privadas, mnemónicos, API keys ni archivos `.env`.
2. **Nunca** registres tokens JWT, API keys o claves en logs, trazas o sistemas de errores.
3. **Nunca** expongas una API key en el frontend. Las llamadas autenticadas salen de tu backend.
4. **Nunca** codifiques direcciones de contrato a mano: resuélvelas por SDK o API.
5. **Nunca** muestres un `txHash` de una transacción que no se firmó y emitió realmente.
6. Ante cualquier sospecha de exposición de una credencial, **rótala de inmediato**. No investigues primero.

## Gestión de secretos

- Usa variables de entorno inyectadas en tiempo de ejecución o un gestor de secretos. No archivos versionados.
- Los JWT se mantienen **en memoria**, nunca en disco ni en `localStorage`.
- Rota API keys periódicamente y revoca las que no uses.
- Separa credenciales por entorno: las de desarrollo nunca deben funcionar en producción.
- Las claves de validador y de Edge Node merecen HSM o gestor dedicado: quien las tiene puede actuar en tu nombre y hacer que te penalicen.

## Wallets y firma

- Verifica siempre el `chainId` antes de firmar. Es la comprobación más barata que existe y evita el error más caro.
- Muestra al usuario qué va a firmar en términos comprensibles, no el calldata en crudo.
- Usa `approve` por el importe exacto necesario, no aprobaciones infinitas.
- Para operaciones corporativas usa multi-firma (`MultiSigWallet`), no una clave individual.
- `SmartWallet` con `WalletGuardian` y `SecurityModule` te da límites de gasto y recuperación sin depender de que un empleado custodie una semilla.

## Contratos

- `AccessControl` por rol, no `onlyOwner`, para operaciones multi-actor.
- `ReentrancyGuard` en toda función que mueva valor.
- `SafeERC20` para transferencias de token.
- Comisiones y parámetros críticos **acotados en el propio contrato**, no dependientes de la buena fe del operador.
- Audita antes de desplegar en la red principal. Desplegar en local es libre; en mainnet requiere revisión previa.

## Nodos y RPC

- Escucha en `127.0.0.1` por defecto. `0.0.0.0` solo tras firewall, VPN o reverse proxy con TLS.
- Nunca expongas un RPC a Internet sin autenticación y rate limiting.
- Un RPC público ve tus consultas: si revelan patrones de negocio, usa nodo propio o RPC dedicado.
- Monitoriza uptime: por debajo del 90% pierdes el estado activo de validador.
- Mantén las dependencias actualizadas y sigue los avisos de seguridad del protocolo.

## Privacidad y datos personales

Lo publicado on-chain o en un URI de metadatos es **público y permanente**. Esto choca de frente con el derecho de supresión del RGPD.

- **No publiques datos personales** en metadatos, memos, eventos ni parámetros.
- Ancla el **hash** del documento y conserva el original en tu sistema, bajo control de acceso.
- Los endpoints de datos clínicos o personales exigen permisos explícitos y consentimiento registrado: un token válido no basta.
- Antes de tokenizar cualquier cosa que involucre a personas físicas, valida el diseño con tu responsable de protección de datos.

## Integraciones

- HTTPS/WSS siempre fuera de `localhost`.
- Idempotencia con identificadores deterministas (`orderId`, `ref`) para que un reintento no duplique una operación.
- Backoff exponencial ante `429` y `5xx`.
- Valida y sanea toda entrada antes de enviarla a un contrato: un revert es el mejor caso; un dato erróneo escrito para siempre, el peor.

## Reportar una vulnerabilidad

Si detectas una vulnerabilidad, repórtala de forma privada por los canales de contacto del portal. **No publiques detalles técnicos en foros, redes ni issues públicos** antes de que exista una corrección desplegada.

Al reportar, incluye: descripción, pasos de reproducción, impacto estimado y versión o red afectada.

## Ver también

- [Nodos Enterprise y Edge](/docs/nodos-enterprise-edge)
- [Validadores y staking](/docs/validadores-staking)
- [Tokenización de activos](/docs/tokenizacion-activos)
