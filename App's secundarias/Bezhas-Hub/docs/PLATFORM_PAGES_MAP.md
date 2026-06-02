# 🗺️ Mapa de Páginas de la Plataforma BeZhas

> **Última actualización**: 29 de enero de 2026  
> **Versión**: 3.0 - Incluye Real Yield Economy, Quality Oracle V2, LP Pool Integration

---

## 📊 Estadísticas de Páginas

| Categoría | Páginas | Estado |
|-----------|---------|--------|
| **Públicas** | 18 | ✅ Activas |
| **Protegidas (Usuario)** | 8 | ✅ Activas |
| **Admin** | 7 | ✅ Activas |
| **DeFi** | 6 | ✅ Activas |
| **DAO** | 4 | ✅ Activas |
| **Developer** | 3 | ✅ Activas |
| **Total** | **46** | ✅ |

---

## 🌐 Rutas Públicas

### Core Pages
| Ruta | Página | Descripción |
|------|--------|-------------|
| `/` | `LandingPage` | Página de marketing (redirige a /home si conectado) |
| `/home` | `HomePage` | Feed principal de la aplicación |
| `/feed` | `HomePage` | Alias del feed principal |
| `/login` | `LoginPage` | Inicio de sesión |
| `/register` | `RegisterPage` | Registro de usuario |
| `/auth` | `AuthPage` | **NUEVO**: Autenticación unificada (Email, Google, Facebook, Wallet) |
| `/about` | `AboutPage` | Información sobre BeZhas |
| `/whitepaper` | `WhitePaper` | WhitePaper técnico del proyecto |

### Social & Content
| Ruta | Página | Descripción |
|------|--------|-------------|
| `/social` | `SocialFeed` | Feed social alternativo |
| `/notifications` | `NotificationsPage` | Centro de notificaciones |
| `/chat` | `ChatPage` | Chat en tiempo real con WebSocket |

### Marketplace & Commerce
| Ruta | Página | Descripción |
|------|--------|-------------|
| `/marketplace` | `MarketplaceUnified` | Marketplace unificado (Productos + NFTs + Crear) |
| `/shop` | `MarketplaceUnified` | Alias del marketplace |
| `/rwa` | `RWAPage` | **NUEVO**: Real World Assets Marketplace |
| `/buy-tokens` | `BuyTokensPage` | **NUEVO**: Compra de tokens BEZ con múltiples métodos de pago |
| `/logistics` | `LogisticsPage` | Demo del sistema logístico |
| `/real-estate` | `RealEstateGame` | Juego de Real Estate con NFTs |

### Documentation
| Ruta | Página | Descripción |
|------|--------|-------------|
| `/docs` | `DocsHub` | Hub de documentación |
| `/docs/:docId` | `DocViewer` | Visor de documentación específica |

---

## 💰 Rutas DeFi & Finanzas

### DeFi Hub
| Ruta | Página | Descripción |
|------|--------|-------------|
| `/defi-hub` | `DeFiHub` | **NUEVO**: Centro DeFi con LP Pool QuickSwap integrado |
| `/liquidity` | `DeFiHub` | Alias para DeFi Hub (gestión de liquidez) |
| `/staking` | `StakingPageUnified` | Staking + Farming unificado con tabs |
| `/farming` | `StakingPageUnified` | Redirige a staking (abre tab farming) |
| `/defi` | → `/staking` | Redirige a staking unificado |

### VIP & Rewards
| Ruta | Página | Descripción |
|------|--------|-------------|
| `/be-vip` | `BeVIP` | Planes de suscripción VIP (Bronze, Silver, Gold, Platinum) |
| `/vip` | `BeVIP` | Alias para BeVIP |
| `/vip/success` | `VIPSuccess` | Página de éxito tras pago VIP |
| `/rewards` | `RewardsPage` | Sistema de recompensas |

### Metrics & Oracle
| Ruta | Página | Descripción |
|------|--------|-------------|
| `/oracle` | `OraclePage` | Data Oracle para precios y feeds |
| `/metrics` | `MetricsDashboard` | Dashboard de métricas de la plataforma |

---

## 🏛️ Rutas DAO & Governance

| Ruta | Página | Descripción |
|------|--------|-------------|
| `/dao-page` | `DAOPage` | DAO simplificado con gobernanza básica |
| `/governance` | → `/dao-page` | Redirige a DAO Page |

> **Nota**: El sistema DAO complejo fue optimizado. Las rutas originales (`/dao/treasury`, `/dao/talent`, etc.) fueron eliminadas según `OPTIMIZATION_AND_INTEGRATIONS_GUIDE.md`.

---

## 🔐 Rutas Protegidas (Usuario Autenticado)

| Ruta | Página | Descripción |
|------|--------|-------------|
| `/profile` | `ProfilePage` | Perfil unificado (Profile + Wallet + Dashboard + Settings) |
| `/profile/edit` | `ProfileEditPage` | Editar perfil |
| `/profile/:address` | `ProfilePage` | Ver perfil de otro usuario |
| `/settings` | `SettingsPage` | Configuración con selección de red |
| `/create` | `CreatePage` | Hub de creación unificado (Posts, NFTs, Productos) |
| `/staking` | `StakingPageUnified` | Staking + Farming con tabs |
| `/farming` | `StakingPageUnified` | Farming (abre tab farming) |

---

## 📢 Rutas Ad Center (Publicidad)

