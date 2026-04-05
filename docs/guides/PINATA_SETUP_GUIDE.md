# 🎯 Guía Rápida: Cómo Obtener Pinata API Keys (GRATIS)

## ¿Por qué Pinata?

Pinata es el servicio líder de IPFS especializado en NFTs. Ofrece:
- ✅ **Plan gratuito generoso**: 1GB de almacenamiento, 100 NFTs/mes
- ✅ **Sin tarjeta de crédito** requerida
- ✅ **Infraestructura confiable** usada por OpenSea, Rarible, etc.
- ✅ **Dashboard intuitivo** para gestionar archivos
- ✅ **Gateway rápido** para acceso público a archivos

---

## 📝 Paso a Paso (5 minutos)

### 1. Crear Cuenta

1. Ir a: **https://app.pinata.cloud/register**
2. Completar formulario:
   - Email
   - Contraseña
   - Nombre
3. Verificar email (revisar inbox)
4. Iniciar sesión

### 2. Crear API Key

1. En el dashboard, ir a **"API Keys"** (menú lateral izquierdo)
2. Click en **"New Key"** o **"+ API Key"**
3. Configurar permisos:
   - ✅ **pinFileToIPFS** (requerido)
   - ✅ **pinJSONToIPFS** (recomendado)
   - ⚪ **Otros permisos** (opcional, no necesarios)
4. Dar un nombre: `BeZhas-Development` o `BeZhas-Production`
5. Click en **"Create Key"**

### 3. Copiar Credenciales

⚠️ **IMPORTANTE**: Solo se muestran UNA VEZ, guárdalas inmediatamente.

Verás:
```
API Key: 1234567890abcdef1234567890abcdef
API Secret: abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
```

**Cópialas y guárdalas en un lugar seguro** (NotePad, etc.)

---

## 🔧 Configurar en BeZhas

### 1. Crear archivo `.env` en backend

Si no existe, créalo:
```bash
cd backend
copy .env.example .env
```

### 2. Agregar las keys al archivo `.env`

Abrir `backend/.env` y agregar/modificar:

```bash
# IPFS Configuration (Pinata)
PINATA_API_KEY=1234567890abcdef1234567890abcdef
PINATA_SECRET_KEY=abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890

# Opcional: Gateway personalizado
PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs/
```

**Reemplaza** con tus keys reales.

### 3. Reiniciar servidor backend

```bash
cd backend
node server.js
```

### 4. Verificar configuración

**Opción A - Browser**:
- Ir a: http://localhost:3001/api/upload/ipfs/status
- Debe mostrar: `"ipfsConfigured": true`

**Opción B - Terminal**:
```bash
curl http://localhost:3001/api/upload/ipfs/status
```

---

## ✅ Verificación Completa

Si todo está bien, verás:

```json
{
  "success": true,
  "ipfsConfigured": true,
  "provider": "Pinata",
  "message": "IPFS configurado y listo para subidas reales",
  "maxFileSize": "10MB",
  "supportedFormats": ["PDF", "Word", "Excel", "TXT", "JSON"]
}
```

---

## 🎨 Probar Subida de Documento

1. Iniciar frontend: `cd frontend && npm run dev`
2. Ir a: http://localhost:5173/create
3. Conectar wallet
4. Seleccionar **"Documento/Contrato"**
5. Subir un PDF de prueba
6. Verificar que el toast muestra: "✅ Subido a IPFS" (no "modo desarrollo")

---

## 📊 Límites del Plan Free

| Característica | Plan Free | Plan Picnic ($20/mes) |
|----------------|-----------|----------------------|
| Almacenamiento | 1 GB      | 20 GB               |
| Bandwidth      | 100 MB/día| 200 GB/mes          |
| Archivos       | Ilimitados| Ilimitados          |
| Requests       | Ilimitados| Ilimitados          |
| Gateway        | Compartido| Dedicado (opcional) |

**Para desarrollo**: Plan Free es más que suficiente.

---

## 🔐 Seguridad de API Keys

### ✅ HACER
- Guardar keys en archivo `.env` (nunca en código)
- Agregar `.env` al `.gitignore`
- Usar keys diferentes para dev/prod
- Rotar keys periódicamente

### ❌ NO HACER
- Commitear `.env` a Git
- Compartir keys públicamente
- Usar mismas keys en producción y desarrollo
- Hardcodear keys en el código

---

## 🆘 Problemas Comunes

### Error: "Invalid API credentials"
**Causa**: Keys incorrectas o expiradas  
**Solución**: Verificar que copiaste las keys completas sin espacios

### Error: "Pin exceeds free tier limit"
**Causa**: Archivo muy grande o límite de storage alcanzado  
**Solución**: 
- Reducir tamaño de archivo
- Eliminar archivos antiguos en Pinata dashboard
- Considerar upgrade a plan pagado

### "ipfsConfigured": false
**Causa**: Variables de entorno no cargadas  
**Solución**:
- Verificar que `.env` existe en carpeta `backend`
- Verificar nombres de variables (sin espacios)
- Reiniciar servidor backend

---

## 📱 Dashboard de Pinata

Accede a: **https://app.pinata.cloud/pinmanager**

Aquí puedes:
- ✅ Ver todos los archivos subidos
- ✅ Copiar CID/hash de archivos
- ✅ Desanclar archivos para liberar espacio
- ✅ Ver estadísticas de uso
- ✅ Gestionar API keys

---

## 🚀 Alternativas a Pinata

Si prefieres otras opciones:

### Infura IPFS
- **Pro**: Integrado con Web3
- **Con**: Requiere tarjeta de crédito
- **Setup**: Cambiar código en `ipfs.service.js`

### Web3.Storage (gratuito)
- **Pro**: 1TB gratis
- **Con**: Menos features
- **Setup**: API diferente

### NFT.Storage (gratuito)
- **Pro**: Optimizado para NFTs
- **Con**: Solo para NFTs
- **Setup**: API diferente

**Recomendación**: Pinata es la mejor opción para empezar.

---

## 📚 Recursos Adicionales

- **Pinata Docs**: https://docs.pinata.cloud/
- **IPFS Docs**: https://docs.ipfs.tech/
- **Pinata Blog**: https://www.pinata.cloud/blog
- **Discord de Pinata**: https://discord.gg/pinata

---

## 💰 Pricing de Pinata (Referencia)

| Plan | Precio | Storage | Gateway |
|------|--------|---------|---------|
| **Free** | $0 | 1 GB | Compartido |
| **Picnic** | $20/mes | 20 GB | Compartido |
| **Submarine** | $100/mes | 100 GB | Dedicado opcional |
| **Enterprise** | Custom | Custom | Dedicado |

Para este proyecto: **Plan Free es suficiente** durante desarrollo.

---

**¿Listo para probar?** 🎉

1. Registrarse en Pinata: https://app.pinata.cloud/register
2. Crear API Key
3. Agregar al `.env`
4. Reiniciar servidor
5. ¡Subir tu primer documento a IPFS!

---

*Última actualización: 13 de Noviembre, 2024*
