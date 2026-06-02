import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { toast } from 'react-hot-toast';
import http from '../services/http';
import {
  ChevronDown,
  ChevronUp,
  Shield,
  Globe,
  Users,
  MessageCircle,
  Lock,
  Eye,
  FileText,
  CheckCircle,
  AlertCircle,
  Info,
  Wallet,
  UserCheck,
  Activity,
  TrendingUp,
  Award,
  Star
} from 'lucide-react';
import ConnectWalletButton from '../components/common/ConnectWalletButton';

const AboutPage = () => {
  const { address, isConnected } = useAccount();
  const [openSection, setOpenSection] = useState(null);

  // Estados de perfil y actividad del usuario
  const [userProfile, setUserProfile] = useState(null);
  const [userActivity, setUserActivity] = useState({
    sectionsViewed: [],
    timeSpent: 0,
    interactions: 0,
    lastVisit: null
  });
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [showProfileCard, setShowProfileCard] = useState(false);

  // ============================================================
  // FUNCIONES DE WALLET Y PERFIL
  // ============================================================

  // Cargar perfil del usuario
  const loadUserProfile = async () => {
    if (!address) return;

    setIsLoadingProfile(true);
    console.log('📥 Cargando perfil para:', address);

    try {
      const response = await http.get(`/api/users/profile/${address}`);
      console.log('✅ Perfil cargado:', response.data);

      setUserProfile(response.data.profile);
      setShowProfileCard(true);
      toast.success('¡Perfil cargado exitosamente!');
    } catch (error) {
      console.error('❌ Error cargando perfil:', error);

      // Crear perfil básico si no existe
      const fallbackProfile = {
        address,
        username: `User${address.slice(2, 8)}`,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${address}`,
        bio: 'Nuevo usuario de BeZhas',
        joinDate: new Date().toISOString(),
        stats: {
          sectionsViewed: 0,
          totalTimeSpent: 0,
          interactions: 0
        }
      };

      setUserProfile(fallbackProfile);
      setShowProfileCard(true);
      toast.success('Perfil creado localmente');
    } finally {
      setIsLoadingProfile(false);
    }
  };

  // Trackear visita a la página
  const trackPageVisit = async () => {
    if (!address) return;

    console.log('📊 Registrando visita de:', address);

    try {
      await http.post('/api/users/track-visit', {
        address,
        page: 'about',
        timestamp: new Date().toISOString()
      });

      setUserActivity(prev => ({
        ...prev,
        lastVisit: new Date().toISOString()
      }));

      console.log('✅ Visita registrada');
    } catch (error) {
      console.error('❌ Error tracking visit:', error);
    }
  };

  // Sincronizar actividad con backend
  const syncActivityToBackend = async () => {
    if (!isConnected || !address) return;

    console.log('🔄 Sincronizando actividad:', userActivity);

    try {
      const response = await http.post('/api/users/sync-activity', {
        address,
        sectionsViewed: userActivity.sectionsViewed.length,
        timeSpent: userActivity.timeSpent,
        interactions: userActivity.interactions
      });

      console.log('✅ Actividad sincronizada:', response.data);
    } catch (error) {
      console.error('❌ Error syncing activity:', error);
    }
  };

  // Trackear apertura de sección
  const trackSectionView = async (sectionId) => {
    console.log('👀 Viendo sección:', sectionId);

    if (!userActivity.sectionsViewed.includes(sectionId)) {
      setUserActivity(prev => ({
        ...prev,
        sectionsViewed: [...prev.sectionsViewed, sectionId],
        interactions: prev.interactions + 1
      }));

      // Actualizar en backend si está conectado
      if (isConnected && address) {
        try {
          await http.post('/api/users/track-interaction', {
            address,
            action: 'section_view',
            sectionId,
            metadata: {
              timestamp: new Date().toISOString()
            }
          });

          console.log('✅ Sección trackeada:', sectionId);
        } catch (error) {
          console.error('❌ Error tracking section view:', error);
        }
      }
    }
  };

  // ============================================================
  // EFFECTS
  // ============================================================

  // Debug: Log connection status
  useEffect(() => {
    console.log('🔌 Wallet Status:', { isConnected, address });
    console.log('👤 Profile Status:', { userProfile, showProfileCard });
  }, [isConnected, address, userProfile, showProfileCard]);

  // Cargar perfil del usuario cuando se conecta
  useEffect(() => {
    if (isConnected && address) {
      console.log('🚀 Wallet conectada, inicializando...');
      loadUserProfile();
      trackPageVisit();
    } else {
      // Limpiar estado cuando se desconecta
      setUserProfile(null);
      setShowProfileCard(false);
      setUserActivity({
        sectionsViewed: [],
        timeSpent: 0,
        interactions: 0,
        lastVisit: null
      });
    }
  }, [isConnected, address]);

  // Tracking de tiempo en la página
  useEffect(() => {
    if (!isConnected) return;

    const startTime = Date.now();
    console.log('⏱️ Iniciando tracking de tiempo');

    const interval = setInterval(() => {
      setUserActivity(prev => ({
        ...prev,
        timeSpent: Math.floor((Date.now() - startTime) / 1000)
      }));
    }, 1000);

    return () => {
      clearInterval(interval);
      console.log('⏹️ Deteniendo tracking de tiempo');

      if (isConnected && address) {
        syncActivityToBackend();
      }
    };
  }, [isConnected, address]);

  // ============================================================
  // HANDLERS
  // ============================================================

  const toggleSection = (section) => {
    const newState = openSection === section ? null : section;
    setOpenSection(newState);

    // Track section view si se abre
    if (newState === section) {
      console.log('📂 Abriendo sección:', section);
      trackSectionView(section);
    }
  };

  const AccordionSection = ({ id, title, icon: Icon, children }) => {
    const isOpen = openSection === id;

    return (
      <div className="mb-4 bg-dark-surface/20 dark:bg-light-surface/10 backdrop-blur-md border border-cyan-500/10 rounded-2xl overflow-hidden transition-all duration-300 hover:border-cyan-500/30">
        <button
          onClick={() => toggleSection(id)}
          className="w-full flex items-center justify-between p-6 text-left transition-colors hover:bg-dark-surface/30 dark:hover:bg-light-surface/20"
        >
          <div className="flex items-center gap-4">
            <Icon className="w-6 h-6 text-cyan-400/80" />
            <h2 className="text-xl md:text-2xl font-bold text-white/90">{title}</h2>
          </div>
          {isOpen ? (
            <ChevronUp className="w-6 h-6 text-cyan-400/80 flex-shrink-0" />
          ) : (
            <ChevronDown className="w-6 h-6 text-cyan-400/80 flex-shrink-0" />
          )}
        </button>

        {isOpen && (
          <div className="p-6 pt-0 text-gray-300/80 dark:text-gray-400/80 space-y-4 animate-fadeIn">
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen p-4 sm:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <header className="text-center mb-12">
        <h1
          className="text-4xl md:text-5xl font-bold text-white/90 mb-4"
          style={{
            textShadow: '0 0 10px rgba(0,255,255,0.2)'
          }}
        >
          Acerca de BeZhas
        </h1>
        <p className="text-lg text-cyan-200/70 max-w-3xl mx-auto">
          Plataforma Web3 que integra Social Network, Marketplace, DAO, NFTs, Suscripciones VIP,
          Pagos Fiat/Crypto, Real Estate, Healthcare, Automotive, Manufacturing y más.
        </p>
      </header>

      {/* Wallet Connection & Profile Card */}
      {!isConnected ? (
        <div className="mb-8 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-2xl p-6 backdrop-blur-md">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Wallet className="w-12 h-12 text-purple-400" />
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Conecta tu Wallet</h3>
                <p className="text-gray-400 text-sm">
                  Conecta tu wallet para acceder a funciones personalizadas y guardar tu progreso
                </p>
              </div>
            </div>
            <ConnectWalletButton
              variant="primary"
              size="lg"
            />
          </div>
        </div>
      ) : showProfileCard && userProfile && (
        <div className="mb-8 bg-gradient-to-br from-gray-900/90 via-purple-900/20 to-pink-900/20 border border-purple-500/30 rounded-2xl p-6 backdrop-blur-md shadow-xl">
          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* Avatar y Info Básica */}
            <div className="flex items-center gap-4 flex-1">
              <div className="relative">
                <img
                  src={userProfile.avatar}
                  alt={userProfile.username}
                  className="w-20 h-20 rounded-full border-4 border-purple-500/50"
                />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-gray-900 flex items-center justify-center">
                  <UserCheck size={14} className="text-white" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-white mb-1">{userProfile.username}</h3>
                <p className="text-gray-400 text-sm mb-2">{address?.slice(0, 6)}...{address?.slice(-4)}</p>
                {userProfile.bio && (
                  <p className="text-gray-300 text-sm">{userProfile.bio}</p>
                )}
              </div>
            </div>

            {/* Estadísticas de Actividad */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full md:w-auto">
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <Eye className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
                <p className="text-2xl font-bold text-white">{userActivity.sectionsViewed.length}</p>
                <p className="text-xs text-gray-400">Secciones</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <Activity className="w-5 h-5 text-green-400 mx-auto mb-1" />
                <p className="text-2xl font-bold text-white">{userActivity.interactions}</p>
                <p className="text-xs text-gray-400">Interacciones</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <TrendingUp className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                <p className="text-2xl font-bold text-white">{Math.floor(userActivity.timeSpent / 60)}m</p>
                <p className="text-xs text-gray-400">Tiempo</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <Award className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
                <p className="text-2xl font-bold text-white">{userProfile.stats?.sectionsViewed || 0}</p>
                <p className="text-xs text-gray-400">Total</p>
              </div>
            </div>
          </div>

          {/* Barra de Progreso */}
          <div className="mt-4 pt-4 border-t border-gray-700/50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-400">Exploración de la página</p>
              <p className="text-sm font-semibold text-cyan-400">
                {Math.round((userActivity.sectionsViewed.length / 8) * 100)}%
              </p>
            </div>
            <div className="w-full bg-gray-700/30 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-500"
                style={{ width: `${(userActivity.sectionsViewed.length / 8) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Sections */}
      <div className="space-y-4">

        {/* ==================== ¿QUÉ ES BEZHAS? ==================== */}
        <AccordionSection id="intro" title="¿Qué es BeZhas?" icon={Info}>
          <div className="space-y-4">
            <p className="leading-relaxed">
              <strong className="text-cyan-400/90">BeZhas</strong> es una plataforma Web3 integral que combina
              <strong> Social Network, Marketplace, DAO, NFTs, DeFi, y soluciones empresariales tokenizadas</strong>.
              Construida sobre <strong>Polygon Mainnet</strong> con smart contracts verificados, integra pagos
              híbridos (Stripe + Crypto), AI avanzada (Gemini, OpenAI), y más de 13 verticales industriales
              a través de <strong>ToolBez Enterprise</strong>.
            </p>

            <div className="bg-dark-background/30 dark:bg-light-background/30 rounded-xl p-4 border-l-4 border-cyan-500/50">
              <h3 className="font-bold text-white/90 mb-2 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                Ecosistema Completo
              </h3>
              <ul className="space-y-2 ml-7">
                <li>🌐 <strong>Blockchain Polygon:</strong> Smart Contracts en Polygon Mainnet</li>
                <li>💰 <strong>BEZ Token:</strong> Token nativo ERC-20 con staking y farming</li>
                <li>🏛️ <strong>DAO Governance:</strong> Votación descentralizada con propuestas on-chain</li>
                <li>🛍️ <strong>Marketplace Web3:</strong> Compra/venta con escrow inteligente</li>
                <li>💎 <strong>NFTs & Colecciones:</strong> Mint, trade, ofertas y rentas de NFTs</li>
                <li>👑 <strong>Suscripciones VIP:</strong> 4 tiers (Bronze a Platinum) con Stripe</li>
                <li>💳 <strong>Pagos Híbridos:</strong> Crypto, Stripe y transferencia bancaria</li>
                <li>🏢 <strong>ToolBez Enterprise:</strong> 13 verticales industriales tokenizadas</li>
              </ul>
            </div>
          </div>
        </AccordionSection>

        {/* ==================== CÓMO FUNCIONA ==================== */}
        <AccordionSection id="how-it-works" title="¿Cómo Funciona la Plataforma?" icon={Globe}>
          <div className="space-y-4">
            <h3 className="font-bold text-white/90 text-lg">Arquitectura Híbrida Web3</h3>
            <p className="leading-relaxed">
              BeZhas combina <strong>Smart Contracts en Polygon</strong>, backend Node.js con MongoDB/Redis,
              y frontend React. Integra AI (Gemini, OpenAI), oráculos de calidad blockchain, y sistemas
              de pago híbridos (Stripe + Web3) para ofrecer una experiencia completa.
            </p>

            <div className="grid md:grid-cols-2 gap-4 mt-6">
              <div className="bg-dark-surface/20 dark:bg-light-surface/10 rounded-xl p-4">
                <h4 className="font-bold text-cyan-400/90 mb-2 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Social Network
                </h4>
                <p className="text-sm">
                  Feed social con posts, likes, comentarios. Perfil de usuario verificado.
                  Sistema de moderación AI + Oracle de calidad blockchain.
                </p>
              </div>

              <div className="bg-dark-surface/20 dark:bg-light-surface/10 rounded-xl p-4">
                <h4 className="font-bold text-cyan-400/90 mb-2 flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Marketplace & NFTs
                </h4>
                <p className="text-sm">
                  Compra/venta con escrow inteligente. NFTs con ofertas, rentas, royalties.
                  Logística tokenizada con tracking blockchain.
                </p>
              </div>

              <div className="bg-dark-surface/20 dark:bg-light-surface/10 rounded-xl p-4">
                <h4 className="font-bold text-cyan-400/90 mb-2 flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Pagos & Finanzas
                </h4>
                <p className="text-sm">
                  Compra BEZ con Stripe, transferencia bancaria o crypto.
                  Staking, farming, swaps. VIP mensual con 4 tiers.
                </p>
              </div>

              <div className="bg-dark-surface/20 dark:bg-light-surface/10 rounded-xl p-4">
                <h4 className="font-bold text-cyan-400/90 mb-2 flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  DAO & Gobernanza
                </h4>
                <p className="text-sm">
                  Propuestas on-chain, votación ponderada por tokens.
                  Treasury DAO, delegación de votos, ejecución automática.
                </p>
              </div>
            </div>
          </div>
        </AccordionSection>

        {/* ==================== PRIVACIDAD - RESUMEN ==================== */}
        <AccordionSection id="privacy-overview" title="Resumen de Privacidad" icon={Eye}>
          <div className="space-y-4">
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
              <h3 className="font-bold text-cyan-300 mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Puntos Clave
              </h3>
              <ul className="space-y-3">
                <li className="flex gap-3">
                  <span className="text-cyan-400 flex-shrink-0">📢</span>
                  <div>
                    <strong className="text-white/90">Perfiles y publicaciones son públicos:</strong>
                    <span className="block text-sm mt-1">
                      BeZhas es un servicio de microblogging para conversaciones públicas.
                      Cualquier información en tu perfil y tus publicaciones es visible para todos.
                    </span>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="text-cyan-400 flex-shrink-0">🔒</span>
                  <div>
                    <strong className="text-white/90">Los mensajes directos son privados:</strong>
                    <span className="block text-sm mt-1">
                      El contenido de tus mensajes directos es privado entre tú y los usuarios
                      destinatarios. Pueden ser accedidos por moderadores solo en investigaciones
                      de violaciones graves.
                    </span>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="text-cyan-400 flex-shrink-0">🔄</span>
                  <div>
                    <strong className="text-white/90">Actualizaciones de privacidad:</strong>
                    <span className="block text-sm mt-1">
                      Podemos actualizar nuestra política. Te notificaremos mediante el sitio,
                      la aplicación o por correo electrónico.
                    </span>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </AccordionSection>

        {/* ==================== SINCRONIZACION DE CONTACTOS Y RECOMPENSAS ==================== */}
        <AccordionSection id="contact-sync" title="Sincronización de Contactos y Recompensas" icon={Users}>
          <div className="space-y-4">
            <div className="bg-dark-surface/20 dark:bg-light-surface/10 rounded-xl p-4">
              <h3 className="font-bold text-white/90 mb-2 flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-400" />
                Privacidad en la Sincronización (Hash Local)
              </h3>
              <p className="text-sm leading-relaxed text-gray-300">
                La sincronización de contactos utiliza un enfoque <strong>"Privacy-First"</strong>. Esto significa que los números de teléfono o correos electrónicos de tus amigos y clientes (Web o Móvil) <strong>nunca se transmiten a nuestros servidores en texto claro</strong>. Toda la información de contactos se encripta de forma segura a través de algoritmos matemáticos irreversibles (SHA-256) localmente en tu dispositivo antes de enviarla. Nosotros sólo procesamos y almacenamos los identificadores criptográficos.
              </p>
            </div>

            <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-4 mt-4">
              <h3 className="font-bold text-cyan-400/90 mb-2 flex items-center gap-2">
                <Award className="w-5 h-5" />
                Recompensa de 50 BEZ-Coins
              </h3>
              <p className="text-sm leading-relaxed text-gray-300">
                Al habilitar la sincronización de contactos (vía Browser Picker, Subida CSV o App Móvil BeZhas), nuestro sistema relacionará criptográficamente cuáles de tus contactos ya están usando la plataforma. 
                <strong>Por cada usuario emparejado que agregues a tu lista de amigos desde la pantalla de Sincronización, ¡recibirás una recompensa instantánea de 50 BEZ-Coins en tu cartera BeZhas!</strong>
              </p>
            </div>
          </div>
        </AccordionSection>

        {/* ==================== INFORMACIÓN QUE RECOPILAMOS ==================== */}
        <AccordionSection id="data-collection" title="Información que Recopilamos" icon={FileText}>
          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-white/90 mb-3">Información que nos proporcionas:</h3>
              <ul className="space-y-2 ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-1">•</span>
                  <span><strong>Creación de cuenta:</strong> Correo electrónico, teléfono, nombre de usuario</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-1">•</span>
                  <span><strong>Tus publicaciones:</strong> Contenido que compartes públicamente</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-1">•</span>
                  <span><strong>Mensajes directos:</strong> Comunicaciones privadas con otros usuarios</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-1">•</span>
                  <span><strong>Comunicaciones:</strong> Mensajes de soporte o contacto</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-1">•</span>
                  <span><strong>Información de pago:</strong> Procesada por proveedores externos seguros</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-white/90 mb-3">Información recopilada automáticamente:</h3>
              <ul className="space-y-2 ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-1">•</span>
                  <span><strong>Información de uso:</strong> Dirección IP, navegador, dispositivo, ISP</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-1">•</span>
                  <span><strong>Actividad:</strong> Publicaciones vistas, enlaces clicados, frecuencia de uso</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-1">•</span>
                  <span><strong>Cookies:</strong> Para mejorar tu experiencia y análisis del sitio</span>
                </li>
              </ul>
            </div>

            <div className="bg-dark-background/30 dark:bg-light-background/30 rounded-xl p-4">
              <h4 className="font-bold text-cyan-400/90 mb-2">🍪 Sobre las Cookies</h4>
              <p className="text-sm leading-relaxed">
                Usamos cookies estrictamente necesarias para el funcionamiento del sitio y cookies
                analíticas para mejorar nuestros servicios. Puedes configurar tu navegador para
                bloquear cookies, aunque esto puede afectar algunas funcionalidades.
              </p>
            </div>
          </div>
        </AccordionSection>

        {/* ==================== CÓMO USAMOS TU INFORMACIÓN ==================== */}
        <AccordionSection id="data-usage" title="Cómo Usamos tu Información" icon={CheckCircle}>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-dark-surface/20 dark:bg-light-surface/10 rounded-xl p-4">
                <h4 className="font-bold text-white/90 mb-2">🎯 Proporcionar Servicios</h4>
                <ul className="text-sm space-y-1 ml-4">
                  <li>• Administrar tu cuenta</li>
                  <li>• Acceso a funcionalidades</li>
                  <li>• Soporte técnico</li>
                  <li>• Comunicaciones importantes</li>
                </ul>
              </div>

              <div className="bg-dark-surface/20 dark:bg-light-surface/10 rounded-xl p-4">
                <h4 className="font-bold text-white/90 mb-2">🔧 Fines Administrativos</h4>
                <ul className="text-sm space-y-1 ml-4">
                  <li>• Mejora de la plataforma</li>
                  <li>• Prevención de fraude</li>
                  <li>• Seguridad de la red</li>
                  <li>• Análisis y métricas</li>
                </ul>
              </div>

              <div className="bg-dark-surface/20 dark:bg-light-surface/10 rounded-xl p-4">
                <h4 className="font-bold text-white/90 mb-2">📢 Marketing</h4>
                <ul className="text-sm space-y-1 ml-4">
                  <li>• Comunicaciones promocionales</li>
                  <li>• Nuevas funcionalidades</li>
                  <li>• Puedes cancelar suscripción</li>
                </ul>
              </div>

              <div className="bg-dark-surface/20 dark:bg-light-surface/10 rounded-xl p-4">
                <h4 className="font-bold text-white/90 mb-2">⚖️ Obligaciones Legales</h4>
                <ul className="text-sm space-y-1 ml-4">
                  <li>• Cumplimiento legal</li>
                  <li>• Responder a autoridades</li>
                  <li>• Hacer cumplir políticas</li>
                </ul>
              </div>
            </div>
          </div>
        </AccordionSection>

        {/* ==================== COMPARTIR INFORMACIÓN ==================== */}
        <AccordionSection id="data-sharing" title="Cómo Compartimos tu Información" icon={Users}>
          <div className="space-y-4">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
              <h4 className="font-bold text-yellow-300 mb-2 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Importante
              </h4>
              <p className="text-sm">
                Tus publicaciones y perfil son <strong>públicos</strong>. No vendemos tu
                información personal a terceros con fines publicitarios.
              </p>
            </div>

            <h4 className="font-bold text-white/90">Compartimos información con:</h4>
            <ul className="space-y-3 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 mt-1">•</span>
                <div>
                  <strong className="text-white/90">Otros usuarios:</strong> Cuando interactúas públicamente
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 mt-1">•</span>
                <div>
                  <strong className="text-white/90">Servicios de terceros:</strong> Si tú lo solicitas
                  (ej: otras aplicaciones del Protocolo AT)
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 mt-1">•</span>
                <div>
                  <strong className="text-white/90">Proveedores de servicios:</strong> IT, hosting,
                  procesamiento de pagos
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 mt-1">•</span>
                <div>
                  <strong className="text-white/90">Autoridades legales:</strong> Cuando sea legalmente
                  requerido
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 mt-1">•</span>
                <div>
                  <strong className="text-white/90">Transacciones corporativas:</strong> En caso de fusión
                  o adquisición
                </div>
              </li>
            </ul>
          </div>
        </AccordionSection>

        {/* ==================== TUS DERECHOS ==================== */}
        <AccordionSection id="your-rights" title="Tus Derechos de Privacidad" icon={Shield}>
          <div className="space-y-4">
            <p className="leading-relaxed">
              Dependiendo de tu ubicación, puedes tener los siguientes derechos:
            </p>

            <div className="grid md:grid-cols-2 gap-3">
              <div className="bg-dark-surface/20 dark:bg-light-surface/10 rounded-xl p-3">
                <h5 className="font-bold text-cyan-400/90 text-sm mb-1">📥 Acceso y Portabilidad</h5>
                <p className="text-xs">Obtener copia de tu información personal</p>
              </div>

              <div className="bg-dark-surface/20 dark:bg-light-surface/10 rounded-xl p-3">
                <h5 className="font-bold text-cyan-400/90 text-sm mb-1">✏️ Corrección</h5>
                <p className="text-xs">Actualizar información inexacta o incompleta</p>
              </div>

              <div className="bg-dark-surface/20 dark:bg-light-surface/10 rounded-xl p-3">
                <h5 className="font-bold text-cyan-400/90 text-sm mb-1">🗑️ Eliminación</h5>
                <p className="text-xs">Solicitar borrado de tu información personal</p>
              </div>

              <div className="bg-dark-surface/20 dark:bg-light-surface/10 rounded-xl p-3">
                <h5 className="font-bold text-cyan-400/90 text-sm mb-1">🚫 Exclusión Voluntaria</h5>
                <p className="text-xs">Optar por no recibir marketing o procesamiento</p>
              </div>

              <div className="bg-dark-surface/20 dark:bg-light-surface/10 rounded-xl p-3">
                <h5 className="font-bold text-cyan-400/90 text-sm mb-1">⏸️ Restricción</h5>
                <p className="text-xs">Limitar cómo usamos tu información</p>
              </div>

              <div className="bg-dark-surface/20 dark:bg-light-surface/10 rounded-xl p-3">
                <h5 className="font-bold text-cyan-400/90 text-sm mb-1">↩️ Retiro de Consentimiento</h5>
                <p className="text-xs">Retirar permiso para procesamiento futuro</p>
              </div>
            </div>

            <div className="bg-dark-background/30 dark:bg-light-background/30 rounded-xl p-4 mt-4">
              <h4 className="font-bold text-white/90 mb-2">📧 Opciones de Comunicación</h4>
              <ul className="text-sm space-y-2 ml-4">
                <li>• <strong>Correos de marketing:</strong> Cancela suscripción desde el enlace en el email</li>
                <li>• <strong>Notificaciones push:</strong> Desactívalas en la configuración de tu dispositivo</li>
                <li>• <strong>Ubicación:</strong> Controla permisos desde tu dispositivo</li>
              </ul>
            </div>

            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 mt-4">
              <p className="text-sm">
                <strong className="text-cyan-300">Para ejercer tus derechos:</strong> Contáctanos en{' '}
                <a href="mailto:support@bezhas.app" className="text-cyan-400 hover:text-cyan-300 underline">
                  support@bezhas.app
                </a>
              </p>
            </div>
          </div>
        </AccordionSection>

        {/* ==================== SEGURIDAD ==================== */}
        <AccordionSection id="security" title="Seguridad de tu Información" icon={Lock}>
          <div className="space-y-4">
            <p className="leading-relaxed">
              Hacemos <strong>esfuerzos razonables</strong> para proteger tu información mediante
              salvaguardas físicas y electrónicas diseñadas para mejorar la seguridad.
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-dark-surface/20 dark:bg-light-surface/10 rounded-xl p-4">
                <h4 className="font-bold text-cyan-400/90 mb-2">🔐 Medidas de Seguridad</h4>
                <ul className="text-sm space-y-1">
                  <li>• Encriptación de datos en tránsito</li>
                  <li>• Acceso restringido a información personal</li>
                  <li>• Monitoreo de seguridad 24/7</li>
                  <li>• Actualizaciones de seguridad regulares</li>
                </ul>
              </div>

              <div className="bg-dark-surface/20 dark:bg-light-surface/10 rounded-xl p-4">
                <h4 className="font-bold text-cyan-400/90 mb-2">⚠️ Limitaciones</h4>
                <p className="text-sm">
                  Como nuestros servicios se alojan electrónicamente, <strong>no podemos garantizar</strong>
                  seguridad absoluta. Te recomendamos usar contraseñas fuertes y autenticación de dos factores.
                </p>
              </div>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
              <h4 className="font-bold text-yellow-300 mb-2 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Tu Responsabilidad
              </h4>
              <p className="text-sm">
                Recuerda que tus publicaciones son <strong>públicas</strong>. No compartas información
                sensible en publicaciones o con usuarios desconocidos.
              </p>
            </div>
          </div>
        </AccordionSection>

        {/* ==================== RETENCIÓN DE DATOS ==================== */}
        <AccordionSection id="data-retention" title="Retención de Datos" icon={FileText}>
          <div className="space-y-4">
            <p className="leading-relaxed">
              Conservamos tu información personal durante el tiempo que uses BeZhas, o según sea
              necesario para cumplir los fines para los que la recopilamos.
            </p>

            <h4 className="font-bold text-white/90">También podemos conservar información para:</h4>
            <ul className="space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 mt-1">•</span>
                <span>Resolver disputas y establecer defensas legales</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 mt-1">•</span>
                <span>Realizar auditorías y cumplir obligaciones legales</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 mt-1">•</span>
                <span>Aplicar nuestros acuerdos y términos de servicio</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 mt-1">•</span>
                <span>Mantener copias de seguridad y prevenir fraude</span>
              </li>
            </ul>

            <div className="bg-dark-background/30 dark:bg-light-background/30 rounded-xl p-4">
              <p className="text-sm">
                <strong>Nota:</strong> Aunque elimines tu cuenta, algunas copias pueden permanecer
                en nuestros sistemas de backup por un período limitado según lo requiera la ley.
              </p>
            </div>
          </div>
        </AccordionSection>

        {/* ==================== TRANSFERENCIAS INTERNACIONALES ==================== */}
        <AccordionSection id="international" title="Transferencias Internacionales" icon={Globe}>
          <div className="space-y-4">
            <p className="leading-relaxed">
              Podemos transferir, procesar y almacenar tu información personal en <strong>cualquier
                parte del mundo</strong>. Algunos países pueden tener leyes de protección de datos
              diferentes a las de tu ubicación.
            </p>

            <div className="bg-dark-surface/20 dark:bg-light-surface/10 rounded-xl p-4">
              <h4 className="font-bold text-cyan-400/90 mb-2">🛡️ Salvaguardas</h4>
              <p className="text-sm leading-relaxed">
                Para transferencias desde la UE, Suiza o el Reino Unido, utilizamos <strong>Cláusulas
                  Contractuales Estándar</strong> aprobadas por la Comisión Europea para garantizar un
                nivel adecuado de protección.
              </p>
            </div>

            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
              <p className="text-sm">
                Para más información sobre las salvaguardas que utilizamos, contáctanos en{' '}
                <a href="mailto:support@bezhas.app" className="text-cyan-400 hover:text-cyan-300 underline">
                  support@bezhas.app
                </a>
              </p>
            </div>
          </div>
        </AccordionSection>

        {/* ==================== MENORES DE EDAD ==================== */}
        <AccordionSection id="children" title="Información de Menores" icon={AlertCircle}>
          <div className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <h4 className="font-bold text-red-300 mb-2 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Restricción de Edad
              </h4>
              <p className="leading-relaxed">
                Los Servicios de BeZhas <strong>no están dirigidos a niños menores de 13 años</strong>
                (o de otra edad según lo requiera la ley local fuera de los Estados Unidos).
              </p>
            </div>

            <p className="leading-relaxed">
              No recopilamos a sabiendas información personal de niños. Si eres padre o tutor y
              crees que tu hijo ha proporcionado información personal sin tu consentimiento,
              contáctanos inmediatamente en{' '}
              <a href="mailto:support@bezhas.app" className="text-cyan-400 hover:text-cyan-300 underline">
                support@bezhas.app
              </a>
            </p>
          </div>
        </AccordionSection>

        {/* ==================== CONTACTO ==================== */}
        <AccordionSection id="contact" title="Contacto y Soporte" icon={MessageCircle}>
          <div className="space-y-4">
            <p className="leading-relaxed">
              <strong className="text-cyan-400/90">BeZhas Social, PBC</strong> es el controlador
              de la información personal bajo este Aviso de Privacidad.
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-dark-surface/20 dark:bg-light-surface/10 rounded-xl p-4">
                <h4 className="font-bold text-white/90 mb-2">📧 Soporte General</h4>
                <a
                  href="mailto:support@bezhas.app"
                  className="text-cyan-400 hover:text-cyan-300 underline"
                >
                  support@bezhas.app
                </a>
                <p className="text-xs mt-2 text-gray-400">
                  Para consultas sobre privacidad, ejercer tus derechos o reportar problemas
                </p>
              </div>

              <div className="bg-dark-surface/20 dark:bg-light-surface/10 rounded-xl p-4">
                <h4 className="font-bold text-white/90 mb-2">🛡️ Oficial de Protección de Datos</h4>
                <p className="text-sm">
                  Ametros Group Ltd<br />
                  <a
                    href="mailto:dpo@ametrosgroup.com"
                    className="text-cyan-400 hover:text-cyan-300 underline"
                  >
                    dpo@ametrosgroup.com
                  </a>
                </p>
              </div>
            </div>

            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
              <h4 className="font-bold text-cyan-300 mb-2">🌐 Sitios Web</h4>
              <ul className="space-y-1">
                <li>
                  <a href="https://bezhas.app" target="_blank" rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 underline">
                    bezhas.app
                  </a>
                </li>
                <li>
                  <a href="https://bezhas.social" target="_blank" rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 underline">
                    bezhas.social
                  </a>
                </li>
                <li>
                  <a href="https://atproto.com" target="_blank" rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 underline">
                    atproto.com
                  </a> (Protocolo AT)
                </li>
              </ul>
            </div>

            <div className="bg-dark-background/30 dark:bg-light-background/30 rounded-xl p-4">
              <p className="text-sm text-center">
                <strong className="text-white/90">BeZhas es una Corporación de Beneficio Público</strong>
                <br />
                <span className="text-xs text-gray-400">
                  Comprometidos con crear valor social y medioambiental, además de beneficios económicos
                </span>
              </p>
            </div>
          </div>
        </AccordionSection>

      </div>

      {/* Footer */}
      <footer className="text-center mt-12 pb-8">
        <p className="text-cyan-400/50 text-sm">
          Última actualización: 2024 | BeZhas Social, PBC
        </p>
      </footer>

      {/* Animation Styles */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default AboutPage;
