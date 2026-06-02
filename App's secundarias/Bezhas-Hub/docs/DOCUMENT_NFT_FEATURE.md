# 📄 Funcionalidad de NFTs de Documentos

## Resumen
Se ha implementado la capacidad de crear NFTs a partir de documentos (PDFs, Word, Excel, TXT, JSON) además de imágenes tradicionales. Esta funcionalidad está diseñada para casos de uso legales, contratos, patentes, certificados y documentos oficiales que requieren inmutabilidad en blockchain.

## 🎯 Casos de Uso

### Documentos Legales
- Contratos digitales inmutables
- Acuerdos de confidencialidad
- Términos y condiciones verificables

### Propiedad Intelectual
- Patentes registradas en blockchain
- Documentos de copyright
- Certificados de autoría

### Certificaciones
- Diplomas y certificados académicos
- Certificaciones profesionales
- Documentos de identidad verificables

### Registros Oficiales
- Escrituras de propiedad
- Licencias digitales
- Documentos gubernamentales

## 🚀 Características Implementadas

### 1. Selector de Tipo de Activo
- **Imagen/Arte**: Para NFTs tradicionales de arte digital
- **Documento/Contrato**: Para documentos legales y oficiales

### 2. Subida de Documentos
- **Formatos soportados**:
  - PDF (`.pdf`)
  - Microsoft Word (`.doc`, `.docx`)
  - Microsoft Excel (`.xls`, `.xlsx`)
  - Texto plano (`.txt`)
  - JSON (`.json`)

- **Límite de tamaño**: 10MB máximo
- **Validación automática**: Tipo de archivo y tamaño

### 3. Interfaz de Usuario
- **Vista previa de documento**: Muestra icono, nombre y tamaño
- **Barra de progreso**: Indicador visual durante la subida
- **Estados del botón**: Se adapta según el tipo de activo
- **Información contextual**: Tooltip con casos de uso

### 4. Iconos Específicos
- 📕 PDF: Icono rojo para archivos PDF
- 📘 Word: Icono azul para documentos Word
- 📗 Excel: Icono verde para hojas de cálculo
- 📄 Otros: Icono genérico para TXT/JSON

## 💻 Implementación Técnica

### Estado del Formulario
```javascript
assetType: 'image' | 'document',  // Tipo de activo
documentFile: File | null,         // Archivo subido
documentType: string,              // MIME type del archivo
uploading: boolean,                // Estado de subida
uploadProgress: number             // Progreso 0-100
```

### Funciones Principales

#### `handleDocumentUpload(e)`
- Valida tipo de archivo
- Verifica tamaño (máx 10MB)
- Simula progreso de subida
- Genera URL IPFS mock (TODO: implementar real)
- Actualiza estado del formulario

#### `getDocumentIcon(type)`
- Retorna el icono correcto según el MIME type
- Colores específicos por tipo de documento

#### `formatFileSize(bytes)`
- Formatea bytes a B, KB o MB
- Muestra tamaño legible

### Validación de Archivos
```javascript
const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/json'
];
```

## 🔄 Flujo de Usuario

1. **Seleccionar Tipo**: Usuario elige entre "Imagen/Arte" o "Documento/Contrato"
2. **Subir Archivo**: Click en área de subida o arrastrar archivo
3. **Validación**: Sistema verifica tipo y tamaño
4. **Progreso**: Barra visual muestra progreso de subida
5. **Confirmación**: Vista previa con detalles del documento
6. **Crear NFT**: Botón actualizado refleja el tipo de NFT

## 📊 Panel de Resumen

El resumen ahora incluye:
- **Tipo de activo**: Icono y texto (Imagen/Documento)
- **Nombre del archivo**: Solo para documentos
- **Tamaño del archivo**: Formato legible
- **Precio, royalty, categoría y supply**: Información estándar

## ⚠️ Pendientes (TODO)

