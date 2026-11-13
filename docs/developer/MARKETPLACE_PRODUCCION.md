---
estado: vigente
dominio: api
---

# API Marketplace y Hot Wallet: puesta en producción

> 2026-11-05. Diseño y estado: [`docs/API_MARKETPLACE_DISENO.md`](../API_MARKETPLACE_DISENO.md).
> Todo lo de abajo son **acciones deliberadas**: desplegar contratos en mainnet, aplicar
> migraciones a Cloud SQL o mover fondos no lo hace ningún script por su cuenta.

## 0. Bloqueos que hay que resolver antes

### 0.1 El Safe de BeZhas firma con 1 de 3

Comprobado en Polygon el 2026-11-05 (sólo lectura):

| Dirección | Qué es | Detalle |
| --- | --- | --- |
| `0x3EfC42095E8503d41Ad8001328FC23388E00e8a3` | Safe (proxy) | **Umbral 1**, 3 propietarios, 35 POL |
| `0x52Df82920CBAE522880dD7657e43d1A754eD044E` | EOA (Hot Wallet) | 33,85 POL · **propietaria del Safe** |
| `0x89c23890c742d710265dD61be789C71dC8999b12` | EOA («Treasury DAO») | 0 POL · propietaria del Safe; no es un contrato |
| `0xC0ec3b1fCb7Dc0c764371919837C13b58cDc330A` | — | Tercera propietaria del Safe |

Con umbral 1, cualquiera de las tres claves controla el Safe sola. Además, una de ellas es la
Hot Wallet, que es la clave más expuesta. Los scripts `DeployTelemetryAnchor` y
`DeployMarketplaceSettlement` **se niegan** a usar este Safe como admin (simulado contra un
fork de Polygon: `el multisig admin debe exigir al menos 2 firmas`).

**Decidido (2026-11-05):** umbral 2 y fuera la Hot Wallet. Firmantes de tesorería: `0x89c2`,
`0xC0ec` y una wallet de firma nueva.

Las propietarias `0x89c2` y `0xC0ec` **nunca han enviado una transacción** (nonce 0) y no
tienen POL. Las 11 operaciones del Safe las firmó, con umbral 1, la Hot Wallet. Por eso cada
paso lo firma una clave distinta: así se prueba que funciona **antes** de exigir 2 firmas.
Subir el umbral sin haberlo probado puede bloquear el Safe para siempre.

En app.safe.global (Polygon, Safe `0x3EfC…e8a3`):

0. Desde la Hot Wallet, envía ~1 POL a `0x89c2` y otro a `0xC0ec` para el gas de ejecución.
   Crea la wallet nueva (mejor hardware) y apunta su dirección.
1. Conectado con **`0x89c2`**: Ajustes → Propietarios → *Reemplazar* `0x52Df…044E` por la
   wallet nueva. Firma y ejecuta (sigue bastando 1 firma). Que lo firme `0x89c2` prueba su clave.
2. Conectado con **`0xC0ec`**: Ajustes → *Umbral* → 2 de 3. Firma y ejecuta. Prueba la segunda clave.
3. Comprueba en Safe que las propietarias son la nueva, `0x89c2` y `0xC0ec`, con umbral 2.
4. Con la wallet nueva, firma un mensaje de prueba (Safe → firmar mensaje) para confirmar
   que también funciona.

Ensayado sobre un fork de Polygon con los mismos dos pasos, firmados por las mismas cuentas:
`smart-contracts/script/ensayo-safe-propietarias.sh`. Repítelo con la dirección real:
`NEW=0x… ./smart-contracts/script/ensayo-safe-propietarias.sh` (instrucciones en el script).

Fuera de este cambio, la Hot Wallet sigue siendo `owner` de las dos RWAFactory de Polygon
(tabla de contratos de `CLAUDE.md`). Conviene revisarlo aparte.

### 0.2 La rama

Todo este trabajo está en `feat/kyc-didit`, que lleva cientos de commits por delante de
`main`. Producción se despliega desde lo que se fusione. Antes de los pasos 3 y 4 hay que
decidir cómo se integra esa rama (PR a `main` revisado o despliegue desde la rama).

### 0.3 La Hot Wallet y el tx-signer

La pestaña Hot Wallet ejecuta las salidas a través del `tx-signer` aislado, que firma con la
clave de la cartera declarada en su `signer.json` (KMS en la plantilla). Si `0x52Df…044E` es
hoy una cuenta de MetaMask, el `tx-signer` no tiene su clave y no podrá ejecutar. Hay dos
opciones:

- crear una cartera nueva en KMS para el `tx-signer` y declararla en `TX_TREASURY_ADDRESS_137`;
- o importar la clave de `0x52Df…` a KMS. Peor: la clave ya ha vivido en un navegador.

## 1. Auditorías y pentest (externos)

- [ ] 2 auditorías de `MarketplaceSettlement.sol` (el diseño las exige antes de mainnet).
- [ ] Pentest de API: proxy, recibos, compra on-chain y Hot Wallet.
- [ ] Pentest de conectores: escrituras con mTLS.

## 2. Secretos

En Cloud Shell, con el repositorio actualizado:

```bash
./deploy/gcp/00-generar-env.sh
```

Añade a `~/bezhas-blockchain.env` sólo las claves que falten y no imprime ninguna:

- el par ES256 de los recibos;
- el certificado de cliente mTLS (P-256, 2 años);
- dos wallets calientes dedicadas: `MARKETPLACE_ANCHOR_KEY` y `MARKETPLACE_REGISTRAR_KEY`.

Rellena a mano en el mismo fichero:

- `TX_TREASURY_ADDRESS_137`: la dirección de la cartera del `tx-signer` (ver 0.3).
- `BEZPAY_TREASURY_APP_ID`: el UUID de la app interna de tesorería en `app_registry`. Hoy
  tampoco está configurado para la liquidación de BEZ-Pay.
- `POLYGON_RPC_URL`, si aún no lo está.

Después:

```bash
./deploy/gcp/02-secrets.sh
```

```bash
./deploy/gcp/15-marketplace.sh info
```

`02-secrets.sh` valida y sube. Comprueba que las dos claves nuevas son claves reales y
distintas del resto, que las direcciones son direcciones y que los PEM son PEM.

`15-marketplace.sh info` imprime sólo lo público: las direcciones de las dos wallets (para
fondearlas **sólo con POL** y darles rol), la huella de la clave de recibos y el certificado
mTLS que se entrega a los proveedores.

## 3. Contratos en Polygon

Requisito: 0.1 resuelto. La clave de despliegue va por `--account` (keystore) o `--ledger`,
nunca en el entorno. Simula siempre primero, sin `--broadcast`.

```bash
cd smart-contracts
ANCHOR_ADMIN=0x3EfC42095E8503d41Ad8001328FC23388E00e8a3 ANCHOR_OPERATOR=<dirección de MARKETPLACE_ANCHOR_KEY> \
  forge script script/DeployTelemetryAnchor.s.sol --rpc-url $POLYGON_RPC_URL --sender <deployer>
```

```bash
MKT_ADMIN=0x3EfC42095E8503d41Ad8001328FC23388E00e8a3 MKT_REGISTRAR=<dirección de MARKETPLACE_REGISTRAR_KEY> \
  MKT_PAUSER=<wallet de seguridad> \
  forge script script/DeployMarketplaceSettlement.s.sol --rpc-url $POLYGON_RPC_URL --sender <deployer>
```

Repite cada uno con `--account <keystore> --broadcast --verify`.

Decisión pendiente: el script usa por defecto la Treasury DAO `0x89c2…` como `treasury`, el
destino immutable de la comisión. Es una EOA: una sola clave retira las comisiones. Para que
las retire el multisig, pasa `MKT_TREASURY=0x3EfC…e8a3`. Es immutable: decídelo antes de
desplegar.

Después del despliegue:

- [ ] Añadir las direcciones a `smart-contracts/deployments/137.json`:
  `supplychain.TelemetryAnchor` y `marketplace.MarketplaceSettlement`. La API las lee de
  ahí; no hacen falta variables.
- [ ] Añadirlas a la tabla de contratos de `CLAUDE.md` y ejecutar `node sync-daemon.js --once`.

## 4. Base de datos y despliegue

- [ ] Desplegar la API con `deploy.sh`. El job `bezhas-db-migrate` aplica las migraciones
  076, 077, 078 y 079.
- [ ] Comprobar el resultado con `./deploy/gcp/05-verify.sh`.

## 5. Aprobadores de tesorería (las 3 wallets)

Cada wallet de firma se da de alta con la clave interna, una vez, desde Cloud Shell. La
dirección es pública. La clave interna se lee del `.env` y llega a `curl` por la entrada
estándar, así no aparece en la terminal ni en la lista de procesos:

```bash
printf 'x-internal-key: %s\n' "$(grep ^INTERNAL_API_KEY= ~/bezhas-blockchain.env | cut -d= -f2-)" | \
  curl -sS -X POST https://api.bezhas.com/api/security/approvers -H @- \
  -H 'Content-Type: application/json' \
  -d '{"address":"0x…","roles":["treasury"],"label":"MetaMask Yoel","createdBy":"Yoel"}'
```

Firmantes decididos: `0x89c2…9b12`, `0xC0ec…330A` y la wallet nueva (un `curl` por
dirección). Las mismas tres van en `approvers` del `signer.json` del `tx-signer`, con
`minApprovals: 2`. Es la segunda lista, que la API no puede tocar. La Hot Wallet no es
aprobadora de sus propias salidas.

## 6. Anclaje y apertura

```bash
./deploy/gcp/15-marketplace.sh job
```

```bash
./deploy/gcp/15-marketplace.sh anclar
```

```bash
./deploy/gcp/15-marketplace.sh proxy on
```

- `job` crea el Cloud Run Job y lo programa cada hora (minuto 7).
- `anclar` lanza la primera pasada a mano.
- `proxy on` abre el proxy, cuando haya un proveedor piloto aprobado.

El job sale con código 1 si un ancla falla. Conviene una alerta de Cloud Monitoring sobre
sus ejecuciones fallidas (`06-monitoring.sh`).
