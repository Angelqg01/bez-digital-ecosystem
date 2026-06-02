import { Suspense, lazy, useEffect, useState } from 'react';
import { createBrowserRouter, Outlet, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// --- Providers & Stores ---
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { Web3Provider } from './context/Web3Context';
import { BezCoinProvider } from './context/BezCoinContext';
// import { DAOProvider } from './context/DAOContext'; // REMOVED: Sistema DAO complejo eliminado
import { MarketplaceProvider } from './context/MarketplaceContext';
import { RightSidebarProvider } from './context/RightSidebarContext';
import { useAccount } from 'wagmi';
import useUserStore from './stores/userStore';

// --- Layouts & Components ---
import MainLayout from './components/layout/MainLayout';
import SidebarDrawer from './components/SidebarDrawer';
import { Spinner } from './components/ui/Spinner';
import { BezCoinLoader } from './components/ui/BezCoinLoader';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AdminRoute from './components/auth/AdminRoute';
import PendingTransactionIndicator from './components/PendingTransactionIndicator';
import WalletDiagnosticPanel from './components/wallet/WalletDiagnosticPanel';
import InstallPWA from './components/layout/InstallPWA';
import GlobalModals from './components/GlobalModals';
import TranslateWidget from './components/TranslateWidget';
import { BezPayProvider } from './context/BezPayContext';
import BezPayModal from './components/payments/BezPayModal';

// --- Pages (Lazy Loaded) ---
const LandingPage = lazy(() => import('./pages/LandingPage')); // NEW: Marketing Landing Page
const HomePage = lazy(() => import('./pages/HomePage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage')); // Simple Profile (temporary fix)
const ProfileEditPage = lazy(() => import('./pages/ProfileEditPage')); // NEW: Profile Edit Page
const MarketplaceUnified = lazy(() => import('./pages/MarketplaceUnified')); // Unified Marketplace + Shop + Create
const StakingPageUnified = lazy(() => import('./pages/StakingPage')); // Updated path
const FarmingPage = lazy(() => import('./pages/FarmingPage')); // Added FarmingPage
const OraclePage = lazy(() => import('./pages/OraclePage')); // NEW: Data Oracle
const CreatePage = lazy(() => import('./pages/Create')); // Unified Creation Hub
const BeZhasFeed = lazy(() => import('./pages/BeZhasFeed'));
const BridgePage = lazy(() => import('./pages/BridgePage')); // NEW: Bridge Page
// ProfileView removed - using ProfilePage instead
// const BadgesPage = lazy(() => import('./pages/BadgesPage')); // REMOVED: Badges system eliminated in cleanup
// CreateItemPage removed - now integrated into MarketplaceUnified Tab 3
// MarketplacePage removed - now integrated into MarketplaceUnified Tab 1
// ShopPage removed - now integrated into MarketplaceUnified Tab 1
// FarmingPage removed - now integrated into StakingPageUnified
const SettingsPage = lazy(() => import('./pages/SettingsPage')); // Settings with Network config
const ContactSyncPage = lazy(() => import('./pages/ContactSyncPage')); // NEW: Web SaaS Contact Synchronization
// const GroupsPage = lazy(() => import('./pages/GroupsPage')); // REMOVED: Groups feature not implemented
// const MembersPage = lazy(() => import('./pages/MembersPage')); // REMOVED: Members moved to other sections
// const QuestsPage = lazy(() => import('./pages/QuestsPage')); // REMOVED: Quests system eliminated
// const RanksPage = lazy(() => import('./pages/RanksPageNew')); // REMOVED: Rankings system eliminated
// SettingsPage removed - now integrated into ProfilePage
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const SuperPanel = lazy(() => import('./pages/SuperPanel'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const ContentManagementPage = lazy(() => import('./pages/ContentManagementPage'));
const MetricsDashboard = lazy(() => import('./pages/MetricsDashboard')); // Re-enabled for testing
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
// REMOVED: RewardsPage - Redundante, Watch-to-Earn disponible en otras secciones
// const RewardsPage = lazy(() => import('./pages/RewardsPage'));
// REMOVED: SocialFeed - Duplica funcionalidad de HomePage (/home)
// const SocialFeed = lazy(() => import('./pages/SocialFeed'));
const BeVIP = lazy(() => import('./pages/BeVIP'));
const VIPSuccess = lazy(() => import('./pages/VIPSuccess')); // VIP Subscription Success Page
const ChatPage = lazy(() => import('./pages/ChatPage')); // Restaurando componente completo
const AutomationDemo = lazy(() => import('./pages/AutomationDemo')); // 🤖 Automation Engine Demo
const RealEstateGame = lazy(() => import('./pages/RealEstateGame'));

// Ad Center Pages
const WelcomeWizard = lazy(() => import('./pages/AdCenter/WelcomeWizard'));
const AdCenterDashboard = lazy(() => import('./pages/AdCenter/Dashboard'));
const CreateCampaignWizard = lazy(() => import('./pages/AdCenter/CreateCampaign/index'));
const BillingPage = lazy(() => import('./pages/AdCenter/BillingPage'));
const CampaignsList = lazy(() => import('./pages/AdCenter/CampaignsList'));
const AIChat = lazy(() => import('./pages/AIChat')); // NEW: AI Engine Chat
const AdminAI = lazy(() => import('./pages/admin/AdminAI')); // NEW: AI Admin Panel
const AdminAdsPage = lazy(() => import('./pages/admin/AdminAdsPage')); // NEW: Ads Admin Panel
const AdminSDK = lazy(() => import('./pages/admin/AdminSDK')); // NEW: SDK & AI Management
const LocalAIPage = lazy(() => import('./pages/LocalAIPage')); // NEW: Local AI Demo
const MLDashboard = lazy(() => import('./pages/MLDashboard')); // NEW: Machine Learning Dashboard
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage')); // NEW: Admin User Management
const AdminConfigPage = lazy(() => import('./pages/AdminConfigPage')); // NEW: Unified Platform Config
const AgentDashboard = lazy(() => import('./pages/admin/AgentDashboard')); // NEW: Agent Dashboard
const AutomationHub = lazy(() => import('./pages/admin/AutomationHub')); // NEW: Unified Intelligence & Automation Hub
const AdminAegis = lazy(() => import('./components/admin/aegis/AegisDashboard')); // NEW: Aegis Dashboard
const MagazinePage = lazy(() => import('./pages/MagazinePage')); // BeZhas Magazine
const AdminMagazinePage = lazy(() => import('./pages/admin/AdminMagazinePage')); // Admin Magazine

// NEW: Light Mode Design System Demo
const LightHomePage = lazy(() => import('./pages/LightHomePage'));

// NEW: Business Dashboard
const BusinessDashboard = lazy(() => import('./pages/BusinessDashboard'));
const LogisticsPage = lazy(() => import('./pages/Logistics/LogisticsPage')); // NEW: Logistics Demo
const WhitePaper = lazy(() => import('./pages/WhitePaper')); // NEW: WhitePaper Technical
const DocsHub = lazy(() => import('./pages/docs/DocsHub')); // NEW: Documentation Hub
const DocViewer = lazy(() => import('./pages/docs/DocViewer')); // NEW: Documentation Viewer

// DAO Module Pages - OPTIMIZED: Solo página unificada
// const DAOLayout = lazy(() => import('./pages/dao/DAOLayout')); // REMOVED: Sistema DAO complejo eliminado
// const TreasuryDashboard = lazy(() => import('./pages/dao/TreasuryDashboard')); // REMOVED
// const TalentDashboard = lazy(() => import('./pages/dao/TalentDashboard')); // REMOVED
// const GovernanceHub = lazy(() => import('./pages/dao/GovernanceHub')); // REMOVED
// const AdMarketplace = lazy(() => import('./pages/dao/AdMarketplace')); // REMOVED
// const DAOAdminPanel = lazy(() => import('./components/admin/DAOAdminPanel')); // REMOVED
// const PluginManager = lazy(() => import('./pages/dao/PluginManager')); // REMOVED
const DAOPage = lazy(() => import('./pages/DAOPage')); // DAO Page Unificada: Gobernanza simplificada
const Industria40FundPage = lazy(() => import('./pages/dao/Industria40FundPage')); // NEW: Industry 4.0 Fund Details
const SaludBiotecFundPage = lazy(() => import('./pages/dao/SaludBiotecFundPage')); // NEW: Health & Biotech Fund Details
const EnergiaSmartCitiesFundPage = lazy(() => import('./pages/dao/EnergiaSmartCitiesFundPage')); // NEW: Energy & Smart Cities Fund Details
const LogisticaSupplyChainFundPage = lazy(() => import('./pages/dao/LogisticaSupplyChainFundPage')); // NEW: Logistics & Supply Chain Fund Details
const GobiernoGobernanzaFundPage = lazy(() => import('./pages/dao/GobiernoGobernanzaFundPage')); // NEW: Government & Governance Fund Details
const BancaFintechFundPage = lazy(() => import('./pages/dao/BancaFintechFundPage')); // NEW: Banking & Fintech Fund Details
const EducacionCredencialesFundPage = lazy(() => import('./pages/dao/EducacionCredencialesFundPage')); // NEW: Education & Credentials Fund Details
const RWAPage = lazy(() => import('./pages/RWAPage')); // NEW: Real World Assets Marketplace

// New Governance & Compliance
const GovernancePage = lazy(() => import('./pages/GovernancePage'));
const CompliancePage = lazy(() => import('./pages/CompliancePage'));

// Developer Tools
const DeveloperConsole = lazy(() => import('./pages/DeveloperConsole')); // NEW: API Key Management
// SDKTestPage removed from production build - requires @sdk dependencies not available in container
// const SDKTestPage = lazy(() => import('./pages/SDKTestPage')); // NEW: SDK Integration TestPage
const AuthPage = lazy(() => import('./pages/AuthPage')); // NEW: Unified Auth (Email, Google, Facebook, Wallet)
const BuyTokensPage = lazy(() => import('./pages/BuyTokensPage')); // Token Purchase Page
const DeFiHub = lazy(() => import('./pages/DeFiHub')); // DeFi Hub with LP Integration
const BezPayPage = lazy(() => import('./pages/BezPayPage')); // NEW: BeZhas Pay System v2.0 full page

// AI Guide Widget (Global)
import BezhasGuideWidget from './components/AI/BezhasGuideWidget';

// Journey Overlay (Global)
import JourneyOverlay from './components/common/JourneyOverlay';

/**
 * @dev This component orchestrates data fetching based on the Web3 connection state.
 * It's a non-visual component that triggers user data fetching upon connection.
 */
import { useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import { UserProfileAddress, UserProfileABI, BezhasTokenAddress, BezhasTokenABI } from './contract-config';

// Import dev tools (only loaded in development mode)
import './utils/devTools';
import telemetry from './utils/telemetry';

const AppOrchestrator = () => {
  const { address, isConnected } = useAccount();
  const { fetchUserData, clearUserData } = useUserStore();
  const { data: walletClient } = useWalletClient();

  // Inicializar Web Vitals y telemetry global al cargar la app
  useEffect(() => {
    telemetry.initWebVitals();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (isConnected && address && walletClient) {
        if (import.meta.env.DEV) {
          console.log('📊 Orchestrator: Wallet connected, fetching user data...');
        }
        try {
          // Use walletClient from wagmi to create ethers provider
          // This works with all wallet types (MetaMask, WalletConnect, etc.)
          const provider = new ethers.BrowserProvider(walletClient);
          const signer = await provider.getSigner();

          const userProfileContract = new ethers.Contract(UserProfileAddress, UserProfileABI, signer);
          const tokenContract = new ethers.Contract(BezhasTokenAddress, BezhasTokenABI, signer);

          await fetchUserData(signer, userProfileContract, tokenContract);

          if (import.meta.env.DEV) {
            console.log('✅ Orchestrator: User data fetch complete.');
          }
        } catch (error) {
          console.error("❌ Orchestrator: Error fetching user data:", error);
          // Don't show error to user, just log it
        }
      } else if (!isConnected) {
        // Silently clear user data when disconnected - no need to log
        clearUserData();
      }
    };

    fetchData();
  }, [address, isConnected, walletClient, fetchUserData, clearUserData]);

  return null; // This component does not render anything
};

/**
 * @dev The root component that wraps the entire application with necessary context providers.
 */
const Root = () => {
  // TEMPORAL: Usuario mock para testing de roles del Agente IA
  // TODO: Reemplazar con useAuth() cuando esté integrado el sistema de autenticación
  const mockUser = {
    name: "Test User",
    // Cambiar entre: 'user', 'developer', 'admin' para probar diferentes personalidades
    role: "developer"
  };

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <Web3Provider>
          <AuthProvider>
            <BezCoinProvider>
              <MarketplaceProvider>
                <RightSidebarProvider>
                  {/* BezPayProvider — Sistema de pago BEZ nativo v2.0 */}
                  <BezPayProvider>
                    {/* <DAOProvider> REMOVED: Sistema DAO complejo eliminado */}
                    <AppOrchestrator />
                    <GlobalModals />
                    <Toaster position="top-right" />
                    <PendingTransactionIndicator />
                    <InstallPWA />
                    {/* WalletDiagnosticPanel moved to ProfilePage */}

                    {/* BezPayModal — Modal global de pago BEZ (reemplaza todos los modales de pago) */}
                    <BezPayModal />

                    {/* Journey Overlay - Guía explicativa para clientes/usuarios (Global y persistente) */}
                    <JourneyOverlay />

                    {/* AI Guide Widget - Global y persistente en todas las páginas */}
                    <BezhasGuideWidget currentUser={mockUser} />

                    {/* Google Translate Widget - Global */}
                    <div className="fixed bottom-4 left-4 z-50 shadow-lg rounded-lg overflow-hidden">
                      <TranslateWidget />
                    </div>

                    {/* Important: render child route element here */}
                    <Outlet />
                    {/* </DAOProvider> */}
                  </BezPayProvider>
                </RightSidebarProvider>
              </MarketplaceProvider>
            </BezCoinProvider>
          </AuthProvider>
        </Web3Provider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

/**
 * @dev The main application layout which includes the sidebar and main content area.
 * It uses Suspense to handle lazy-loaded pages.
 * OPTIMIZED: Removed double LandingPage rendering to fix dynamic import errors.
 */
const AppLayout = () => {
  const { isConnected, isConnecting } = useAccount();
  const [showConnecting, setShowConnecting] = useState(true);
  const location = window.location.pathname;

  useEffect(() => {
    // Reducir timeout a 1 segundo para carga más rápida
    const timer = setTimeout(() => {
      setShowConnecting(false);
    }, 1000);

    if (!isConnecting) {
      setShowConnecting(false);
    }

    return () => clearTimeout(timer);
  }, [isConnecting]);

  // Mostrar loading solo si está conectando activamente
  if (isConnecting && showConnecting) {
    return (
      <div className="w-full h-screen flex justify-center items-center bg-gradient-to-br from-slate-900 to-purple-900">
        <BezCoinLoader size="lg" text="Conectando wallet..." />
      </div>
    );
  }

  // Páginas públicas que no requieren MainLayout (landing, auth, etc.)
  const publicPaths = ['/', '/login', '/register', '/auth', '/admin-login', '/auth/github/callback'];
  const isPublicPage = publicPaths.includes(location);

  // Si es página pública y no está conectado, mostrar sin MainLayout
  if (!isConnected && isPublicPage) {
    return (
      <Suspense fallback={
        <div className="w-full h-screen flex justify-center items-center bg-gradient-to-br from-slate-900 to-purple-900">
          <BezCoinLoader size="lg" text="Cargando..." />
        </div>
      }>
        <Outlet />
      </Suspense>
    );
  }

  // Si está conectado o es una ruta protegida, mostrar layout normal con sidebar
  return (
    <MainLayout>
      <Suspense fallback={<div className="w-full h-screen flex items-center justify-center"><BezCoinLoader size="lg" text="" showProgress={false} /></div>}>
        <Outlet />
      </Suspense>
    </MainLayout>
  );
};

const GitHubCallback = lazy(() => import('./pages/GitHubCallback'));
const LinkedInCallback = lazy(() => import('./pages/LinkedInCallback'));

/**
 * @dev LandingRoute - Wrapper component for the root route.
 * Redirects connected users to /home, shows LandingPage for non-connected users.
 */
const LandingRoute = () => {
  const { isConnected } = useAccount();

  if (isConnected) {
    return <Navigate to="/home" replace />;
  }

  return <LandingPage />;
};

// Define the application's routes using React Router DOM v6
export const router = createBrowserRouter(
  [
    {
      element: <Root />,
      children: [
        {
          element: <AppLayout />,
          children: [
            // --- Public Routes ---
            { path: '/', element: <LandingRoute /> }, // Marketing Landing Page (redirects to /home if connected)
            { path: '/home', element: <HomePage /> }, // Main app home (feed)
            { path: '/feed', element: <HomePage /> }, // Direct access to feed (protected)
            { path: '/login', element: <LoginPage /> }, // [KEEP]
            { path: '/register', element: <RegisterPage /> }, // [KEEP]
            { path: '/auth/github/callback', element: <GitHubCallback /> },
            { path: '/auth/linkedin/callback', element: <LinkedInCallback /> },
            { path: '/auth', element: <AuthPage /> }, // [KEEP] NEW: Unified Auth Page (Email, Google, Facebook, Wallet)
            { path: '/admin-login', element: <AdminLogin /> }, // [KEEP]
            { path: '/superpanel', element: <SuperPanel /> },
            { path: '/feed-old', element: <BeZhasFeed /> }, // OLD: Legacy feed (kept for reference)
            { path: '/social', element: <Navigate to="/home" replace /> }, // REMOVED: Redirige al feed principal
            // { path: '/badges', element: <BadgesPage /> }, // REMOVED: Badges system eliminated
            // { path: '/groups', element: <GroupsPage /> }, // REMOVED: Groups feature not implemented
            // Rutas de Marketplace y DeFi migradas a subapps correspondientes
            // { path: '/marketplace', element: <MarketplaceUnified /> }, // [MIGRATED to BZ Capital / Ecosystem]
            // { path: '/shop', element: <MarketplaceUnified /> }, // [MIGRATED]
            // { path: '/defi', element: <Navigate to="/staking" replace /> }, // [MIGRATED to BZ Capital]
            // { path: '/governance', element: <GovernancePage /> }, // [MIGRATED to BeZhas Wallet]
            { path: '/compliance', element: <CompliancePage /> }, // [KEEP] Compliance Dashboard
            { path: '/oracle', element: <OraclePage /> }, // NEW: Data Oracle
            // { path: '/members', element: <MembersPage /> }, // REMOVED: Members moved to other sections
            // { path: '/ranks', element: <RanksPage /> }, // REMOVED: Rankings system eliminated
            { path: '/metrics', element: <MetricsDashboard /> }, // Re-enabled
            { path: '/about', element: <AboutPage /> },
            { path: '/magazine', element: <MagazinePage /> },
            { path: '/notifications', element: <NotificationsPage /> },
            { path: '/rewards', element: <Navigate to="/profile" replace /> }, // REMOVED: Redirige al perfil (incluye balance y stats)
            { path: '/be-vip', element: <BeVIP /> },
            { path: '/vip', element: <BeVIP /> }, // Alias for BeVIP
            { path: '/vip/success', element: <VIPSuccess /> }, // VIP Payment Success
            { path: '/business-dashboard', element: <BusinessDashboard /> }, // NEW: Business Dashboard
            { path: '/logistics', element: <LogisticsPage /> }, // NEW: Logistics Demo
            { path: '/real-estate', element: <RealEstateGame /> },
            { path: '/rwa', element: <RWAPage /> }, // NEW: RWA Marketplace
            { path: '/buy-tokens', element: <BuyTokensPage /> }, // Token Purchase (integrado con BezPayModal)
            { path: '/pay', element: <BezPayPage /> }, // BeZhas Pay System v2.0 — página completa
            { path: '/bez-pay', element: <BezPayPage /> }, // Alias: BeZhas Pay System
            // { path: '/liquidity', element: <DeFiHub /> }, // [MIGRATED to BZ Capital]
            // { path: '/defi-hub', element: <DeFiHub /> }, // [MIGRATED to BZ Capital]
            { path: '/light-home', element: <LightHomePage /> }, // NEW: Light Mode Design System Demo
            { path: '/whitepaper', element: <WhitePaper /> }, // NEW: WhitePaper Technical
            { path: '/docs', element: <DocsHub /> }, // NEW: Documentation Hub
            { path: '/docs/:docId', element: <DocViewer /> }, // NEW: Documentation Viewer

            // --- Ad Center Routes ---
            { path: '/ad-center', element: <AdCenterDashboard /> }, // Main Ad Center Dashboard
            { path: '/ads', element: <Navigate to="/ad-center" replace /> }, // Redirect old route
            { path: '/ad-center/welcome/:step', element: <WelcomeWizard /> },
            { path: '/ad-center/dashboard', element: <AdCenterDashboard /> },
            { path: '/ad-center/create-campaign/:step', element: <CreateCampaignWizard /> },
            { path: '/ad-center/billing', element: <BillingPage /> },
            { path: '/ad-center/campaigns', element: <CampaignsList /> },

            { path: '/chat', element: <ChatPage /> },
            { path: '/ai-chat', element: <Suspense fallback={<Spinner size="lg" />}><AIChat /></Suspense> }, // NEW: AI Chat
            { path: '/local-ai', element: <LocalAIPage /> }, // NEW: Local AI Demo
            { path: '/ml-dashboard', element: <MLDashboard /> }, // NEW: Machine Learning Dashboard
            // /automation-demo has been moved to /admin/automation-demo or inside AutomationHub

            // --- Developer Tools ---
            { path: '/developer-console', element: <DeveloperConsole /> }, // [KEEP] NEW: API Key Management & SDK Tools
            { path: '/developers', element: <DeveloperConsole /> }, // [KEEP] Alias for Developer Console
            // { path: '/sdk-test', element: <SDKTestPage /> }, // SDK Test disabled in production

            // --- DAO Module Routes - OPTIMIZED ---
            // Sistema DAO complejo eliminado según OPTIMIZATION_AND_INTEGRATIONS_GUIDE.md
            // {
            //   path: '/dao',
            //   element: <DAOLayout />,
            //   children: [
            //     { path: 'treasury', element: <TreasuryDashboard /> },
            //     { path: 'talent', element: <TalentDashboard /> },
            //     { path: 'governance', element: <GovernanceHub /> },
            //     { path: 'advertising', element: <AdMarketplace /> },
            //     { path: 'admin', element: <DAOAdminPanel /> },
            //     { path: 'plugins', element: <PluginManager /> },
            //   ],
            // },
            // { path: '/dao-page', element: <DAOPage /> }, // [MIGRATED to BeZhas Wallet]
            { path: '/dao/industria-4-0', element: <Industria40FundPage /> }, // Industry 4.0 Fund Details
            { path: '/dao/salud-biotecnologia', element: <SaludBiotecFundPage /> }, // Health & Biotech Fund Details
            { path: '/dao/energia-smart-cities', element: <EnergiaSmartCitiesFundPage /> }, // Energy & Smart Cities Fund Details
            { path: '/dao/logistica-supply-chain', element: <LogisticaSupplyChainFundPage /> }, // Logistics & Supply Chain Fund Details
            { path: '/dao/gobierno-gobernanza', element: <GobiernoGobernanzaFundPage /> }, // Government & Governance Fund Details
            { path: '/dao/banca-fintech', element: <BancaFintechFundPage /> }, // Banking & Fintech Fund Details
            { path: '/dao/educacion-credenciales', element: <EducacionCredencialesFundPage /> }, // Education & Credentials Fund Details

            // --- Protected User Routes ---
            {
              element: <ProtectedRoute />,
              children: [
                { path: 'profile', element: <ProfilePage /> }, // Unified: Profile + Wallet + Dashboard + Settings
                { path: 'profile/edit', element: <ProfileEditPage /> }, // NEW: Edit Profile
                { path: 'contacts/sync', element: <ContactSyncPage /> }, // NEW: Contact Search & Sync
                { path: 'profile/:address', element: <ProfilePage /> }, // View other user's profile
                { path: 'settings', element: <SettingsPage /> }, // Settings with Network configuration
                { path: 'create', element: <CreatePage /> }, // Unified Creation Hub
                // { path: 'staking', element: <StakingPageUnified /> }, // [MIGRATED to BZ Capital]
                // { path: 'farming', element: <FarmingPage /> }, // [MIGRATED to BZ Capital]
                // { path: 'bridge', element: <BridgePage /> }, // [MIGRATED to BeZhas Wallet]
                // { path: 'quests', element: <QuestsPage /> }, // REMOVED: Quests system eliminated
                // shop route removed - now points to MarketplaceUnified
              ],
            },

            // --- Protected Admin Routes ---
            {
              path: 'admin',
              element: <AdminRoute />,
              children: [
                {
                  element: <Suspense fallback={<Spinner size="lg" />}><AdminLayout /></Suspense>,
                  children: [
                    { index: true, element: <Suspense fallback={<Spinner size="lg" />}><AdminDashboard /></Suspense> },
                    { path: 'panel', element: <Navigate to="/admin" replace /> },
                    { path: 'users-management', element: <Suspense fallback={<Spinner size="lg" />}><AdminUsersPage /></Suspense> },
                    { path: 'users', element: <Navigate to="/admin/users-management" replace /> }, // Alias
                    { path: 'content', element: <Suspense fallback={<Spinner size="lg" />}><ContentManagementPage /></Suspense> },
                    { path: 'ads', element: <Suspense fallback={<Spinner size="lg" />}><AdminAdsPage /></Suspense> },
                    { path: 'ai', element: <Suspense fallback={<Spinner size="lg" />}><AdminAI /></Suspense> },
                    { path: 'automation', element: <Suspense fallback={<Spinner size="lg" />}><AutomationHub /></Suspense> },
                    { path: 'automation-demo', element: <Suspense fallback={<Spinner size="lg" />}><AutomationDemo /></Suspense> },
                    { path: 'magazine', element: <Suspense fallback={<Spinner size="lg" />}><AdminMagazinePage /></Suspense> },
                    { path: 'sdk', element: <Suspense fallback={<Spinner size="lg" />}><AdminSDK /></Suspense> },
                    { path: 'config', element: <Suspense fallback={<Spinner size="lg" />}><AdminConfigPage /></Suspense> },
                    { path: 'agents', element: <Suspense fallback={<Spinner size="lg" />}><AgentDashboard /></Suspense> },
                    { path: 'aegis', element: <Suspense fallback={<Spinner size="lg" />}><AdminAegis /></Suspense> },
                  ],
                },
              ],
            },

            // --- 404 Not Found Route ---
            { path: '*', element: <div><h2>404: Page Not Found</h2></div> },
          ],
        },
      ],
    }
  ],
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    },
  }
);

export default router;
