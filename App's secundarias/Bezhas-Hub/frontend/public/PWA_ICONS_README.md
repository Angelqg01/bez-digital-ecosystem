# Iconos PWA para BeZhas

Este directorio necesita contener dos iconos para que la aplicación sea instalable:

## Iconos Requeridos

1. **pwa-192x192.png** (192x192 píxeles)
   - Icono pequeño para el splash screen y notificaciones
   - Formato: PNG con transparencia
   - Diseño: Logo de BeZhas centrado con padding

2. **pwa-512x512.png** (512x512 píxeles)
   - Icono grande para pantalla de inicio
   - Formato: PNG con transparencia
   - Diseño: Logo de BeZhas centrado con padding

3. **apple-touch-icon.png** (180x180 píxeles)
   - Icono para dispositivos iOS
   - Formato: PNG
   - Diseño: Logo de BeZhas con fondo sólido (sin transparencia)

## Recomendaciones de Diseño

- **Fondo**: Color sólido (#0f172a - slate-900) o degradado azul/morado
- **Logo**: Centrado, ocupa 70-80% del espacio
- **Colores**: Usar la paleta de BeZhas (azul, morado, cyan)
- **Forma**: Cuadrado con bordes ligeramente redondeados opcional
- **Contraste**: Asegurar que el logo sea visible sobre el fondo

## Herramientas Recomendadas

Para generar los iconos puedes usar:
- **PWA Image Generator**: https://www.pwabuilder.com/imageGenerator
- **Favicon Generator**: https://realfavicongenerator.net/
- **Figma/Canva**: Diseñar manualmente

## Ubicación

Guardar los archivos en: `frontend/public/`

```
frontend/public/
├── pwa-192x192.png
├── pwa-512x512.png
└── apple-touch-icon.png
```

## Verificación

Una vez agregados los iconos:
1. Ejecutar `npm run build` en frontend
2. Verificar en Chrome DevTools > Application > Manifest
3. Los iconos deben aparecer listados correctamente
4. Probar instalación desde Chrome (ícono de instalación en barra de URL)
