# Arquitectura y Despliegue: Explorador Blockscout para BeZhas L2

Para proveer transparencia B2B, rastreo de transacciones y verificación de contratos inteligentes, la red BeZhas L2 usará **Blockscout**. La mejor manera de incorporarlo en la actual infraestructura de servidores es mediante un contenedor Docker adjunto al nodo Secuenciador o Réplica.

## Estructura del `docker-compose.yml` para Blockscout

```yaml
version: '3.8'

services:
  blockscout-db:
    image: postgres:14-alpine
    restart: always
    environment:
      POSTGRES_USER: 'blockscout'
      POSTGRES_PASSWORD: 'blockscout_password'
      POSTGRES_DB: 'blockscout'
    volumes:
      - blockscout-postgres-data:/var/lib/postgresql/data
    networks:
      - bezhas_l2_network

  blockscout-backend:
    image: blockscout/blockscout:master
    restart: always
    depends_on:
      - blockscout-db
    environment:
      # Datos de la Red BeZhas L2
      ETHEREUM_JSONRPC_VARIANT: 'geth'
      # APUNTA AL NODO L2 LOCAL (.go)
      ETHEREUM_JSONRPC_HTTP_URL: 'http://bezhas-geth:8545'  
      ETHEREUM_JSONRPC_WS_URL: 'ws://bezhas-geth:8546'
      # Configuracion de la Base de Datos
      DATABASE_URL: 'postgresql://blockscout:blockscout_password@blockscout-db:5432/blockscout'
      
      # Personalizacion del Explorador (Frontend corporativo)
      NETWORK: 'BeZhas B2B L2'
      SUBNETWORK: 'Mainnet'
      COIN: 'BEZ'
      MICRO_COIN: 'gBEZ'
      COIN_NAME: 'BeZhas Coin'
      
      # Verificacion de Contratos
      ENABLE_SOURCIFY_INTEGRATION: 'true'
      SOURCIFY_SERVER_URL: 'https://sourcify.bez.digital/'
      
      # Optimizaciones de Memoria (Para que no colapse el servidor)
      INDEXER_DISABLE_PENDING_TRANSACTIONS_FETCHER: 'false'
      INDEXER_DISABLE_INTERNAL_TRANSACTIONS_FETCHER: 'false'
      INDEXER_MEMORY_LIMIT: '2GB'
      
    ports:
      - '4000:4000'
    networks:
      - bezhas_l2_network

volumes:
  blockscout-postgres-data:

networks:
  bezhas_l2_network:
    external: true # Aprovecha la red Docker donde ya esta corriendo el OP Stack
```

## Beneficios para las Empresas (B2B)
1. **Transparencia Inmediata:** Si una empresa deposita $50,000 USDT desde la L1, recibirá un TX Hash. Ese Hash se pegará en el explorador (ej. `explorer.bez.digital`) para validar la existencia del activo en la L2.
2. **Auditoría de IA:** Como los llamados a la IA usan el precompilado `Inyección de IA en la Blockchain (op-geth).go` y cuestan Gas (BEZ), las empresas pueden revisar en el Blockscout exactamente cuánto pagaron en cada *Prompt* realizado al cerebro de la IA.
3. **Verificación de Contratos Inteligentes:** Las corporaciones pueden ver que el código del `QualityEscrow` y el código del Token `BEZ` son inmutables, auditables y corresponden a lo prometido, permitiendo integraciones API seguras (Hardcoding the Address).

## Puntos Operativos Clave
1. **Memoria y Espacio en Disco:** Blockscout indexa absolutamente *todo* lo que pasa en la blockchain. Si el OP Stack genera 1 bloque cada 2 segundos, PostgreSQL (`blockscout-db`) crecerá masivamente semana a semana. Se recomienda utilizar un volumen de red (Block Storage) de alto rendimiento dedicado solo a esta BD, de al menos 1TB inicial para la Mainnet.
2. **Reverse Proxy:** Jamás exponer el puerto `4000` directamente a internet. Se debe usar Nginx o Traefik para rutear `explorer.bez.digital` al puerto 4000 y añadir Cloudflare en medio para frenar ataques DDoS.
