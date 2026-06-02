# 📄 BeZhas Platform - Listado de Páginas

**Última Actualización:** 26 de Enero, 2026  
**Versión:** 1.2  
**Base URL:** `http://localhost:5173`

---

## 📊 Resumen

| Categoría | Cantidad |
|-----------|----------|
| Páginas Públicas | 15 |
| Páginas Protegidas (Usuario) | 8 |
| Páginas Admin | 8 |
| Centro de IA | 8 tabs |
| Ad Center | 5 |
| DAO/DeFi | 5 |
| Documentación | 3 |
| **Total** | **~45 páginas** |

---

## 🔗 Enlaces Rápidos (Click para abrir)

### Principales
- 🏠 [Landing](http://localhost:5173/) | [Home](http://localhost:5173/home) | [Feed](http://localhost:5173/feed)
- 🛒 [Marketplace](http://localhost:5173/marketplace) | [Shop](http://localhost:5173/shop)
- 💰 [Staking](http://localhost:5173/staking) | [Farming](http://localhost:5173/farming)
- 🏛️ [DAO](http://localhost:5173/dao-page) | [RWA](http://localhost:5173/rwa)
- 💬 [Chat](http://localhost:5173/chat) | [Local AI](http://localhost:5173/local-ai)
- 👤 [Profile](http://localhost:5173/profile) | [Settings](http://localhost:5173/settings)

### Admin
- 🛡️ [Admin Dashboard](http://localhost:5173/admin) | [Admin Login](http://localhost:5173/admin-login)
- 👥 [Users Management](http://localhost:5173/admin/users-management)
- 📝 [Content Management](http://localhost:5173/admin/content)
- � [Centro de IA](http://localhost:5173/admin/ai) | [Diagnóstico](http://localhost:5173/admin/ai?tab=diagnostic)
- ⚙️ [Admin Config](http://localhost:5173/admin/config)

### Centro de IA (Nuevo)
- 🧠 [Vista General](http://localhost:5173/admin/ai) | [Diagnóstico IA](http://localhost:5173/admin/ai?tab=diagnostic)
- 💬 [Chat & Config](http://localhost:5173/admin/ai?tab=chat-config) | [Funcionalidades](http://localhost:5173/admin/ai?tab=features)
- 🤖 [Agentes](http://localhost:5173/admin/ai?tab=agents) | [Modelos](http://localhost:5173/admin/ai?tab=models)
- 🔧 [Herramientas](http://localhost:5173/admin/ai?tab=tools) | [Analytics](http://localhost:5173/admin/ai?tab=analytics)

### Ad Center
- 📢 [Ad Center](http://localhost:5173/ad-center) | [Campaigns](http://localhost:5173/ad-center/campaigns)
- 💳 [Billing](http://localhost:5173/ad-center/billing)

### Developer
- 🛠️ [Developer Console](http://localhost:5173/developer-console)
- 🧪 [SDK Test](http://localhost:5173/sdk-test)
- 📊 [ML Dashboard](http://localhost:5173/ml-dashboard)
- 🤖 [Automation Demo](http://localhost:5173/automation-demo)

---

## 🌐 Páginas Públicas

| Ruta | Enlace | Componente | Descripción |
|------|--------|------------|-------------|
| `/` | [Abrir](http://localhost:5173/) | `LandingPage` | Página de marketing principal |
| `/home` | [Abrir](http://localhost:5173/home) | `HomePage` | Feed principal de la aplicación |
| `/feed` | [Abrir](http://localhost:5173/feed) | `HomePage` | Acceso directo al feed |
| `/login` | [Abrir](http://localhost:5173/login) | `LoginPage` | Inicio de sesión |
| `/register` | [Abrir](http://localhost:5173/register) | `RegisterPage` | Registro de nuevos usuarios |
| `/auth` | [Abrir](http://localhost:5173/auth) | `AuthPage` | Autenticación unificada |
| `/about` | [Abrir](http://localhost:5173/about) | `AboutPage` | Información sobre BeZhas |
| `/marketplace` | [Abrir](http://localhost:5173/marketplace) | `MarketplaceUnified` | Marketplace unificado |
| `/shop` | [Abrir](http://localhost:5173/shop) | `MarketplaceUnified` | Redirección al marketplace |
| `/social` | [Abrir](http://localhost:5173/social) | `SocialFeed` | Feed social |
| `/feed-old` | [Abrir](http://localhost:5173/feed-old) | `BeZhasFeed` | Feed legacy |
| `/oracle` | [Abrir](http://localhost:5173/oracle) | `OraclePage` | Data Oracle |
| `/light-home` | [Abrir](http://localhost:5173/light-home) | `LightHomePage` | Demo modo claro |
| `/whitepaper` | [Abrir](http://localhost:5173/whitepaper) | `WhitePaper` | Whitepaper técnico |
| `/real-estate` | [Abrir](http://localhost:5173/real-estate) | `RealEstateGame` | Juego de bienes raíces |

---

## 🔒 Páginas Protegidas (Requieren Wallet)

| Ruta | Enlace | Componente | Descripción |
|------|--------|------------|-------------|
| `/profile` | [Abrir](http://localhost:5173/profile) | `ProfilePage` | Perfil del usuario |
| `/profile/edit` | [Abrir](http://localhost:5173/profile/edit) | `ProfileEditPage` | Editar perfil |
| `/settings` | [Abrir](http://localhost:5173/settings) | `SettingsPage` | Configuración |
| `/create` | [Abrir](http://localhost:5173/create) | `CreatePage` | Hub de creación |
| `/staking` | [Abrir](http://localhost:5173/staking) | `StakingPageUnified` | Staking y Farming |
| `/farming` | [Abrir](http://localhost:5173/farming) | `StakingPageUnified` | Tab farming |
| `/notifications` | [Abrir](http://localhost:5173/notifications) | `NotificationsPage` | Notificaciones |
| `/rewards` | [Abrir](http://localhost:5173/rewards) | `RewardsPage` | Recompensas |

---

## 👑 Páginas VIP

| Ruta | Enlace | Componente | Descripción |
|------|--------|------------|-------------|
| `/be-vip` | [Abrir](http://localhost:5173/be-vip) | `BeVIP` | Suscripción VIP |
| `/vip` | [Abrir](http://localhost:5173/vip) | `BeVIP` | Alias para BeVIP |
| `/vip/success` | [Abrir](http://localhost:5173/vip/success) | `VIPSuccess` | Confirmación de pago VIP |

---

## 🛡️ Páginas de Administración

| Ruta | Enlace | Componente | Roles Permitidos |
|------|--------|------------|------------------|
| `/admin` | [Abrir](http://localhost:5173/admin) | `AdminDashboard` | Super Admin, Admin, Developer, Treasury, DAO, Community |
| `/admin/users-management` | [Abrir](http://localhost:5173/admin/users-management) | `AdminUsersPage` | Super Admin, Admin |
| `/admin/content` | [Abrir](http://localhost:5173/admin/content) | `ContentManagementPage` | Super Admin, Admin |
| `/admin/ads` | [Abrir](http://localhost:5173/admin/ads) | `AdminAdsPage` | Super Admin, Admin |
| `/admin/ai` | [Abrir](http://localhost:5173/admin/ai) | `AdminAI` (Centro de IA completo) | Super Admin, Admin, Developer |
| `/admin/config` | [Abrir](http://localhost:5173/admin/config) | `AdminConfigPage` | Super Admin, Admin |
| `/admin-login` | [Abrir](http://localhost:5173/admin-login) | `AdminLogin` | Público |
| `/superpanel` | [Abrir](http://localhost:5173/superpanel) | `SuperPanel` | Super Admin |

### Tabs del AdminDashboard

Acceso directo con URL: `http://localhost:5173/admin?tab=<TAB_ID>`

| Tab ID | Enlace | Descripción |
|--------|--------|-------------|
| `dashboard` | [Abrir](http://localhost:5173/admin?tab=dashboard) | KPIs y estadísticas |
| `dao` | [Abrir](http://localhost:5173/admin?tab=dao) | Gobernanza DAO |
| `treasury` | [Abrir](http://localhost:5173/admin?tab=treasury) | Tesorería |
| `quality-oracle` | [Abrir](http://localhost:5173/admin?tab=quality-oracle) | Quality Oracle |
| `bridge` | [Abrir](http://localhost:5173/admin?tab=bridge) | Bridge API |
| `sdk-vip` | [Abrir](http://localhost:5173/admin?tab=sdk-vip) | SDK & VIP |
| `analytics` | [Abrir](http://localhost:5173/admin?tab=analytics) | Analíticas |
| `users` | [Abrir](http://localhost:5173/admin?tab=users) | Usuarios |
| `updates` | [Abrir](http://localhost:5173/admin?tab=updates) | Actualizaciones |
| `modules` | [Abrir](http://localhost:5173/admin?tab=modules) | Módulos |
| `activity` | [Abrir](http://localhost:5173/admin?tab=activity) | Actividad |
| `content` | [Abrir](http://localhost:5173/admin?tab=content) | Contenido |
| `system` | [Abrir](http://localhost:5173/admin?tab=system) | Sistema |

> ⚠️ **Nota:** Las tabs `diagnostic` y `chat-ai` fueron movidas al [Centro de IA](/admin/ai)

### Tabs del Centro de IA (/admin/ai)

Acceso directo: `http://localhost:5173/admin/ai?tab=<TAB_ID>`

| Tab ID | Enlace | Descripción |
|--------|--------|-------------|
| `overview` | [Abrir](http://localhost:5173/admin/ai) | Vista General - Estadísticas de IA |
| `diagnostic` | [Abrir](http://localhost:5173/admin/ai?tab=diagnostic) | 🔴 Diagnóstico IA - Salud del sistema |
| `chat-config` | [Abrir](http://localhost:5173/admin/ai?tab=chat-config) | 💬 Chat & Config - Agentes y parámetros |
| `features` | [Abrir](http://localhost:5173/admin/ai?tab=features) | ✨ Hub de Funcionalidades IA |
| `agents` | [Abrir](http://localhost:5173/admin/ai?tab=agents) | 🤖 Gestión de Agentes |
| `models` | [Abrir](http://localhost:5173/admin/ai?tab=models) | 🧠 Modelos disponibles |
| `tools` | [Abrir](http://localhost:5173/admin/ai?tab=tools) | 🔧 Herramientas (Function Calling) |
| `analytics` | [Abrir](http://localhost:5173/admin/ai?tab=analytics) | 📊 Analytics de IA |

---

## 📢 Ad Center (Centro de Publicidad)

| Ruta | Enlace | Componente | Descripción |
|------|--------|------------|-------------|
| `/ad-center` | [Abrir](http://localhost:5173/ad-center) | `AdCenterDashboard` | Dashboard principal |
| `/ads` | [Abrir](http://localhost:5173/ads) | → `/ad-center` | Redirección |
| `/ad-center/welcome/1` | [Abrir](http://localhost:5173/ad-center/welcome/1) | `WelcomeWizard` | Wizard paso 1 |
| `/ad-center/welcome/2` | [Abrir](http://localhost:5173/ad-center/welcome/2) | `WelcomeWizard` | Wizard paso 2 |
| `/ad-center/welcome/3` | [Abrir](http://localhost:5173/ad-center/welcome/3) | `WelcomeWizard` | Wizard paso 3 |
| `/ad-center/dashboard` | [Abrir](http://localhost:5173/ad-center/dashboard) | `AdCenterDashboard` | Dashboard campañas |
| `/ad-center/create-campaign/1` | [Abrir](http://localhost:5173/ad-center/create-campaign/1) | `CreateCampaignWizard` | Crear campaña paso 1 |
| `/ad-center/billing` | [Abrir](http://localhost:5173/ad-center/billing) | `BillingPage` | Facturación |
| `/ad-center/campaigns` | [Abrir](http://localhost:5173/ad-center/campaigns) | `CampaignsList` | Lista de campañas |

---

## 🏛️ DAO y Gobernanza

| Ruta | Enlace | Componente | Descripción |
|------|--------|------------|-------------|
| `/dao-page` | [Abrir](http://localhost:5173/dao-page) | `DAOPage` | Gobernanza DAO |
| `/governance` | [Abrir](http://localhost:5173/governance) | → `/dao-page` | Redirección |
| `/rwa` | [Abrir](http://localhost:5173/rwa) | `RWAPage` | Real World Assets |

---

## 💰 DeFi

| Ruta | Enlace | Componente | Descripción |
|------|--------|------------|-------------|
| `/staking` | [Abrir](http://localhost:5173/staking) | `StakingPageUnified` | Staking y Farming |
| `/farming` | [Abrir](http://localhost:5173/farming) | `StakingPageUnified` | Farming |
| `/defi` | [Abrir](http://localhost:5173/defi) | → `/staking` | Redirección |

---

## 💬 Chat y Comunicación

| Ruta | Enlace | Componente | Descripción |
|------|--------|------------|-------------|
| `/chat` | [Abrir](http://localhost:5173/chat) | `ChatPage` | Chat principal |
| `/local-ai` | [Abrir](http://localhost:5173/local-ai) | `LocalAIPage` | Demo IA local |

---

## 🛠️ Herramientas de Desarrollador

| Ruta | Enlace | Componente | Descripción |
|------|--------|------------|-------------|
| `/developer-console` | [Abrir](http://localhost:5173/developer-console) | `DeveloperConsole` | API Keys, SDK |
| `/developers` | [Abrir](http://localhost:5173/developers) | `DeveloperConsole` | Alias |
| `/sdk-test` | [Abrir](http://localhost:5173/sdk-test) | `SDKTestPage` | Pruebas del SDK |
| `/ml-dashboard` | [Abrir](http://localhost:5173/ml-dashboard) | `MLDashboard` | Machine Learning |
| `/automation-demo` | [Abrir](http://localhost:5173/automation-demo) | `AutomationDemo` | Automation Engine |
| `/metrics` | [Abrir](http://localhost:5173/metrics) | `MetricsDashboard` | Métricas |

---

## 🏢 Business

| Ruta | Enlace | Componente | Descripción |
|------|--------|------------|-------------|
| `/business-dashboard` | [Abrir](http://localhost:5173/business-dashboard) | `BusinessDashboard` | Dashboard empresarial |
| `/logistics` | [Abrir](http://localhost:5173/logistics) | `LogisticsPage` | Demo de logística |

---

## 📚 Documentación

| Ruta | Enlace | Componente | Descripción |
|------|--------|------------|-------------|
| `/docs` | [Abrir](http://localhost:5173/docs) | `DocsHub` | Hub de documentación |
| `/docs/getting-started` | [Abrir](http://localhost:5173/docs/getting-started) | `DocViewer` | Guía de inicio |
| `/docs/api` | [Abrir](http://localhost:5173/docs/api) | `DocViewer` | Documentación API |
| `/docs/sdk` | [Abrir](http://localhost:5173/docs/sdk) | `DocViewer` | Documentación SDK |

---

## 🔗 Callbacks y Utilidades

| Ruta | Enlace | Componente | Descripción |
|------|--------|------------|-------------|
| `/auth/github/callback` | N/A | `GitHubCallback` | Callback OAuth GitHub |

---

## 🚫 Páginas Eliminadas (Legacy)

| Ruta Original | Razón |
|---------------|-------|
| `/badges` | Sistema de badges eliminado |
| `/groups` | Feature de grupos no implementada |
| `/members` | Movido a otras secciones |
| `/ranks` | Sistema de rankings eliminado |
| `/quests` | Sistema de quests eliminado |
| `/dao/*` (múltiples) | DAO complejo simplificado a `/dao-page` |

---

## 🔐 Wallets Autorizadas para Admin

### Equipo Fundador y Asesores (Polygon)

| Wallet | Rol | Descripción |
|--------|-----|-------------|
| `0x52df82920cbae522880dd7657e43d1a754ed044e` | Super Admin | Wallet principal equipo fundador |
| `0x3EfC42095E8503d41Ad8001328FC23388E00e8a3` | Super Admin | BeZhas Wallet 1 |
| `0x89c23890c742d710265dd61be789c71dc8999b12` | Treasury | Tesorería y Desarrollo DAO |
| `0xc0ec3b1fcb7dc0c764371919837c13b58cdc330a` | Community | Fondo de Comunidad/Recompensas |

### Roles Disponibles

| Rol | Color | Permisos |
|-----|-------|----------|
| **SUPER_ADMIN** | 🟡 Gold | `*` (Todos los permisos) |
| **ADMIN** | 🔵 Blue | `admin.read`, `admin.write`, `admin.users`, `admin.system`, `admin.config` |
| **DEVELOPER** | 🟣 Purple | `admin.read`, `developer.tools`, `developer.debug`, `developer.api`, `developer.logs` |
| **TREASURY** | 🟢 Green | `admin.read`, `treasury.read`, `treasury.write`, `treasury.transfers`, `dao.treasury` |
| **DAO** | 🔵 Cyan | `admin.read`, `dao.proposals`, `dao.voting`, `dao.governance`, `dao.treasury` |
| **COMMUNITY** | 🟠 Orange | `admin.read`, `community.rewards`, `community.staking`, `community.events` |

---

## 📱 Estructura de Navegación

```
http://localhost:5173/
├── Landing Page (/)
├── App Principal
│   ├── Home/Feed (/home, /feed)
│   ├── Marketplace (/marketplace, /shop)
│   ├── DeFi (/staking, /farming)
│   ├── DAO (/dao-page, /rwa)
│   ├── Chat (/chat)
│   └── Profile (/profile, /settings)
│
├── Ad Center (/ad-center/*)
│   ├── Dashboard
│   ├── Campaigns
│   ├── Billing
│   └── Create Campaign Wizard
│
├── Admin Panel (/admin/*)
│   ├── Dashboard (13 tabs)
│   ├── Users Management
│   ├── Content
│   ├── Ads
│   └── Config
│
├── 🧠 Centro de IA (/admin/ai) ← NUEVO
│   ├── Vista General
│   ├── Diagnóstico IA
│   ├── Chat & Config
│   ├── Hub de Funcionalidades
│   ├── Gestión de Agentes
│   ├── Modelos de IA
│   ├── Herramientas
│   └── Analytics IA
│
├── Developer Tools
│   ├── Developer Console
│   ├── SDK Test
│   └── ML Dashboard
│
└── Docs (/docs/*)
```

---

## 🧪 URLs de Prueba Rápida

```bash
# Copiar y pegar en el navegador:

# Principales
http://localhost:5173/
http://localhost:5173/home
http://localhost:5173/marketplace
http://localhost:5173/staking

# Admin Dashboard
http://localhost:5173/admin
http://localhost:5173/admin?tab=treasury
http://localhost:5173/admin?tab=dao

# 🧠 Centro de IA (NUEVO)
http://localhost:5173/admin/ai
http://localhost:5173/admin/ai?tab=diagnostic
http://localhost:5173/admin/ai?tab=chat-config
http://localhost:5173/admin/ai?tab=features
http://localhost:5173/admin/ai?tab=agents

# Developer
http://localhost:5173/developer-console
http://localhost:5173/ml-dashboard

# Ad Center
http://localhost:5173/ad-center
http://localhost:5173/ad-center/campaigns
```

---

## 🔄 Actualizaciones Futuras

1. **Wallet Connect v3** - Migración en progreso
2. **Mobile PWA** - Optimización para móviles
3. **Multi-idioma** - Sistema de traducción completo
4. **Analytics v2** - Dashboard de analíticas mejorado

---

*Documento generado automáticamente. Para cambios, editar `frontend/src/App.jsx`*
