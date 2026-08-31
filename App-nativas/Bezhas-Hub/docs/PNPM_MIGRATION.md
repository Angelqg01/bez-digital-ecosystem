# Migración a pnpm - BeZhas Web3

## ¿Por qué pnpm?

El proyecto BeZhas Web3 ha migrado de npm a pnpm debido a los siguientes beneficios:

- **Eficiencia de Espacio**: pnpm usa un almacén de contenido direccionable único, reduciendo dramáticamente el uso de disco
- **Velocidad**: Instalaciones más rápidas gracias al caché inteligente
- **Estricto**: Mejor manejo de dependencias peer, evitando problemas de compatibilidad
- **Monorepo-friendly**: Soporte nativo para workspaces y proyectos multi-paquete

## Instalación de pnpm

Si no tienes pnpm instalado, instálalo globalmente:

```bash
# Windows (PowerShell)
iwr https://get.pnpm.io/install.ps1 -useb | iex

# O usando npm (irónico, pero funcional)
npm install -g pnpm

# Verificar instalación
pnpm --version
```

## Comandos Actualizados

### Instalación de Dependencias

```bash
# Proyecto raíz (smart contracts)
cd "d:\Documentos D\Documentos Yoe\BeZhas\BeZhas Web\bezhas-web3"
pnpm install

# Backend
cd backend
pnpm install

# Frontend (ya instalado)
cd frontend
pnpm install
```

### Scripts Principales

```bash
# Iniciar entorno completo (Docker)
pnpm run dev:up

# Detener entorno
pnpm run dev:down

# Ver logs
pnpm run dev:logs

# Iniciar backend manualmente
pnpm run start:backend

# Compilar contratos
pnpm run compile

# Desplegar DAO
pnpm run deploy:dao

# Tests de Hardhat
npx hardhat test
```

### Frontend

```bash
cd frontend

# Desarrollo
pnpm run dev

# Build de producción
pnpm run build

# Preview del build
pnpm run preview

# Linting
pnpm run lint
```

### Backend

```bash
cd backend

# Iniciar servidor
pnpm start

# Modo desarrollo (con nodemon)
pnpm run dev

# Tests
pnpm test

# Seed de DAO
pnpm run seed:dao
```

## Diferencias Clave con npm

### Comandos Equivalentes

| npm | pnpm |
|-----|------|
| `npm install` | `pnpm install` |
| `npm install <pkg>` | `pnpm add <pkg>` |
| `npm install -D <pkg>` | `pnpm add -D <pkg>` |
| `npm uninstall <pkg>` | `pnpm remove <pkg>` |
| `npm run <script>` | `pnpm run <script>` o `pnpm <script>` |
| `npm update` | `pnpm update` |
| `npx <command>` | `pnpm dlx <command>` o `pnpm exec <command>` |

### Estructura de node_modules

pnpm crea una estructura diferente:
- `node_modules/.pnpm/` - Almacén de paquetes
- `node_modules/<package>` - Enlaces simbólicos a .pnpm
- `node_modules/.ignored` - Paquetes instalados por otros gestores

## Migración Completada

✅ **Raíz del proyecto**: Dependencias de Hardhat instaladas con pnpm  
✅ **Backend**: Todas las dependencias migradas (638 paquetes)  
✅ **Frontend**: Ya estaba usando pnpm (1102 paquetes)  

## Solución de Problemas

### Error: "Cannot find module"

Si encuentras errores de módulos faltantes:

```bash
# Limpiar node_modules y reinstalar
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Peer Dependencies Warnings

pnpm es más estricto con peer dependencies. Los warnings son normales y seguros si no afectan la funcionalidad.

### Scripts Fallando

Asegúrate de usar `pnpm run <script>` en lugar de `npm run <script>` en todos los comandos personalizados.

## Caché y Limpieza

```bash
# Ver información del store
pnpm store path

# Limpiar paquetes no usados
pnpm store prune

# Ver estado del store
pnpm store status
```

## Notas Importantes

- **Docker**: Los contenedores Docker aún pueden usar npm internamente, no hay problema
- **CI/CD**: Actualiza los pipelines para usar `pnpm install --frozen-lockfile`
- **Scripts de PowerShell**: Actualizados para usar pnpm por defecto
- **.npmrc**: Configuración compartida para consistencia

## Soporte

Si encuentras problemas con pnpm, contacta al equipo de desarrollo o consulta:
- Documentación oficial: https://pnpm.io/
- Comparación con npm: https://pnpm.io/feature-comparison
