# 🔧 Backend Implementation Guide - Document Upload

## Objetivo
Implementar el endpoint backend para subir documentos a IPFS y servir las URLs permanentes al frontend.

## 📋 Tareas Pendientes

### 1. Crear Endpoint de Upload
**Archivo**: `backend/routes/upload.routes.js`

```javascript
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/auth.middleware');
const { uploadToIPFS } = require('../services/ipfs.service');

// Configurar Multer para archivos en memoria
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'application/json'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no soportado'), false);
        }
    }
});

// POST /api/upload
router.post('/', protect, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se recibió ningún archivo' });
        }

        // Subir a IPFS
        const ipfsUrl = await uploadToIPFS(req.file.buffer, req.file.originalname);

        res.json({
            success: true,
            url: ipfsUrl,
            filename: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ error: 'Error al subir el archivo' });
    }
});

module.exports = router;
```

### 2. Crear Servicio de IPFS
**Archivo**: `backend/services/ipfs.service.js`

#### Opción A: Pinata (Recomendado)
```javascript
const axios = require('axios');
const FormData = require('form-data');

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;

async function uploadToIPFS(buffer, filename) {
    try {
        const formData = new FormData();
        formData.append('file', buffer, filename);

        const response = await axios.post(
            'https://api.pinata.cloud/pinning/pinFileToIPFS',
            formData,
            {
                headers: {
                    'pinata_api_key': PINATA_API_KEY,
                    'pinata_secret_api_key': PINATA_SECRET_KEY,
                    ...formData.getHeaders()
                }
            }
        );

        return `ipfs://${response.data.IpfsHash}`;
    } catch (error) {
        console.error('Pinata upload error:', error);
        throw new Error('Error al subir a IPFS');
    }
}

module.exports = { uploadToIPFS };
```

#### Opción B: Infura IPFS
```javascript
const { create } = require('ipfs-http-client');

const client = create({
    host: 'ipfs.infura.io',
    port: 5001,
    protocol: 'https',
    headers: {
        authorization: `Basic ${Buffer.from(
            process.env.INFURA_PROJECT_ID + ':' + process.env.INFURA_PROJECT_SECRET
        ).toString('base64')}`
    }
});

async function uploadToIPFS(buffer, filename) {
    try {
        const result = await client.add(buffer);
        return `ipfs://${result.path}`;
    } catch (error) {
        console.error('Infura IPFS upload error:', error);
        throw new Error('Error al subir a IPFS');
    }
}

module.exports = { uploadToIPFS };
```

### 3. Actualizar server.js
```javascript
// Agregar en backend/server.js

// Importar rutas de upload
const uploadRoutes = require('./routes/upload.routes');

// Registrar rutas (después de las rutas existentes)
app.use('/api/upload', uploadRoutes);
```

### 4. Variables de Entorno
**Archivo**: `backend/.env`

```env
# Opción 1: Pinata
PINATA_API_KEY=tu_api_key_aqui
PINATA_SECRET_KEY=tu_secret_key_aqui

# Opción 2: Infura IPFS
INFURA_PROJECT_ID=tu_project_id
INFURA_PROJECT_SECRET=tu_project_secret
```

### 5. Instalar Dependencias
```bash
cd backend
npm install multer form-data
# Si usas Pinata:
npm install axios
# Si usas Infura:
npm install ipfs-http-client
```

## 🔐 Seguridad Adicional

### Middleware de Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');

const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10, // 10 uploads por IP
    message: 'Demasiadas subidas. Intenta de nuevo más tarde.'
});

router.post('/', protect, uploadLimiter, upload.single('file'), async (req, res) => {
    // ...
});
```

### Escaneo de Malware (Opcional)
```javascript
const clamav = require('clamav.js');

async function scanFile(buffer) {
    const result = await clamav.scanBuffer(buffer);
    if (result.includes('FOUND')) {
        throw new Error('Archivo potencialmente peligroso detectado');
    }
}
```

### Encriptación para Documentos Sensibles
```javascript
const crypto = require('crypto');

function encryptFile(buffer, password) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(password, 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    
    return {
        encrypted,
        iv: iv.toString('hex')
    };
}
```

## 📊 Logging y Monitoreo

