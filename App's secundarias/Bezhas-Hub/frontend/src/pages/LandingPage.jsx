import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSoundEffects } from '../hooks/useSoundEffects';
import { useNavigate, Link } from 'react-router-dom';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { useAccount } from 'wagmi';
import SafeGoogleLogin from '../components/common/SafeGoogleLogin';
import OAuthButtons from '../components/common/OAuthButtons';
import {
    ShieldCheck, Coins, Globe2, BrainCircuit, ArrowRight,
    CheckCircle2, Code2, Terminal, ChevronRight,
    Layers, Vote, Percent, Twitter, Github, Disc,
    Zap, Lock, TrendingUp, Activity, X, Briefcase, User, Building2, Wallet,
    Ship, Anchor, Box, Cpu, Database, Crown, Building, Droplets, LineChart
} from 'lucide-react';
import ConnectWalletModal from '../components/auth/ConnectWalletModal';
import http from '../services/http';

// Components
import CosmosCanvas from '../components/landing/CosmosCanvas';
import LogoScroll from '../components/landing/LogoScroll';
import TokenWidget from '../components/landing/TokenWidget';
import EcosystemAppsSection from '../components/landing/EcosystemAppsSection';
import { STRIPE_PAYMENT_LINKS } from '../config/bezhasPaymentConfig';
import { BEZ_POLYGONSCAN_URL, DEFI_TOKENOMICS_URL } from '../data/landing';

import '../components/landing/Landing.css';