### 1. Integración IPFS Real
```javascript
// TODO: Reemplazar subida mock con servicio real
const formDataUpload = new FormData();
formDataUpload.append('file', file);
const response = await fetch('/api/upload', { 
    method: 'POST', 
    body: formDataUpload 
});
const { url } = await response.json();
```

### 2. Backend Upload Endpoint
Crear endpoint en `backend/routes/upload.routes.js`:
- Recibir archivo del frontend
- Subir a IPFS (Pinata/Infura)
- Retornar URL permanente
- Considerar encriptación para documentos sensibles

### 3. Metadata Específica
Agregar campos adicionales para documentos:
- **Tipo de documento**: Contrato, patente, certificado
- **Emisor/Autoridad**: Quién emite el documento
- **Fecha de emisión**
- **Fecha de expiración** (opcional)
- **Hash de verificación**

### 4. Vista Previa de Documentos
- Renderizado de PDFs en modal
- Visor de Word/Excel
- Verificación de integridad

### 5. Extender a Otros Formularios
Implementar en:
- FractionalNFTForm
- LazyMintingForm
- BundleNFTForm (paquetes de documentos)

### 6. Seguridad y Encriptación
- Cifrado de documentos sensibles
- Control de acceso basado en NFT
- Firma digital de documentos

## 🎨 Estilos y Animaciones

### Área de Subida
- Borde punteado con hover effect
- Transiciones suaves
- Estados visuales claros (vacío, subiendo, completo)

### Barra de Progreso
- Gradiente púrpura-rosa
- Animación fluida
- Desaparece automáticamente después de completar

### Información de Documento
- Fondo semitransparente
- Iconos en color según tipo
- Check verde al completar

## 📝 Ejemplo de Uso

```javascript
// Estado inicial
assetType: 'document'
documentFile: null

// Después de subir
assetType: 'document'
documentFile: File { name: "contrato.pdf", size: 245678 }
documentType: "application/pdf"
image: "ipfs://QmXXX.../contrato.pdf"
```

## 🔗 Archivos Modificados

1. **frontend/src/pages/CreateNFTPage.jsx**
   - Líneas 1-5: Agregados iconos de documentos
   - Líneas 270-288: Estado con campos de documento
   - Líneas 325-408: Funciones de manejo de documentos
   - Líneas 463-620: UI de subida de documentos
   - Líneas 703-730: Resumen actualizado
   - Líneas 733-740: Botón dinámico

## 🌟 Mejoras Futuras

1. **Drag & Drop**: Implementar arrastrar y soltar
2. **Múltiples archivos**: Bundle de documentos relacionados
3. **Firma digital**: Integrar con servicios de firma electrónica
4. **Timestamping**: Marca de tiempo verificable en blockchain
5. **Versiones**: Sistema de versionado de documentos
6. **Notarización**: Integración con servicios de notaría digital
7. **OCR**: Extracción de texto para búsqueda
8. **Watermarking**: Marca de agua automática

## 📱 Responsive Design

La interfaz es completamente responsive:
- Mobile: Stack vertical de elementos
- Tablet: Diseño adaptativo
- Desktop: Experiencia completa con previsualizaciones

## ✅ Estado Actual

- ✅ UI completa e integrada
- ✅ Validación de archivos
- ✅ Indicadores de progreso
- ✅ Iconos específicos por tipo
- ✅ Resumen dinámico
- ⏳ Subida IPFS (mock implementado, real pendiente)
- ⏳ Backend endpoint (pendiente)
- ⏳ Metadata extendida (pendiente)

## 🎓 Notas para Desarrolladores

- **Imports**: Todos los iconos de `react-icons/fa`
- **Estado**: Gestionado con `useState`
- **Validación**: Cliente + servidor (servidor pendiente)
- **Almacenamiento**: IPFS para descentralización
- **Caching**: Considerar para archivos grandes

---

**Versión**: 1.0  
**Fecha**: 2024  
**Autor**: BeZhas Development Team  
**Status**: ✅ Funcional en frontend, ⏳ Backend pendiente