| Ruta | Página | Descripción |
|------|--------|-------------|
| `/ad-center` | `AdCenterDashboard` | Dashboard principal de publicidad |
| `/ads` | → `/ad-center` | Redirige a Ad Center |
| `/ad-center/welcome/:step` | `WelcomeWizard` | Wizard de bienvenida |
| `/ad-center/dashboard` | `AdCenterDashboard` | Dashboard de campañas |
| `/ad-center/create-campaign/:step` | `CreateCampaignWizard` | Crear campaña paso a paso |
| `/ad-center/billing` | `BillingPage` | Facturación y pagos |
| `/ad-center/campaigns` | `CampaignsList` | Lista de campañas |

---

## 🛠️ Rutas Developer Tools

| Ruta | Página | Descripción |
|------|--------|-------------|
| `/developer-console` | `DeveloperConsole` | Consola de desarrollador (API Keys, SDK Tools) |
| `/developers` | `DeveloperConsole` | Alias para Developer Console |
| `/sdk-test` | `SDKTestPage` | Página de pruebas del SDK |

---

## 🤖 Rutas AI & Machine Learning

| Ruta | Página | Descripción |
|------|--------|-------------|
| `/local-ai` | `LocalAIPage` | Demo de AI local |
| `/ml-dashboard` | `MLDashboard` | Dashboard de Machine Learning |
| `/automation-demo` | `AutomationDemo` | Demo del motor de automatización |

---

## 👨‍💼 Rutas Admin (Requiere Rol Admin)

| Ruta | Página | Descripción |
|------|--------|-------------|
| `/admin` | `AdminDashboard` | Dashboard principal de administración |
| `/admin/panel` | → `/admin` | Redirige a dashboard admin |
| `/admin/users-management` | `AdminUsersPage` | Gestión de usuarios |
| `/admin/users` | → `/admin/users-management` | Alias de gestión de usuarios |
| `/admin/content` | `ContentManagementPage` | Gestión de contenido |
| `/admin/ads` | `AdminAdsPage` | Gestión de publicidad |
| `/admin/ai` | `AdminAI` | Panel de control de IA |
| `/admin/config` | `AdminConfigPage` | Configuración del sistema |

### Acceso Admin
| Ruta | Página | Descripción |
|------|--------|-------------|
| `/admin-login` | `AdminLogin` | Login de administrador |
| `/superpanel` | `SuperPanel` | Super Panel (acceso especial) |

---

## 🆕 Páginas Recientes (Enero 2026)

### Real Yield Economy
- **`/buy-tokens`** - Página de compra de tokens BEZ con 6 paquetes y 3 métodos de pago
- **`/defi-hub`** - DeFi Hub con integración LP Pool QuickSwap
- **`/liquidity`** - Alias para gestión de liquidez

### Quality Oracle V2
- Integración en `/marketplace`, `/rwa`, `/create` para validación multi-sector

### Security & 2FA
- Panel de seguridad integrado en `/settings` y `/profile`

---

## 🔗 Componentes Globales

Componentes que aparecen en múltiples páginas:

| Componente | Descripción | Páginas |
|------------|-------------|---------|
| `GlobalStatsBar` | Barra de estadísticas (Treasury 24h, LP APY, RWA TVL, Active LPs) | DeFiHub, BuyTokensPage, StakingPage, FarmingPage, DAOPage, RWAPage, Marketplace |
| `Sidebar` | Navegación lateral principal | Todas las páginas autenticadas |
| `Navbar` | Barra de navegación superior | Todas las páginas |
| `WalletConnect` | Modal de conexión de wallet | Global |

---

## 📱 Responsividad

Todas las páginas soportan:
- **Desktop**: 1920px+
- **Laptop**: 1024px - 1919px
- **Tablet**: 768px - 1023px
- **Mobile**: < 768px

---

## 🚫 Páginas Eliminadas/Deshabilitadas

Las siguientes páginas fueron eliminadas según la guía de optimización:

| Ruta | Razón |
|------|-------|
| `/badges` | Sistema de badges eliminado |
| `/groups` | Feature no implementada |
| `/members` | Movido a otras secciones |
| `/ranks` | Sistema de rankings eliminado |
| `/quests` | Sistema de quests eliminado |
| `/ai-chat` | Consolidado en LocalAI |
| `/dao/treasury` | DAO complejo eliminado |
| `/dao/talent` | DAO complejo eliminado |
| `/dao/governance` | Consolidado en `/dao-page` |
| `/dao/advertising` | Consolidado en Ad Center |
| `/dao/admin` | Consolidado en Admin Panel |
| `/dao/plugins` | Feature eliminada |

---

## 📋 Checklist de Verificación

- [x] Todas las rutas públicas accesibles sin autenticación
- [x] Rutas protegidas requieren wallet conectada
- [x] Rutas admin requieren rol ADMIN
- [x] Redirecciones funcionando correctamente
- [x] 404 para rutas no encontradas
- [x] GlobalStatsBar visible en páginas DeFi
- [x] Sidebar con enlaces actualizados
- [x] Responsive en todos los breakpoints

---

## 🔄 Historial de Cambios

### v3.0 (29 Enero 2026)
- ✅ Añadido `/buy-tokens` - Compra de tokens BEZ
- ✅ Añadido `/defi-hub` y `/liquidity` - DeFi Hub con LP Pool
- ✅ Añadido `/rwa` - Real World Assets Marketplace
- ✅ Integración GlobalStatsBar en 7 páginas
- ✅ Quality Oracle V2 multi-sector
- ✅ Panel de seguridad 2FA

### v2.0 (14 Enero 2026)
- DAO simplificado a `/dao-page`
- Marketplace unificado
- Auth unificado (`/auth`)

### v1.0 (Diciembre 2025)
- Estructura inicial de rutas
- Admin panel básico