```javascript
const { createLogger, format, transports } = require('winston');

const logger = createLogger({
    level: 'info',
    format: format.json(),
    transports: [
        new transports.File({ filename: 'uploads.log' })
    ]
});

// En el endpoint:
logger.info('Document uploaded', {
    userId: req.user.id,
    filename: req.file.originalname,
    size: req.file.size,
    ipfsHash: ipfsUrl
});
```

## 🧪 Testing

### Test con Jest
**Archivo**: `backend/tests/upload.test.js`

```javascript
const request = require('supertest');
const app = require('../server');

describe('Upload Endpoint', () => {
    it('should upload a PDF file', async () => {
        const response = await request(app)
            .post('/api/upload')
            .set('Authorization', `Bearer ${testToken}`)
            .attach('file', 'test/fixtures/sample.pdf')
            .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.url).toMatch(/^ipfs:\/\//);
    });

    it('should reject large files', async () => {
        const response = await request(app)
            .post('/api/upload')
            .set('Authorization', `Bearer ${testToken}`)
            .attach('file', 'test/fixtures/large.pdf')
            .expect(400);

        expect(response.body.error).toBeDefined();
    });
});
```

## 🔄 Actualizar Frontend

**Archivo**: `frontend/src/pages/CreateNFTPage.jsx`

Reemplazar la sección TODO en `handleDocumentUpload`:

```javascript
// Reemplazar esto:
// TODO: Implementar subida real a IPFS
await new Promise(resolve => setTimeout(resolve, 2000));
const mockUrl = `ipfs://Qm${Math.random().toString(36).substring(7)}/${file.name}`;

// Con esto:
const formDataUpload = new FormData();
formDataUpload.append('file', file);

const response = await fetch('/api/upload', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: formDataUpload
});

if (!response.ok) {
    throw new Error('Error al subir el archivo');
}

const data = await response.json();
const ipfsUrl = data.url;
```

## 📋 Checklist de Implementación

- [ ] Crear `backend/routes/upload.routes.js`
- [ ] Crear `backend/services/ipfs.service.js`
- [ ] Actualizar `backend/server.js` con rutas
- [ ] Agregar variables de entorno a `.env`
- [ ] Instalar dependencias (`multer`, `form-data`, etc.)
- [ ] Obtener API keys (Pinata o Infura)
- [ ] Implementar middleware de rate limiting
- [ ] Agregar logging de uploads
- [ ] Escribir tests unitarios
- [ ] Actualizar frontend para usar endpoint real
- [ ] Probar con diferentes tipos de archivos
- [ ] Probar límite de tamaño (10MB)
- [ ] Verificar autenticación con JWT
- [ ] Documentar API en Swagger/Postman

## 🌐 Consideraciones IPFS

### IPFS Gateway para Acceso
Los archivos subidos estarán disponibles en:
- `ipfs://<hash>` - Protocolo IPFS nativo
- `https://ipfs.io/ipfs/<hash>` - Gateway público
- `https://gateway.pinata.cloud/ipfs/<hash>` - Gateway de Pinata (si usas Pinata)

### Pinning
Asegurarse de que los archivos estén "pinned" para evitar garbage collection:
- Pinata: Automático
- Infura: Automático con plan pagado
- Nodo propio: Requiere configuración

## 💰 Costos Estimados

### Pinata
- Free: 1GB, 100 NFTs/mes
- Picnic: $20/mes, 20GB
- Submarine: $100/mes, 100GB

### Infura IPFS
- Free: 5GB, 100k requests/día
- Growth: $50/mes, 50GB, 500k requests/día

## 🚀 Próximos Pasos

1. **Inmediato**: Implementar upload básico con Pinata (más fácil de configurar)
2. **Corto plazo**: Agregar encriptación opcional para documentos sensibles
3. **Mediano plazo**: Implementar gateway propio para mayor control
4. **Largo plazo**: Migrar a solución descentralizada completa (IPFS + Filecoin)

---

**Prioridad**: 🔴 ALTA - Frontend ya implementado y esperando backend  
**Complejidad**: ⭐⭐⚫⚫⚫ Media  
**Tiempo estimado**: 2-4 horas
