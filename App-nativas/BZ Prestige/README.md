# BZ Prestige

Portal oficial "Digital Product Passport" (DPP) para la vertical de Lujo y Retail de BeZhas.

## Funcionalidades
1. **Autenticación (DPP):** Escaneo de patrones fotogramétricos o etiquetas NFC para probar la autenticidad física de un artículo y leer su token (ERC-721/6551) asociado en la L2.
2. **Mercado Secundario (Resale Market):** Interfaz para revender activos tokenizados.
3. **Royalties Automatizados:** Enrutamiento de regalías automáticas para las marcas originales en cada reventa (EIP-2981).
4. **Brand Treasury:** Dashboard analítico para medir el rendimiento de la recaudación de regalías en la reventa.

## Estructura
- **App.jsx**: Enrutamiento principal.
- **pages/Authenticator.jsx**: Simulación de escáner NFC.
- **pages/SecondaryMarket.jsx**: Panel de transferencia y royalties.
- **pages/BrandAnalytics.jsx**: Panel de control financiero.

## Cómo Ejecutar
```bash
pnpm install
pnpm dev
```
La aplicación correrá en `http://localhost:3015`.