const LandingPage = () => {
    const { playHover, playClick, playBoot } = useSoundEffects();
    useEffect(() => { 
        // Boot sound on initial load for futuristic feel
        try {
            playBoot();
        } catch (error) {
            if (import.meta.env.DEV) {
                console.warn('Landing boot sound could not be played', error);
            }
        }
    }, [playBoot]);

    const navigate = useNavigate();
    const { open } = useWeb3Modal();
    const { isConnected } = useAccount();
    const [scrolled, setScrolled] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [showConnectWalletModal, setShowConnectWalletModal] = useState(false);
    // Modal mode: 'register' | 'login' | 'forgot'
    const [modalMode, setModalMode] = useState('register');
    // 'email' | 'wallet' — used inside login tab
    const [loginMethod, setLoginMethod] = useState('email');
    // 'email' | 'wallet' — used inside register tab
    const [regMethod, setRegMethod] = useState('email');
    const [formData, setFormData] = useState({
        email: '', password: '', confirmPassword: '', username: '',
        accountType: 'individual', companyName: '', industry: 'Technology',
        phone: '', taxId: ''
    });
    const [loginData, setLoginData] = useState({ email: '', password: '' });
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotSuccess, setForgotSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const openModal = (mode = 'register') => {
        setModalMode(mode);
        setError('');
        setSuccessMsg('');
        setForgotSuccess(false);
        setShowAuthModal(true);
    };

    const handleWalletRegister = () => {
        open();
        setShowAuthModal(false);
    };

    const handleEmailRegister = async (e) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }
        if (formData.password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setLoading(true);
        try {
            const response = await http.post('/api/auth/register-email', formData);
            const data = response.data;

            if (data.token) {
                localStorage.setItem('auth', JSON.stringify(data));
                setShowAuthModal(false);
                setShowConnectWalletModal(true);
            } else {
                setError(data.error || 'Error al registrarse');
            }
        } catch (err) {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const handleEmailLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const response = await http.post('/api/auth/login-email', { email: loginData.email, password: loginData.password });
            const data = response.data;

            if (data.token) {
                localStorage.setItem('auth', JSON.stringify({ user: data.user, token: data.token }));
                setShowAuthModal(false);
                // If user has no wallet, suggest linking one
                if (!data.user.walletAddress) {
                    setShowConnectWalletModal(true);
                } else {
                    navigate('/feed');
                }
            } else {
                setError(data.error || 'Credenciales inválidas');
            }
        } catch (err) {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const handleWalletLogin = () => {
        open();
        setShowAuthModal(false);
    };

    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const response = await http.post('/api/auth/forgot-password', { email: forgotEmail });
            const data = response.data;
            if (data.success || response.status === 200) {
                setForgotSuccess(true);
            } else {
                setError(data.error || 'Error al enviar el email');
            }
        } catch (err) {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const handleOAuthSuccess = (data) => {
        localStorage.setItem('auth', JSON.stringify({ user: data.user, token: data.token }));
        setShowAuthModal(false);
        if (!data.user?.walletAddress) {
            setShowConnectWalletModal(true);
        } else {
            navigate('/feed');
        }
    };

    const handleGithubRegister = () => {
        setShowAuthModal(false);
        const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
        const redirectUri = `${window.location.origin}/auth/github/callback`;
        const scope = 'read:user user:email';
        setTimeout(() => {
            window.location.href = `https://github.com/login/oauth/authorize?` +
                `client_id=${clientId}&` +
                `redirect_uri=${encodeURIComponent(redirectUri)}&` +
                `scope=${encodeURIComponent(scope)}`;
        }, 100);
    };

    // Scroll handler effect
    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('active');
                    }
                });
            },
            { threshold: 0.1 }
        );

        document.querySelectorAll('.reveal').forEach((el) => {
            observer.observe(el);
        });

        window.addEventListener('scroll', handleScroll);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            observer.disconnect();
        };
    }, []);

    // Redirigir a home si ya está conectado
    useEffect(() => {
        if (isConnected) {
            navigate('/home');
        }
    }, [isConnected, navigate]);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-white overflow-x-hidden relative selection:bg-purple-500 selection:text-white">
            {/* Universe Background */}
            <CosmosCanvas />

            {/* Fisheye Vignette */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0"
                style={{
                    background: 'radial-gradient(circle at center, transparent 40%, rgba(5, 5, 10, 0.5) 65%, rgba(0, 0, 0, 1) 100%)',
                    backdropFilter: 'blur(2px)',
                    WebkitMaskImage: 'radial-gradient(circle at center, black 45%, transparent 110%)'
                }}
            />

            {/* Navbar */}
            <nav className={`fixed w-full z-40 transition-all duration-300 border-b border-gray-200 dark:border-white/5 ${scrolled ? 'bg-[#010105]/90 shadow-lg' : 'bg-[#010105]/60' } backdrop-blur-md`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
                    <a href="#" className="flex items-center gap-3 group">
                        <div className="relative w-10 h-10 flex items-center justify-center">
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl blur opacity-75 group-hover:opacity-100 transition-opacity" />
                            <div className="relative w-full h-full bg-gray-50/80 dark:bg-black/80 rounded-xl border border-gray-300 dark:border-white/10 flex items-center justify-center font-display font-bold text-xl backdrop-blur-sm">
                                B
                            </div>
                        </div>
                        <span className="font-display text-xl font-bold tracking-tight">BeZhas</span>
                    </a>

                    <div className="hidden md:flex items-center gap-8">
                        <a onMouseEnter={playHover} onClick={playClick} href="#solutions" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-[#22d3ee] transition-colors uppercase tracking-widest hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">La Solución</a>
                        <a onMouseEnter={playHover} onClick={playClick} href="#ecosystem" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-[#22d3ee] transition-colors uppercase tracking-widest hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">Ecosistema</a>
                        <a onMouseEnter={playHover} onClick={playClick} href="#apps" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-[#22d3ee] transition-colors uppercase tracking-widest hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">App's</a>
                        <a onMouseEnter={playHover} onClick={playClick} href="#technology" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-[#22d3ee] transition-colors uppercase tracking-widest hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">BEZ-Coin</a>
                        
                        <div className="flex items-center gap-3">
                            <button
                                onMouseEnter={playHover}
                                onClick={() => { playClick(); openModal('login'); }}
                                className="px-5 py-2.5 bg-white/5 backdrop-blur-md rounded border border-white/10 text-sm font-bold uppercase tracking-widest text-gray-200 hover:bg-white/10 transition-all hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                            >
                                Log In
                            </button>
                            <button
                                onMouseEnter={playHover}
                                onClick={() => { playClick(); openModal('register'); }}
                                className="px-5 py-2.5 bg-white/5 backdrop-blur-md rounded border border-white/10 text-sm font-bold uppercase tracking-widest text-gray-200 hover:bg-white/10 transition-all hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                            >
                                Register
                            </button>
                            <button
                                onMouseEnter={playHover}
                                onClick={(e) => { playClick(); handleWalletLogin(e); }}
                                className="px-6 py-2.5 rounded bg-[#0d33f2] text-white text-sm font-bold uppercase tracking-widest hover:brightness-110 transition-all border border-[#0d33f2]/50 shadow-[0_0_20px_rgba(13,51,242,0.4)] flex items-center gap-2"
                            >
                                <Wallet className="w-4 h-4" />
                                Connect Wallet
                            </button>
                        </div>
                    </div>

                    {/* Mobile Menu Buttons */}
                    <div className="md:hidden flex items-center gap-2">
                        <button
                            onMouseEnter={playHover}
                            onClick={() => { playClick(); openModal('login'); }}
                            className="px-3 py-2 border border-gray-400 dark:border-white/20 rounded-full text-xs font-semibold text-gray-900 dark:text-white"
                        >
                            Entrar
                        </button>
                        <button
                            onMouseEnter={playHover}
                            onClick={() => { playClick(); openModal('register'); }}
                            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-xs font-semibold text-gray-900 dark:text-white"
                        >
                            Registrarse
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative min-h-[90vh] flex items-center justify-center px-6 lg:px-20 overflow-hidden z-10 pt-20">
                <TokenWidget position="hero" />
                <div className="absolute inset-0 z-0 pointer-events-none">
                    <div className="absolute inset-0 bg-[#080911]/60 dark:bg-[#080911]/80 z-10"></div>
                    <div className="absolute inset-0 z-10" style={{ background: 'radial-gradient(circle at top right, rgba(13, 51, 242, 0.15), transparent), radial-gradient(circle at bottom left, rgba(168, 85, 247, 0.1), transparent)' }}></div>
                    <img className="w-full h-full object-cover blur-sm opacity-60 scale-105" alt="Futuristic logistics" src="https://lh3.googleusercontent.com/yvngB3D9G0oJ6K4Yq7hA7WzP82oHn1-7j8I7xZy_R6r99_tJv1tQfE_9d_76t4QZ0B82sWd_Hn_r92RzX_rN-c9bY1cZ2n8wG1r" />
                </div>
                <div className="relative z-20 text-center max-w-5xl mx-auto space-y-8 reveal active">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-[#0d33f2]/30 backdrop-blur-md mb-4 shadow-[0_0_15px_rgba(13,51,242,0.3)]">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22d3ee] opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22d3ee]"></span>
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#22d3ee]">BeZhas Web3 Enterprise Grade</span>
                    </div>
                    
                    <h1 className="font-display text-5xl md:text-8xl font-black leading-[0.9] tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-gray-200 to-gray-500 uppercase italic">
                        BeZhas: The Web3 <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0d33f2] to-[#a855f7] italic py-2">Global Engine</span>
                    </h1>
                    
                    <p className="text-gray-300 text-lg md:text-xl max-w-2xl mx-auto font-light leading-relaxed drop-shadow-md">
                        Revolucionamos las cadenas de suministro globales con inteligencia descentralizada, Oráculos IA en tiempo real y tokenización industrial.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
                        <button 
                            onMouseEnter={playHover} 
                            onClick={(e) => { playClick(); openModal('register'); }} 
                            className="w-full sm:w-auto min-w-[200px] h-14 bg-[#0d33f2] hover:bg-[#0a28bd] text-white font-bold uppercase tracking-widest rounded-lg shadow-[0_0_20px_rgba(13,51,242,0.4)] hover:scale-105 transition-all flex items-center justify-center gap-2 backdrop-blur-sm z-30"
                        >
                            Explorar Ecosistema
                        </button>
                        <a 
                            onMouseEnter={playHover} 
                            onClick={playClick}
                            href="#technology" 
                            className="w-full sm:w-auto min-w-[200px] h-14 bg-white/5 text-white font-bold uppercase tracking-widest rounded-lg border border-white/20 hover:bg-white/10 transition-all flex items-center justify-center backdrop-blur-md z-30"
                        >
                            Leer Whitepaper
                        </a>
                    </div>
                </div>
            </section>

            {/* BEZ-Coin Direct Sale */}
            <section className="py-16 px-6 relative z-10">
                <div className="max-w-7xl mx-auto grid lg:grid-cols-[1.15fr_0.85fr] gap-6 items-stretch">
                    <div className="rounded-3xl border border-cyan-400/20 bg-[#06111d]/90 p-8 md:p-10 shadow-[0_0_45px_rgba(34,211,238,0.10)]">
                        <div className="text-[10px] uppercase tracking-[0.35em] text-cyan-300 font-bold mb-4">Venta directa en Polygon</div>
                        <h2 className="text-3xl md:text-5xl font-black italic uppercase text-white mb-4">Compra BEZ-Coin real</h2>
                        <p className="text-gray-300 max-w-2xl leading-relaxed mb-6">
                            Accede a la venta directa del token BEZ-Coin en Polygon Mainnet. Este flujo usa el contrato verificado actual hasta el despliegue de BEZ-CoinV2.
                        </p>
                        <div className="grid sm:grid-cols-3 gap-3 mb-8">
                            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                                <div className="text-gray-500 text-xs uppercase">Red</div>
                                <div className="text-white font-bold">Polygon</div>
                            </div>
                            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                                <div className="text-gray-500 text-xs uppercase">Símbolo</div>
                                <div className="text-white font-bold">BEZ</div>
                            </div>
                            <a href={BEZ_POLYGONSCAN_URL} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-white/5 border border-white/10 p-4 hover:border-cyan-300/50 transition-colors">
                                <div className="text-gray-500 text-xs uppercase">Contrato</div>
                                <div className="text-cyan-300 font-mono text-sm">0xEcBa...11A8</div>
                            </a>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <a href={STRIPE_PAYMENT_LINKS.tokenPurchase} target="_blank" rel="noopener noreferrer" className="min-h-14 px-6 rounded-xl bg-cyan-300 text-[#06111d] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:brightness-110 transition-all">
                                Comprar BEZ-Coin <ArrowRight size={18} />
                            </a>
                            <a href={DEFI_TOKENOMICS_URL} className="min-h-14 px-6 rounded-xl bg-white/5 text-white border border-white/15 font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white/10 transition-all">
                                Tokenomics en DeFi <LineChart size={18} />
                            </a>
                        </div>
                    </div>
                    <div className="rounded-3xl border border-purple-400/20 bg-[#0d0918]/90 p-8 md:p-10 flex flex-col justify-between">
                        <div>
                            <div className="text-[10px] uppercase tracking-[0.35em] text-purple-300 font-bold mb-4">DeFi & tokenomics</div>
                            <h3 className="text-2xl md:text-3xl font-black text-white uppercase italic mb-4">Gestiona liquidez, staking y farming</h3>
                            <p className="text-gray-400 leading-relaxed">
                                Para análisis tokenómico, staking, farming y tesorería, entra en la plataforma DeFi de BeZhas y opera desde el panel financiero.
                            </p>
                        </div>
                        <a href={DEFI_TOKENOMICS_URL} className="mt-8 min-h-14 px-6 rounded-xl bg-purple-500 text-white font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-purple-400 transition-colors">
                            Ir a DeFi <ChevronRight size={18} />
                        </a>
                    </div>

                    {/* App's Secundarias (SSO Ecosystem) */}
                    <EcosystemAppsSection onHover={playHover} onClick={playClick} />
                </div>
            </section>

            {/* EL DIAGNÓSTICO: Problema vs Solución */}
            <section id="solutions" className="py-20 px-6 relative z-10">
                <div className="max-w-7xl mx-auto reveal">
                    <div className="text-center mb-16">
                        <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">El Salto Evolutivo</h2>
                        <p className="text-gray-600 dark:text-gray-400 text-lg">Deje atrás las ineficiencias del sistema Legacy.</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8 md:gap-0 border border-gray-300 dark:border-white/10 rounded-3xl overflow-hidden backdrop-blur-sm bg-gray-50/40 dark:bg-black/40">
                        {/* Columna Legacy */}
                        <div className="p-8 md:p-12 bg-red-900/5">
                            <h3 className="text-2xl font-bold text-gray-700 dark:text-gray-300 mb-8 flex items-center gap-3">
                                <Activity className="w-6 h-6 text-red-400" />
                                El Problema Actual (Legacy)
                            </h3>
                            <ul className="space-y-8">
                                <li className="flex gap-4 text-gray-600 dark:text-gray-400">
                                    <X className="w-6 h-6 text-red-500 flex-shrink-0" />
                                    <div>
                                        <strong className="block text-gray-800 dark:text-gray-200 text-lg mb-1">Procesos Manuales y Lentos</strong>
                                        <p>Dependencia humana propensa a errores costosos y retrasos administrativos.</p>
                                    </div>
                                </li>
                                <li className="flex gap-4 text-gray-600 dark:text-gray-400">
                                    <X className="w-6 h-6 text-red-500 flex-shrink-0" />
                                    <div>
                                        <strong className="block text-gray-800 dark:text-gray-200 text-lg mb-1">Intermediarios Costosos</strong>
                                        <p>Múltiples capas bancarias que encarecen y retrasan los pagos días enteros.</p>
                                    </div>
                                </li>
                                <li className="flex gap-4 text-gray-600 dark:text-gray-400">
                                    <X className="w-6 h-6 text-red-500 flex-shrink-0" />
                                    <div>
                                        <strong className="block text-gray-800 dark:text-gray-200 text-lg mb-1">Opacidad y Riesgo</strong>
                                        <p>Datos fragmentados difíciles de auditar, aumentando el riesgo de fraude interno y externo.</p>
                                    </div>
                                </li>
                            </ul>
                        </div>

                        {/* Columna BeZhas */}
                        <div className="p-8 md:p-12 bg-blue-900/10 border-t md:border-t-0 md:border-l border-gray-300 dark:border-white/10 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px]"></div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 flex items-center gap-3">
                                <CheckCircle2 className="w-6 h-6 text-blue-400" />
                                La Solución BeZhas (Web3)
                            </h3>
                            <ul className="space-y-8 relative z-10">
                                <li className="flex gap-4 text-blue-100">
                                    <CheckCircle2 className="w-6 h-6 text-blue-400 flex-shrink-0" />
                                    <div>
                                        <strong className="block text-gray-900 dark:text-white text-lg mb-1">Smart Contracts SDK</strong>
                                        <p className="text-blue-200/70">Ejecución automática de acuerdos sin intervención humana, garantizando cumplimiento al 100%.</p>
                                    </div>
                                </li>
                                <li className="flex gap-4 text-blue-100">
                                    <CheckCircle2 className="w-6 h-6 text-blue-400 flex-shrink-0" />
                                    <div>
                                        <strong className="block text-gray-900 dark:text-white text-lg mb-1">Transacciones P2P Instantáneas</strong>
                                        <p className="text-blue-200/70">Pagos globales en segundos usando Blockchain y BEZ-Coin, eliminando fricción bancaria.</p>
                                    </div>
                                </li>
                                <li className="flex gap-4 text-blue-100">
                                    <CheckCircle2 className="w-6 h-6 text-blue-400 flex-shrink-0" />
                                    <div>
                                        <strong className="block text-gray-900 dark:text-white text-lg mb-1">Oracle AI & Ledger Inmutable</strong>
                                        <p className="text-blue-200/70">Trazabilidad total auditada por nuestra IA y registrada permanentemente en la Blockchain.</p>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* Logo Scroll */}
            <LogoScroll />

            {/* 3. PROPUESTA DE VALOR: ROI Comercial */}
            <section id="benefits" className="py-20 px-6 max-w-7xl mx-auto relative z-10 text-center">
                <h2 className="font-display text-3xl font-bold mb-16 reveal">Resultados de Negocio Inmediatos</h2>
                <div className="grid md:grid-cols-4 gap-6 reveal">
                    {[
                        {
                            icon: <Zap className="w-10 h-10 text-yellow-400" />,
                            title: "Velocidad Operativa",
                            desc: "Reduzca el tiempo de liquidación de días a segundos. El flujo de caja de su empresa nunca se detiene."
                        },
                        {
                            icon: <ShieldCheck className="w-10 h-10 text-green-400" />,
                            title: "Seguridad Institucional",
                            desc: "Protección criptográfica avanzada. Elimine puntos únicos de fallo y hacks tradicionales."
                        },
                        {
                            icon: <TrendingUp className="w-10 h-10 text-blue-400" />,
                            title: "Reducción de Costes",
                            desc: "Ahorre hasta un 40% en operativos eliminando intermediarios y automatizando con nuestra SDK."
                        },
                        {
                            icon: <Globe2 className="w-10 h-10 text-purple-400" />,
                            title: "Escalabilidad Global",
                            desc: "Acceda a mercados internacionales sin barreras. Su empresa, operando sin fronteras."
                        }
                    ].map((item, i) => (
                        <div key={i} className="glass-card p-6 rounded-2xl hover:bg-white/5 transition-all group text-left border border-gray-200 dark:border-white/5">
                            <div className="mb-4 group-hover:scale-110 transition-transform duration-300 bg-gray-100 dark:bg-white/5 w-16 h-16 rounded-xl flex items-center justify-center border border-gray-300 dark:border-white/10">
                                {item.icon}
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">{item.title}</h3>
                            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* 4. ECOSISTEMA BEZHAS: Productos */}
            <section id="ecosystem" className="py-24 px-6 relative z-10 overflow-hidden bg-[#080911]/80 backdrop-blur-lg border-y border-white/5">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6 reveal">
                        <div className="space-y-4">
                            <span className="text-[#0d33f2] font-bold uppercase tracking-widest text-xs">Protocolo Core</span>
                            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight italic uppercase">The Chain-Flow Ecosystem</h2>
                        </div>
                        <p className="text-gray-400 max-w-md text-sm leading-relaxed">
                            Un protocolo multidimensional interactivo que conecta el mundo físico con sistemas de verificación inteligente. Diseñado para alta frecuencia comercial en logística global.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 relative py-10 reveal">
                        {/* Connecting animated glowing lines (desktop only) */}
                        <div className="hidden lg:block absolute inset-0 pointer-events-none z-0">
                            <div className="absolute top-1/2 left-[20%] w-[15%] h-[2px] bg-gray-800">
                                <div className="pulse-dot" style={{ animationDelay: '0s' }}></div>
                            </div>
                            <div className="absolute top-1/2 left-[45%] w-[15%] h-[2px] bg-gray-800">
                                <div className="pulse-dot" style={{ animationDelay: '1s' }}></div>
                            </div>
                            <div className="absolute top-1/2 left-[70%] w-[15%] h-[2px] bg-gray-800">
                                <div className="pulse-dot" style={{ animationDelay: '2s' }}></div>
                            </div>
                        </div>

                        {/* Node 1: Logistics */}
                        <motion.div whileHover={{ scale: 1.05, rotateY: 5, rotateX: -5 }} transition={{ type: "spring", stiffness: 300 }} className="z-10">
                            <Link to="/logistics" onMouseEnter={playHover} onClick={playClick} className="group bg-white/5 backdrop-blur-md p-8 rounded-xl border border-gray-800 hover:border-[#22d3ee]/80 transition-all relative overflow-hidden flex flex-col items-start h-full hover:shadow-[0_0_30px_rgba(34,211,238,0.2)]">
                                <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#22d3ee]/10 rounded-full blur-2xl group-hover:bg-[#22d3ee]/30 transition-all"></div>
                                <Ship className="w-10 h-10 text-[#22d3ee] mb-6 block group-hover:scale-110 transition-transform" />
                                <h3 className="text-xl font-bold text-white mb-3 uppercase italic">Logistics</h3>
                                <p className="text-gray-400 text-sm leading-relaxed flex-grow">Rastreo automatizado de fletes corporativos usando Smart Contracts. Despachos y liberaciones de aduana con cero latencia.</p>
                                <div className="mt-8 flex items-center gap-2 text-[#22d3ee] text-xs font-bold uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                                    Learn More <ArrowRight className="w-4 h-4" />
                                </div>
                            </Link>
                        </motion.div>

                        {/* Node 2: AI Oracle */}
                        <motion.div whileHover={{ scale: 1.05, rotateY: 5, rotateX: -5 }} transition={{ type: "spring", stiffness: 300 }} className="z-10">
                            <Link to="/oracle" onMouseEnter={playHover} onClick={playClick} className="group bg-white/5 backdrop-blur-md p-8 rounded-xl border border-gray-800 hover:border-[#a855f7]/80 transition-all relative overflow-hidden flex flex-col items-start h-full hover:shadow-[0_0_30px_rgba(168,85,247,0.2)]">
                                <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#a855f7]/10 rounded-full blur-2xl group-hover:bg-[#a855f7]/30 transition-all"></div>
                                <BrainCircuit className="w-10 h-10 text-[#a855f7] mb-6 block group-hover:scale-110 transition-transform" />
                                <h3 className="text-xl font-bold text-white mb-3 uppercase italic">AI Oracle</h3>
                                <p className="text-gray-400 text-sm leading-relaxed flex-grow">Motores de validación de datos en tiempo real impulsados por IA (IoT, clima, peso), disparando contratos infalibles.</p>
                                <div className="mt-8 flex items-center gap-2 text-[#a855f7] text-xs font-bold uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                                    View Nodes <ArrowRight className="w-4 h-4" />
                                </div>
                            </Link>
                        </motion.div>

                        {/* Node 3: Real Estate (RWA) */}
                        <motion.div whileHover={{ scale: 1.05, rotateY: 5, rotateX: -5 }} transition={{ type: "spring", stiffness: 300 }} className="z-10">
                            <Link to="/real-estate" onMouseEnter={playHover} onClick={playClick} className="group bg-white/5 backdrop-blur-md p-8 rounded-xl border border-gray-800 hover:border-[#f472b6]/80 transition-all relative overflow-hidden flex flex-col items-start h-full hover:shadow-[0_0_30px_rgba(244,114,182,0.2)]">
                                <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#f472b6]/10 rounded-full blur-2xl group-hover:bg-[#f472b6]/30 transition-all"></div>
                                <Building2 className="w-10 h-10 text-[#f472b6] mb-6 block group-hover:scale-110 transition-transform" />
                                <h3 className="text-xl font-bold text-white mb-3 uppercase italic">Real Estate RWA</h3>
                                <p className="text-gray-400 text-sm leading-relaxed flex-grow">Hubs industriales y almacenes físicos fraccionados. Flujos de capital inyectados a nivel inmobiliario corporativo.</p>
                                <div className="mt-8 flex items-center gap-2 text-[#f472b6] text-xs font-bold uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                                    Invest Portfolio <ArrowRight className="w-4 h-4" />
                                </div>
                            </Link>
                        </motion.div>

                        {/* Node 4: DAO  */}
                        <motion.div whileHover={{ scale: 1.05, rotateY: 5, rotateX: -5 }} transition={{ type: "spring", stiffness: 300 }} className="z-10">
                            <Link to="/dao-page" onMouseEnter={playHover} onClick={playClick} className="group bg-white/5 backdrop-blur-md p-8 rounded-xl border border-gray-800 hover:border-gray-400/80 transition-all relative overflow-hidden flex flex-col items-start h-full hover:shadow-[0_0_30px_rgba(156,163,175,0.2)]">
                                <div className="absolute -right-4 -top-4 w-24 h-24 bg-gray-500/10 rounded-full blur-2xl group-hover:bg-gray-500/30 transition-all"></div>
                                <Vote className="w-10 h-10 text-gray-200 mb-6 block group-hover:scale-110 transition-transform" />
                                <h3 className="text-xl font-bold text-white mb-3 uppercase italic">Gobernanza DAO</h3>
                                <p className="text-gray-400 text-sm leading-relaxed flex-grow">Decisiones hiper-descentralizadas para corporaciones y accionistas, optimizando dinámicamente rutas comerciales globales.</p>
                                <div className="mt-8 flex items-center gap-2 text-gray-200 text-xs font-bold uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                                    Vote System <ArrowRight className="w-4 h-4" />
                                </div>
                            </Link>
                        </motion.div>
                    </div>

                    {/* Secondary Row connected */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 reveal">
                        <Link to="/developer-console" onMouseEnter={playHover} onClick={playClick} className="group bg-white/5 backdrop-blur-md p-6 rounded-xl border border-gray-800 hover:border-[#0d33f2]/60 transition-all overflow-hidden relative">
                            <Terminal className="w-8 h-8 text-[#0d33f2] mb-4 group-hover:scale-110 transition-transform" />
                            <h4 className="text-lg font-bold text-white mb-2 uppercase italic">Dev Console / SDK</h4>
                            <p className="text-gray-400 text-xs">Conecte su SAP o ERP actual al flujo del ecosistema en minutos.</p>
                        </Link>
                        <Link to="/liquidity" onMouseEnter={playHover} onClick={playClick} className="group bg-white/5 backdrop-blur-md p-6 rounded-xl border border-gray-800 hover:border-yellow-400/60 transition-all overflow-hidden relative">
                            <Droplets className="w-8 h-8 text-yellow-400 mb-4 group-hover:scale-110 transition-transform" />
                            <h4 className="text-lg font-bold text-white mb-2 uppercase italic">Liquidity Pools</h4>
                            <p className="text-gray-400 text-xs">Genere rendimientos optimizados con tesorería inactiva (Yield Farm).</p>
                        </Link>
                        <Link to="/be-vip" onMouseEnter={playHover} onClick={playClick} className="group bg-gradient-to-r from-amber-500/10 to-transparent backdrop-blur-md p-6 rounded-xl border border-amber-500/20 hover:border-amber-400/60 transition-all overflow-hidden relative">
                            <Crown className="w-8 h-8 text-amber-500 mb-4 group-hover:scale-110 transition-transform" />
                            <h4 className="text-lg font-bold text-white mb-2 uppercase italic">Be-VIP Corporate</h4>
                            <p className="text-gray-400 text-xs">Sin comisiones, networking elite y soporte ingenieril 24/7 de alta prioridad.</p>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Video Holographic Section */}
            <section className="py-24 px-6 lg:px-20 bg-[#080911]/90 relative z-10 border-y border-white/5">
                <div className="max-w-7xl mx-auto reveal">
                    <div className="text-center mb-16 space-y-4">
                        <span className="text-[#f472b6] font-bold uppercase tracking-widest text-xs">Visión Profunda</span>
                        <h2 className="text-4xl md:text-6xl font-black text-white leading-tight uppercase italic">The Holographic Concept</h2>
                        <p className="text-gray-400 text-lg">Inteligencia Artificial y Smart Contracts auditando el mundo físico.</p>
                    </div>
                    
                    <div className="relative max-w-5xl mx-auto" onMouseEnter={playHover} onClick={playClick}>
                        <div className="holographic-border rounded-2xl p-[2px] overflow-hidden shadow-[0_0_30px_rgba(13,51,242,0.15)] hover:shadow-[0_0_50px_rgba(168,85,247,0.3)] transition-shadow duration-500">
                            <div className="relative bg-[#080911] rounded-2xl overflow-hidden aspect-video group cursor-pointer border border-[#22d3ee]/20">
                                {/* AI Generative Visualizers Left */}
                                <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-center items-center gap-1 opacity-20 group-hover:opacity-60 transition-opacity py-10 pointer-events-none z-20">
                                    <div className="visualizer-bar" style={{ height: '15%' }}></div>
                                    <div className="visualizer-bar" style={{ height: '35%' }}></div>
                                    <div className="visualizer-bar" style={{ height: '65%' }}></div>
                                    <div className="visualizer-bar" style={{ height: '45%' }}></div>
                                    <div className="visualizer-bar" style={{ height: '85%' }}></div>
                                    <div className="visualizer-bar" style={{ height: '55%' }}></div>
                                    <div className="visualizer-bar" style={{ height: '25%' }}></div>
                                </div>

                                {/* AI Generative Visualizers Right */}
                                <div className="absolute right-0 top-0 bottom-0 w-8 flex flex-col justify-center items-center gap-1 opacity-20 group-hover:opacity-60 transition-opacity py-10 pointer-events-none z-20">
                                    <div className="visualizer-bar" style={{ height: '25%' }}></div>
                                    <div className="visualizer-bar" style={{ height: '55%' }}></div>
                                    <div className="visualizer-bar" style={{ height: '85%' }}></div>
                                    <div className="visualizer-bar" style={{ height: '45%' }}></div>
                                    <div className="visualizer-bar" style={{ height: '65%' }}></div>
                                    <div className="visualizer-bar" style={{ height: '35%' }}></div>
                                    <div className="visualizer-bar" style={{ height: '15%' }}></div>
                                </div>

                                <motion.div whileHover={{ scale: 1.02 }} transition={{ duration: 0.5 }} className="w-full h-full relative z-10">
                                    <iframe
                                        className="w-full h-full grayscale opacity-80 mix-blend-screen group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700"
                                        src="https://www.youtube.com/embed/L8H2AapjtVc" 
                                        title="BeZhas Protocol Insight"
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    ></iframe>
                                </motion.div>

                                <div className="absolute top-6 right-10 flex items-center gap-4 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                    <div className="flex flex-col items-end backdrop-blur-md bg-black/40 p-2 rounded border border-[#22d3ee]/20">
                                        <span className="text-[10px] font-mono text-[#22d3ee] uppercase">Decoding feed...</span>
                                        <span className="text-[10px] font-mono text-gray-400">Oracle: 0x8A...f32</span>
                                    </div>
                                    <Activity className="w-6 h-6 text-[#22d3ee] animate-pulse drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 flex justify-between items-center px-4">
                            <div className="flex gap-2">
                                <span className="w-1.5 h-1.5 bg-[#22d3ee] rounded-full shadow-[0_0_5px_#22d3ee]"></span>
                                <span className="w-1.5 h-1.5 bg-[#22d3ee] rounded-full opacity-50"></span>
                                <span className="w-1.5 h-1.5 bg-[#22d3ee] rounded-full opacity-25"></span>
                            </div>
                            <span className="text-[10px] font-bold text-[#a855f7] uppercase tracking-[0.2em]">Protocol Matrix v2.0 Live</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* 5. TECNOLOGÍA & TOKEN: El Motor */}
            <section id="technology" className="py-24 px-6 max-w-7xl mx-auto relative z-10">
                <div className="bg-gradient-to-br from-[#0f0f16] to-[#1a1a24] rounded-3xl p-8 md:p-16 border border-purple-500/20 shadow-2xl reveal">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div>
                            <h2 className="font-display text-3xl md:text-4xl font-bold mb-6">
                                Potenciado por <span className="text-purple-400">BEZ-Coin</span> & SDK
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 mb-8 text-lg">
                                No es solo un token, es el combustible de su nueva infraestructura eficiente y el activo de mayor valor para impulsar su competitividad.
                            </p>
                            <ul className="space-y-6 mb-8">
                                <li className="flex items-start gap-4">
                                    <div className="mt-1 w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-xs text-gray-900 dark:text-white font-bold flex-shrink-0"><LineChart className="w-3 h-3"/></div>
                                    <div>
                                        <strong className="block text-gray-900 dark:text-white mb-1 text-lg">Múltiples Beneficios al Acumular BEZ-Coin</strong>
                                        <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">Mantener reservas de BEZ-Coin recompensa a su corporación con <strong className="text-purple-300">poder decisivo en la gobernanza (DAO)</strong>, <strong className="text-purple-300">prioridad transaccional</strong> e inmensa <strong className="text-purple-300">reducción en costos de transacciones (hasta un 90%)</strong> en toda su operación logística y financiera. Es la clave para el staking institucional y el acceso temprano a rondas RWA.</p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-4">
                                    <div className="mt-1 w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-xs text-gray-900 dark:text-white font-bold flex-shrink-0"><Terminal className="w-3 h-3"/></div>
                                    <div>
                                        <strong className="block text-gray-900 dark:text-white mb-1 text-lg">Integración Perfecta con Enterprise SDK</strong>
                                        <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">Incorpore la Blockchain a su rutina. A través de nuestra Develop Console podrá integrar sus ERP actuales, facilitando y unificando el control del almacenes, despachos portuarios, envíos, y cuentas por pagar sin fricción burocrática ni retrasos humanos.</p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-4">
                                    <div className="mt-1 w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-xs text-gray-900 dark:text-white font-bold flex-shrink-0"><BrainCircuit className="w-3 h-3"/></div>
                                    <div>
                                        <strong className="block text-gray-900 dark:text-white mb-1 text-lg">Orquestación de Pagos con IA Oracle Resolver</strong>
                                        <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">Nuestra Inteligencia Artificial arbitra validaciones en milisegundos. Cuando los sensores IoT en los buques o aduanas cambian su estado, nuestra IA emite un comando verificado e inmutable, disparando transferencias P2P de forma 100% garantizada.</p>
                                    </div>
                                </li>
                            </ul>
                            <a
                                href="https://docs.google.com/document/d/1hoy541vyrkgYHAzjcUsXX67ssgbt2SqP1L88yuzPXnM/edit?usp=sharing"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-2 transition-colors"
                            >
                                Leer Whitepaper Económico <ArrowRight className="w-4 h-4" />
                            </a>
                        </div>
                        <div className="relative">
                            <div className="absolute inset-0 bg-purple-600/20 blur-[60px] rounded-full"></div>
                            {/* Representación visual abstracta del token/sistema */}
                            <div className="relative bg-gray-50/60 dark:bg-black/60 backdrop-blur-xl border border-gray-300 dark:border-white/10 rounded-2xl p-8 transform rotate-2 hover:rotate-0 transition-transform duration-500 shadow-xl">
                                <div className="flex justify-between items-center mb-8">
                                    <span className="text-gray-600 dark:text-gray-400 text-sm font-mono">System Status</span>
                                    <span className="text-green-400 text-xs px-2 py-1 bg-green-900/30 rounded border border-green-500/30 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                        Operational
                                    </span>
                                </div>
                                <div className="space-y-4 font-mono text-sm">
                                    <div className="flex justify-between border-b border-gray-200 dark:border-white/5 pb-2">
                                        <span className="text-purple-300">Oracle AI Logic</span>
                                        <span className="text-gray-900 dark:text-white">Processing...</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-200 dark:border-white/5 pb-2">
                                        <span className="text-purple-300">Smart Contract</span>
                                        <span className="text-gray-900 dark:text-white">Executed (0.02s)</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-200 dark:border-white/5 pb-2">
                                        <span className="text-purple-300">Settlement</span>
                                        <span className="text-yellow-400">1,500 BEZ</span>
                                    </div>
                                    <div className="mt-4 p-4 bg-purple-900/10 rounded-lg border border-purple-500/20 text-purple-200 text-xs leading-relaxed">
                                        &gt; Transaction verified on-chain. <br />
                                        &gt; Assets transferred instantly. <br />
                                        &gt; SDK Callback received.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* FINAL CTA */}
            <section className="py-20 text-center px-6 relative z-10 mb-20">
                <h2 className="font-display text-4xl md:text-5xl font-bold mb-8 reveal">¿Listo para optimizar su futuro?</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-10 max-w-2xl mx-auto text-lg reveal">
                    Únase a las empresas pioneras que ya están escalando con la infraestructura descentralizada de BeZhas.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center reveal">
                    <button onClick={() => openModal('register')} className="px-10 py-4 bg-white text-black hover:bg-gray-200 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2">
                        Comenzar Ahora
                    </button>
                    <a
                        href="https://calendar.app.google/Bff4eQn6SukB9jMx9"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-10 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-gray-900 dark:text-white hover:from-purple-700 hover:to-pink-700 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2"
                    >
                        📅 Agendar Cita
                    </a>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 justify-center mt-4 reveal">
                    <a
                        href="https://t.me/+34661175645"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-8 py-3 bg-[#0088cc] hover:bg-[#0077b5] text-gray-900 dark:text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
                        Telegram
                    </a>
                    <a
                        href="mailto:info.bezcoin@bez.digital"
                        className="px-8 py-3 bg-transparent border border-gray-400 dark:border-white/20 text-gray-900 dark:text-white hover:bg-white/5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                    >
                        ✉️ info.bezcoin@bez.digital
                    </a>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-gray-200 dark:border-white/5 bg-gray-100/90 dark:bg-[#020203]/90 pt-16 pb-8 relative z-10 backdrop-blur-lg">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <div className="grid md:grid-cols-4 gap-12 mb-12">
                        <div className="col-span-1 md:col-span-2">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center text-gray-900 dark:text-white font-bold text-sm">
                                    B
                                </div>
                                <span className="text-xl font-display font-bold">BeZhas</span>
                            </div>
                            <p className="text-gray-500 dark:text-gray-500 text-sm max-w-sm mb-6">
                                Construyendo la capa de confianza para el comercio global descentralizado.
                            </p>
                            <div className="flex gap-4">
                                <a href="https://twitter.com/bezhas" target="_blank" rel="noopener noreferrer" className="text-gray-600 dark:text-gray-400 hover:text-white transition-colors">
                                    <Twitter className="w-5 h-5" />
                                </a>
                                <a href="https://github.com/bezhas" target="_blank" rel="noopener noreferrer" className="text-gray-600 dark:text-gray-400 hover:text-white transition-colors">
                                    <Github className="w-5 h-5" />
                                </a>
                                <a href="https://discord.gg/bezhas" target="_blank" rel="noopener noreferrer" className="text-gray-600 dark:text-gray-400 hover:text-white transition-colors">
                                    <Disc className="w-5 h-5" />
                                </a>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900 dark:text-white mb-4 text-sm uppercase tracking-wider">Ecosistema</h4>
                            <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-500">
                                <li>
                                    <Link to="/marketplace" className="hover:text-purple-400 transition-colors">Marketplace</Link>
                                </li>
                                <li>
                                    <Link to="/logistics" className="hover:text-purple-400 transition-colors">Bridge</Link>
                                </li>
                                <li>
                                    <Link to="/explorer" className="hover:text-purple-400 transition-colors">Explorer</Link>
                                </li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900 dark:text-white mb-4 text-sm uppercase tracking-wider">Legal</h4>
                            <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-500">
                                <li>
                                    <Link to="/privacy" className="hover:text-purple-400 transition-colors">Privacy</Link>
                                </li>
                                <li>
                                    <Link to="/terms" className="hover:text-purple-400 transition-colors">Terms</Link>
                                </li>
                                <li>
                                    <Link to="/audits" className="hover:text-purple-400 transition-colors">Audits</Link>
                                </li>
                            </ul>
                        </div>
                    </div>
                    <div className="border-t border-gray-200 dark:border-white/5 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-gray-600">
                        <p>© 2026 BeZhas Enterprise. Decentralized & Open Source.</p>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span>Systems Operational</span>
                        </div>
                    </div>
                </div>
            </footer>

            {/* Auth Modal — Register / Login / Forgot Password */}
            {showAuthModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-50/80 dark:bg-black/80 backdrop-blur-sm animate-fadeIn">
                    <div className="relative bg-white dark:bg-[#0f0f16] border border-gray-300 dark:border-white/10 rounded-2xl max-w-md w-full shadow-2xl animate-slideUp overflow-hidden">

                        {/* Close Button */}
                        <button
                            onClick={() => setShowAuthModal(false)}
                            className="absolute top-4 right-4 text-gray-600 dark:text-gray-400 hover:text-white transition-colors z-10"
                        >
                            <X className="w-6 h-6" />
                        </button>

                        {/* Top Mode Tabs */}
                        <div className="flex border-b border-gray-300 dark:border-white/10">
                            {[['register', 'Registrarse'], ['login', 'Iniciar Sesión'], ['forgot', '¿Olvidaste tu contraseña?']].map(([mode, label]) => (
                                <button
                                    key={mode}
                                    onClick={() => { setModalMode(mode); setError(''); setSuccessMsg(''); setForgotSuccess(false); }}
                                    className={`flex-1 py-4 text-xs font-semibold transition-colors relative whitespace-nowrap px-2 ${modalMode === mode ? 'text-white' : 'text-gray-500 hover:text-gray-300' }`}
                                >
                                    {label}
                                    {modalMode === mode && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-t-full" />}
                                </button>
                            ))}
                        </div>

                        <div className="p-8">
                            {/* ───────── REGISTER TAB ───────── */}
                            {modalMode === 'register' && (
                                <div className="animate-fadeIn">
                                    {/* Register sub-tabs: email / wallet */}
                                    <div className="flex mb-5 gap-2">
                                        <button
                                            onClick={() => setRegMethod('email')}
                                            className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${regMethod === 'email' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-white/5 border-gray-300 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-white/10' }`}
                                        >
                                            Email / Empresa
                                        </button>
                                        <button
                                            onClick={() => setRegMethod('wallet')}
                                            className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${regMethod === 'wallet' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-white/5 border-gray-300 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-white/10' }`}
                                        >
                                            <Wallet className="inline w-3 h-3 mr-1" />Web3 Wallet
                                        </button>
                                    </div>

                                    {regMethod === 'wallet' ? (
                                        <div className="space-y-4">
                                            <div className="text-center mb-4">
                                                <div className="inline-flex items-center justify-center w-14 h-14 bg-purple-500/20 rounded-full mb-3 text-purple-400">
                                                    <Wallet className="w-7 h-7" />
                                                </div>
                                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Conectar Billetera</h3>
                                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Acceso instantáneo sin contraseñas.</p>
                                            </div>
                                            <button
                                                onClick={handleWalletRegister}
                                                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl font-semibold text-gray-900 dark:text-white transition-all hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.5)] group"
                                            >
                                                <ShieldCheck className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                                Conectar MetaMask / Rabby
                                            </button>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleEmailRegister} className="space-y-3">
                                            {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">{error}</div>}

                                            {/* Account type selector */}
                                            <div>
                                                <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Tipo de Cuenta</label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {['individual', 'freelancer', 'company'].map(type => (
                                                        <button
                                                            key={type} type="button"
                                                            onClick={() => setFormData({ ...formData, accountType: type })}
                                                            className={`py-2 rounded-lg text-xs font-medium border transition-all ${formData.accountType === type ? 'bg-purple-600 border-purple-500 text-white' : 'bg-white/5 border-gray-300 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-white/10' }`}
                                                        >
                                                            {type === 'individual' ? 'Personal' : type === 'freelancer' ? 'Autónomo' : 'Empresa'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {formData.accountType !== 'individual' && (
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="col-span-2">
                                                        <input type="text"
                                                            placeholder={formData.accountType === 'company' ? 'Nombre de la Empresa' : 'Nombre Comercial'}
                                                            className="w-full bg-gray-100 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg px-4 py-3 text-sm text-gray-900 dark:text-white focus:border-purple-500 focus:outline-none"
                                                            value={formData.companyName}
                                                            onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                                                            required
                                                        />
                                                    </div>
                                                    <select
                                                        className="w-full bg-gray-100 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg px-4 py-3 text-sm text-gray-900 dark:text-white focus:border-purple-500 focus:outline-none"
                                                        value={formData.industry}
                                                        onChange={e => setFormData({ ...formData, industry: e.target.value })}
                                                    >
                                                        {['Logistics', 'Retail', 'Real Estate', 'Finance', 'Technology', 'Other'].map(i => (
                                                            <option key={i} value={i} className="bg-gray-50 dark:bg-black">{i}</option>
                                                        ))}
                                                    </select>
                                                    <input type="text" placeholder="Tax ID / CIF"
                                                        className="w-full bg-gray-100 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg px-4 py-3 text-sm text-gray-900 dark:text-white focus:border-purple-500 focus:outline-none"
                                                        value={formData.taxId}
                                                        onChange={e => setFormData({ ...formData, taxId: e.target.value })}
                                                    />
                                                </div>
                                            )}

                                            <input type="email" placeholder="Correo Electrónico"
                                                className="w-full bg-gray-100 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg px-4 py-3 text-sm text-gray-900 dark:text-white focus:border-purple-500 focus:outline-none"
                                                value={formData.email}
                                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                required
                                            />
                                            <input type="password" placeholder="Contraseña (mín. 6 caracteres)"
                                                className="w-full bg-gray-100 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg px-4 py-3 text-sm text-gray-900 dark:text-white focus:border-purple-500 focus:outline-none"
                                                value={formData.password}
                                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                                required
                                            />
                                            <input type="password" placeholder="Confirmar Contraseña"
                                                className={`w-full bg-gray-100 dark:bg-white/5 border rounded-lg px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none transition-colors ${formData.confirmPassword && formData.confirmPassword !== formData.password ? 'border-red-500/60' : formData.confirmPassword && formData.confirmPassword === formData.password ? 'border-green-500/60' : 'border-white/10 focus:border-purple-500' }`}
                                                value={formData.confirmPassword}
                                                onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                                                required
                                            />
                                            {formData.confirmPassword && formData.confirmPassword !== formData.password && (
                                                <p className="text-red-400 text-xs -mt-1">Las contraseñas no coinciden</p>
                                            )}

                                            <button type="submit" disabled={loading}
                                                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-gray-900 dark:text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                                            >
                                                {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
                                            </button>

                                            <div className="relative py-2">
                                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300 dark:border-white/10"></div></div>
                                                <div className="relative flex justify-center text-xs"><span className="bg-white dark:bg-[#0f0f16] px-2 text-gray-500 dark:text-gray-500">o continúa con</span></div>
                                            </div>
                                            <OAuthButtons
                                                mode="register"
                                                onSuccess={handleOAuthSuccess}
                                                onError={(msg) => setError(msg || 'Error en OAuth')}
                                            />

                                            <p className="text-xs text-gray-500 dark:text-gray-500 text-center">
                                                ¿Ya tienes cuenta?{' '}
                                                <button type="button" onClick={() => { setModalMode('login'); setError(''); }} className="text-purple-400 hover:text-purple-300 font-medium">Iniciar Sesión</button>
                                            </p>
                                        </form>
                                    )}
                                </div>
                            )}

                            {/* ───────── LOGIN TAB ───────── */}
                            {modalMode === 'login' && (
                                <div className="animate-fadeIn">
                                    {/* Login sub-tabs: email / wallet */}
                                    <div className="flex mb-5 gap-2">
                                        <button
                                            onClick={() => { setLoginMethod('email'); setError(''); }}
                                            className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${loginMethod === 'email' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-white/5 border-gray-300 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-white/10' }`}
                                        >
                                            Email / Contraseña
                                        </button>
                                        <button
                                            onClick={() => { setLoginMethod('wallet'); setError(''); }}
                                            className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${loginMethod === 'wallet' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-white/5 border-gray-300 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-white/10' }`}
                                        >
                                            <Wallet className="inline w-3 h-3 mr-1" />Wallet
                                        </button>
                                    </div>

                                    {loginMethod === 'wallet' ? (
                                        <div className="space-y-4">
                                            <div className="text-center py-4">
                                                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-full mb-4 border border-purple-500/30">
                                                    <Wallet className="w-8 h-8 text-purple-400" />
                                                </div>
                                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Iniciar con Wallet</h3>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">Conecta tu wallet para acceder instantáneamente.</p>
                                            </div>
                                            <button
                                                onClick={handleWalletLogin}
                                                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl font-semibold text-gray-900 dark:text-white transition-all group"
                                            >
                                                <ShieldCheck className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                                Conectar MetaMask / Rabby
                                            </button>
                                            <p className="text-center text-xs text-gray-500 dark:text-gray-500">Firmará un mensaje gratuito para verificar su identidad.</p>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleEmailLogin} className="space-y-4">
                                            {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">{error}</div>}

                                            <input type="email" placeholder="Correo Electrónico"
                                                className="w-full bg-gray-100 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg px-4 py-3 text-sm text-gray-900 dark:text-white focus:border-purple-500 focus:outline-none"
                                                value={loginData.email}
                                                onChange={e => setLoginData({ ...loginData, email: e.target.value })}
                                                required autoFocus
                                            />
                                            <input type="password" placeholder="Contraseña"
                                                className="w-full bg-gray-100 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg px-4 py-3 text-sm text-gray-900 dark:text-white focus:border-purple-500 focus:outline-none"
                                                value={loginData.password}
                                                onChange={e => setLoginData({ ...loginData, password: e.target.value })}
                                                required
                                            />

                                            <div className="flex justify-end">
                                                <button type="button"
                                                    onClick={() => { setModalMode('forgot'); setError(''); setForgotSuccess(false); }}
                                                    className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                                                >
                                                    ¿Olvidaste tu contraseña?
                                                </button>
                                            </div>

                                            <button type="submit" disabled={loading}
                                                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-gray-900 dark:text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                                            >
                                                {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                                            </button>

                                            <div className="relative py-2 mt-1">
                                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300 dark:border-white/10"></div></div>
                                                <div className="relative flex justify-center text-xs"><span className="bg-white dark:bg-[#0f0f16] px-2 text-gray-500 dark:text-gray-500">o inicia con</span></div>
                                            </div>
                                            <OAuthButtons
                                                mode="login"
                                                onSuccess={handleOAuthSuccess}
                                                onError={(msg) => setError(msg || 'Error en OAuth')}
                                            />

                                            <p className="text-xs text-gray-500 dark:text-gray-500 text-center">
                                                ¿No tienes cuenta?{' '}
                                                <button type="button" onClick={() => { setModalMode('register'); setError(''); }} className="text-purple-400 hover:text-purple-300 font-medium">Registrarse</button>
                                            </p>
                                        </form>
                                    )}
                                </div>
                            )}

                            {/* ───────── FORGOT PASSWORD TAB ───────── */}
                            {modalMode === 'forgot' && (
                                <div className="animate-fadeIn">
                                    {forgotSuccess ? (
                                        <div className="text-center py-6 space-y-4">
                                            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full border border-green-500/30">
                                                <CheckCircle2 className="w-8 h-8 text-green-400" />
                                            </div>
                                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">¡Email enviado!</h3>
                                            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                                                Si ese email existe en nuestro sistema, recibirás un enlace para restablecer tu contraseña en los próximos minutos.
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-500">Recuerda revisar también tu carpeta de spam.</p>
                                            <button
                                                onClick={() => { setModalMode('login'); setForgotSuccess(false); setForgotEmail(''); }}
                                                className="text-purple-400 hover:text-purple-300 text-sm font-medium"
                                            >
                                                ← Volver a Iniciar Sesión
                                            </button>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleForgotPassword} className="space-y-4">
                                            <div className="text-center mb-4">
                                                <div className="inline-flex items-center justify-center w-14 h-14 bg-purple-500/20 rounded-full mb-3">
                                                    <Lock className="w-7 h-7 text-purple-400" />
                                                </div>
                                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recuperar Contraseña</h3>
                                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Introduce tu email y te enviaremos un enlace de recuperación.</p>
                                            </div>

                                            {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">{error}</div>}

                                            <input type="email" placeholder="Tu correo electrónico"
                                                className="w-full bg-gray-100 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg px-4 py-3 text-sm text-gray-900 dark:text-white focus:border-purple-500 focus:outline-none"
                                                value={forgotEmail}
                                                onChange={e => setForgotEmail(e.target.value)}
                                                required autoFocus
                                            />

                                            <button type="submit" disabled={loading}
                                                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-gray-900 dark:text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                                            >
                                                {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
                                            </button>

                                            <p className="text-xs text-gray-500 dark:text-gray-500 text-center">
                                                <button type="button" onClick={() => { setModalMode('login'); setError(''); }} className="text-purple-400 hover:text-purple-300">← Volver a Iniciar Sesión</button>
                                            </p>
                                        </form>
                                    )}
                                </div>
                            )}

                            {/* Terms footer */}
                            {modalMode === 'register' && (
                                <p className="text-xs text-gray-500 dark:text-gray-500 text-center mt-4">
                                    Al registrarte, aceptas nuestros{' '}
                                    <Link to="/terms" className="text-purple-400 hover:text-purple-300">Términos</Link>
                                    {' '}y{' '}
                                    <Link to="/privacy" className="text-purple-400 hover:text-purple-300">Privacidad</Link>
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Componente Flotante del Precio del Token BEZ */}
            <TokenWidget position="bottom-right" />

            {/* Plataforma Integral - Bloques Explicativos */}
            {/* Added a gamified grid to showcase all the platform's core pages with direct links */}
            <section className="py-24 px-6 lg:px-20 relative z-10 bg-[#080911]/80 border-t border-white/5 overflow-hidden">
                {/* Background 3D grid effect */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" style={{ transform: 'perspective(500px) rotateX(60deg) translateY(-100px) translateZ(-200px)' }}></div>

                <div className="max-w-7xl mx-auto reveal relative z-10">
                    <div className="text-center mb-16 space-y-4">
                        <span className="text-[#22d3ee] font-bold uppercase tracking-[0.3em] text-[10px] md:text-sm glow-text-blue">
                            Ecosistema Completo para su Empresa
                        </span>
                        <h2 className="text-3xl md:text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-md">
                            Directorio de la Red BeZhas
                        </h2>
                        <p className="text-gray-400 text-sm md:text-base max-w-2xl mx-auto">
                            Cada rincón de nuestra plataforma está diseñado para maximizar la eficiencia y rentabilidad de sus operaciones industriales mediante Smart Contracts.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        
                        {/* 1. Marketplace */}
                        <motion.div whileHover={{ scale: 1.03, rotateY: 5, rotateX: -5 }} transition={{ type: "spring", stiffness: 300 }} onMouseEnter={playHover} className="group relative bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 hover:border-[#a855f7]/50 shadow-lg hover:shadow-[0_0_30px_rgba(168,85,247,0.2)] transition-all flex flex-col h-full">
                            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4 border border-purple-500/30 group-hover:scale-110 transition-transform">
                                <Building2 className="w-6 h-6 text-purple-400" />
                            </div>
                            <h3 className="text-xl font-black text-white mb-2 uppercase tracking-wide">Marketplace B2B</h3>
                            <p className="text-gray-400 text-sm flex-grow mb-6">Compre y venda equipamiento industrial, repuestos y materias primas automatizando pagos en custodia (calidad asegurada).</p>
                            <Link to="/marketplace" onClick={playClick} className="flex items-center gap-2 text-[#a855f7] font-bold text-sm uppercase tracking-widest group-hover:gap-3 transition-all hover:brightness-110">
                                Explorar <ArrowRight className="w-4 h-4" />
                            </Link>
                        </motion.div>

                        {/* 2. Logística */}
                        <motion.div whileHover={{ scale: 1.03, rotateY: 5, rotateX: -5 }} transition={{ type: "spring", stiffness: 300 }} onMouseEnter={playHover} className="group relative bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 hover:border-[#22d3ee]/50 shadow-lg hover:shadow-[0_0_30px_rgba(34,211,238,0.2)] transition-all flex flex-col h-full">
                            <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center mb-4 border border-cyan-500/30 group-hover:scale-110 transition-transform">
                                <Ship className="w-6 h-6 text-cyan-400" />
                            </div>
                            <h3 className="text-xl font-black text-white mb-2 uppercase tracking-wide">Supply Chain</h3>
                            <p className="text-gray-400 text-sm flex-grow mb-6">Trazabilidad inmutable de extremo a extremo para su cadena de suministros portuaria y terrestre. NFT por lote.</p>
                            <Link to="/logistics" onClick={playClick} className="flex items-center gap-2 text-[#22d3ee] font-bold text-sm uppercase tracking-widest group-hover:gap-3 transition-all hover:brightness-110">
                                Monitorear <ArrowRight className="w-4 h-4" />
                            </Link>
                        </motion.div>

                        {/* 3. Real Estate */}
                        <motion.div whileHover={{ scale: 1.03, rotateY: 5, rotateX: -5 }} transition={{ type: "spring", stiffness: 300 }} onMouseEnter={playHover} className="group relative bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 hover:border-[#f472b6]/50 shadow-lg hover:shadow-[0_0_30px_rgba(244,114,182,0.2)] transition-all flex flex-col h-full">
                            <div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center mb-4 border border-pink-500/30 group-hover:scale-110 transition-transform">
                                <Building className="w-6 h-6 text-pink-400" />
                            </div>
                            <h3 className="text-xl font-black text-white mb-2 uppercase tracking-wide">Real Estate & RWA</h3>
                            <p className="text-gray-400 text-sm flex-grow mb-6">Tokenice y fraccione bodegas de aduanas, naves industriales o maquinaria pesada para obtener liquidez global inmediata.</p>
                            <Link to="/real-estate" onClick={playClick} className="flex items-center gap-2 text-[#f472b6] font-bold text-sm uppercase tracking-widest group-hover:gap-3 transition-all hover:brightness-110">
                                Invertir <ArrowRight className="w-4 h-4" />
                            </Link>
                        </motion.div>

                         {/* 4. Oracle */}
                        <motion.div whileHover={{ scale: 1.03, rotateY: 5, rotateX: -5 }} transition={{ type: "spring", stiffness: 300 }} onMouseEnter={playHover} className="group relative bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 hover:border-[#10b981]/50 shadow-lg hover:shadow-[0_0_30px_rgba(16,185,129,0.2)] transition-all flex flex-col h-full">
                            <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-4 border border-emerald-500/30 group-hover:scale-110 transition-transform">
                                <Activity className="w-6 h-6 text-emerald-400" />
                            </div>
                            <h3 className="text-xl font-black text-white mb-2 uppercase tracking-wide">Network Oracle</h3>
                            <p className="text-gray-400 text-sm flex-grow mb-6">Red de validación en tiempo real impulsada por IA. Alimente sus datos corporativos seguros hacia la Blockchain.</p>
                            <Link to="/oracle" onClick={playClick} className="flex items-center gap-2 text-[#10b981] font-bold text-sm uppercase tracking-widest group-hover:gap-3 transition-all hover:brightness-110">
                                Validar <ArrowRight className="w-4 h-4" />
                            </Link>
                        </motion.div>

                        {/* 5. Staking */}
                        <motion.div whileHover={{ scale: 1.03, rotateY: 5, rotateX: -5 }} transition={{ type: "spring", stiffness: 300 }} onMouseEnter={playHover} className="group relative bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 hover:border-[#facc15]/50 shadow-lg hover:shadow-[0_0_30px_rgba(250,204,21,0.2)] transition-all flex flex-col h-full">
                            <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center mb-4 border border-yellow-500/30 group-hover:scale-110 transition-transform">
                                <TrendingUp className="w-6 h-6 text-yellow-400" />
                            </div>
                            <h3 className="text-xl font-black text-white mb-2 uppercase tracking-wide">Staking Rewards</h3>
                            <p className="text-gray-400 text-sm flex-grow mb-6">Bloquee sus Tokens BEZ y genere rendimientos pasivos automáticos (APY%) que provienen del flujo real del protocolo.</p>
                            <Link to="/staking" onClick={playClick} className="flex items-center gap-2 text-[#facc15] font-bold text-sm uppercase tracking-widest group-hover:gap-3 transition-all hover:brightness-110">
                                Ganar <ArrowRight className="w-4 h-4" />
                            </Link>
                        </motion.div>

                        {/* 6. Liquidez Farm */}
                        <motion.div whileHover={{ scale: 1.03, rotateY: 5, rotateX: -5 }} transition={{ type: "spring", stiffness: 300 }} onMouseEnter={playHover} className="group relative bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 hover:border-[#38bdf8]/50 shadow-lg hover:shadow-[0_0_30px_rgba(56,189,248,0.2)] transition-all flex flex-col h-full">
                            <div className="w-12 h-12 bg-sky-500/20 rounded-xl flex items-center justify-center mb-4 border border-sky-500/30 group-hover:scale-110 transition-transform">
                                <Droplets className="w-6 h-6 text-sky-400" />
                            </div>
                            <h3 className="text-xl font-black text-white mb-2 uppercase tracking-wide">Liquidity Pool</h3>
                            <p className="text-gray-400 text-sm flex-grow mb-6">Conviértase en proveedor de liquidez de nuestro ecosistema y disfrute recompensas premium por el volumen de Swap.</p>
                            <Link to="/liquidity" onClick={playClick} className="flex items-center gap-2 text-[#38bdf8] font-bold text-sm uppercase tracking-widest group-hover:gap-3 transition-all hover:brightness-110">
                                Proveer <ArrowRight className="w-4 h-4" />
                            </Link>
                        </motion.div>

                        {/* 7. DAO */}
                        <motion.div whileHover={{ scale: 1.03, rotateY: 5, rotateX: -5 }} transition={{ type: "spring", stiffness: 300 }} onMouseEnter={playHover} className="group relative bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 hover:border-white/50 shadow-lg hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all flex flex-col h-full">
                            <div className="w-12 h-12 bg-gray-500/20 rounded-xl flex items-center justify-center mb-4 border border-gray-500/30 group-hover:scale-110 transition-transform">
                                <Vote className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-xl font-black text-white mb-2 uppercase tracking-wide">Gobernanza DAO</h3>
                            <p className="text-gray-400 text-sm flex-grow mb-6">Vote sobre las decisiones críticas del protocolo, actualizaciones y flujos de tesorería del ecosistema industrial BeZhas.</p>
                            <Link to="/dao-page" onClick={playClick} className="flex items-center gap-2 text-white font-bold text-sm uppercase tracking-widest group-hover:gap-3 transition-all hover:brightness-110">
                                Votar <ArrowRight className="w-4 h-4" />
                            </Link>
                        </motion.div>

                        {/* 8. VIP Corporate */}
                        <motion.div whileHover={{ scale: 1.03, rotateY: 5, rotateX: -5 }} transition={{ type: "spring", stiffness: 300 }} onMouseEnter={playHover} className="group relative bg-[linear-gradient(135deg,rgba(168,85,247,0.1),rgba(34,211,238,0.1))] backdrop-blur-md rounded-2xl p-6 border border-purple-400/30 shadow-lg hover:shadow-[0_0_30px_rgba(168,85,247,0.3)] transition-all flex flex-col h-full lg:col-span-2 xl:col-span-1">
                            <div className="absolute top-0 right-0 p-3">
                                <Crown className="w-5 h-5 text-yellow-400" />
                            </div>
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-cyan-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Briefcase className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-xl font-black text-white mb-2 uppercase tracking-wide">Planes BE-VIP</h3>
                            <p className="text-gray-300 text-sm flex-grow mb-6">Suscripciones para corporaciones. Desbloquee cero fees de transacción en el Marketplace y analítica predictiva B2B.</p>
                            <Link to="/be-vip" onClick={playClick} className="flex items-center gap-2 text-white font-bold text-sm uppercase tracking-widest hover:brightness-110 bg-white/10 px-4 py-2 rounded border border-white/20 w-fit">
                                Suscribir <ArrowRight className="w-4 h-4" />
                            </Link>
                        </motion.div>

                        {/* 9. Compra Tokens BEZ */}
                        <motion.div whileHover={{ scale: 1.03, rotateY: 5, rotateX: -5 }} transition={{ type: "spring", stiffness: 300 }} onMouseEnter={playHover} className="group relative bg-[#0d33f2]/10 backdrop-blur-md rounded-2xl p-6 border border-[#0d33f2]/30 hover:border-[#0d33f2]/80 shadow-lg hover:shadow-[0_0_40px_rgba(13,51,242,0.3)] transition-all flex flex-col h-full">
                            <div className="w-12 h-12 bg-blue-600/30 rounded-xl flex items-center justify-center mb-4 border border-blue-500/50 group-hover:scale-110 transition-transform">
                                <Coins className="w-6 h-6 text-blue-400" />
                            </div>
                            <h3 className="text-xl font-black text-white mb-2 uppercase tracking-wide">Invertir en BEZ</h3>
                            <p className="text-gray-300 text-sm flex-grow mb-6">Adquiera el token de utilidad central que hace funcionar la infraestructura industrial más moderna del planeta.</p>
                            <Link to="/buy-tokens" onClick={playClick} className="flex items-center gap-2 text-[#0d33f2] font-black text-sm uppercase tracking-widest group-hover:gap-3 transition-all group-hover:text-blue-400 bg-white/5 pl-2">
                                Comprar Ahora <ArrowRight className="w-4 h-4" />
                            </Link>
                        </motion.div>

                        {/* 10. Developer Console */}
                        <motion.div whileHover={{ scale: 1.03, rotateY: 5, rotateX: -5 }} transition={{ type: "spring", stiffness: 300 }} onMouseEnter={playHover} className="group relative bg-black/60 backdrop-blur-md rounded-2xl p-6 border border-gray-600/50 hover:border-green-500/50 shadow-lg hover:shadow-[0_0_30px_rgba(34,197,94,0.2)] transition-all flex flex-col h-full font-mono">
                            <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center mb-4 border border-green-500/30 group-hover:scale-110 transition-transform">
                                <Terminal className="w-6 h-6 text-green-400" />
                            </div>
                            <h3 className="text-lg font-black text-green-400 mb-2 tracking-widest">_DEV_CONSOLE</h3>
                            <p className="text-gray-400 text-sm flex-grow mb-6 font-sans">Acceda a la API REST, Webhooks y el SDK de Javascript nativo para conectar su ERP contable directo al sistema.</p>
                            <Link to="/developer-console" onClick={playClick} className="flex items-center gap-2 text-gray-300 font-bold text-sm tracking-widest group-hover:gap-3 transition-all hover:text-green-400">
                                [Ingresar] <ArrowRight className="w-4 h-4" />
                            </Link>
                        </motion.div>

                        {/* 11. Creación Activos */}
                        <motion.div whileHover={{ scale: 1.03, rotateY: 5, rotateX: -5 }} transition={{ type: "spring", stiffness: 300 }} onMouseEnter={playHover} className="group relative bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 hover:border-[#f97316]/50 shadow-lg hover:shadow-[0_0_30px_rgba(249,115,22,0.2)] transition-all flex flex-col h-full md:col-span-2 xl:col-span-2">
                            <div className="flex flex-col md:flex-row gap-6 h-full items-center md:items-start text-center md:text-left">
                                <div className="w-full md:w-auto flex-shrink-0 flex justify-center">
                                    <div className="w-16 h-16 bg-orange-500/20 rounded-2xl flex items-center justify-center border border-orange-500/30 group-hover:scale-110 group-hover:rotate-12 transition-all">
                                        <Box className="w-8 h-8 text-orange-400" />
                                    </div>
                                </div>
                                <div className="flex flex-col flex-grow">
                                    <h3 className="text-xl md:text-2xl font-black text-white mb-2 uppercase tracking-wide">Tokenice su Inventario</h3>
                                    <p className="text-gray-400 text-sm md:text-base flex-grow mb-6">
                                        Transforme activos del mundo físico (RWA) o líneas de productos logísticos en coleccionables digitales, garantizando financiamiento y auditoría transparente a nivel mundial.
                                    </p>
                                    <Link to="/create" onClick={playClick} className="flex items-center justify-center md:justify-start gap-2 text-[#f97316] font-bold text-sm uppercase tracking-widest group-hover:gap-3 transition-all hover:brightness-110">
                                        Generar Nuevo Activo <ArrowRight className="w-4 h-4" />
                                    </Link>
                                </div>
                            </div>
                        </motion.div>

                    </div>
                </div>
            </section>

            {/* Wallet Suggestion Modal */}
            <ConnectWalletModal
                isOpen={showConnectWalletModal}
                onClose={() => setShowConnectWalletModal(false)}
                onSkip={() => {
                    setShowConnectWalletModal(false);
                    navigate('/feed');
                }}
            />
        </div>
    );
};


export default LandingPage;
