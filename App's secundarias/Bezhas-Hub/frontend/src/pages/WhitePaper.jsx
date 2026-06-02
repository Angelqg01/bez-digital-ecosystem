import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FileText, Download, Share2, BookOpen, TrendingUp,
    Shield, Zap, Globe, Target, Lock, Coins, BarChart3,
    ArrowRight, Check, Layers, RefreshCw, Flame, TrendingDown
} from 'lucide-react';
import './WhitePaper.css';

const WhitePaper = () => {
    const navigate = useNavigate();
    const [activeSection, setActiveSection] = useState('intro');

    const sections = [
        { id: 'intro', title: '1. Introducción', icon: BookOpen },
        { id: 'ecosystem', title: '2. Ecosistema Doble Capa', icon: Layers },
        { id: 'tokenomics', title: '3. Tokenomics', icon: Coins },
        { id: 'functions', title: '4. Funciones del Token', icon: Target },
        { id: 'polygon', title: '5. Implementación Polygon', icon: Shield },
        { id: 'burn', title: '6. Deflación Programada', icon: Flame },
        { id: 'conclusion', title: '7. Conclusión', icon: TrendingUp }
    ];

    const scrollToSection = (sectionId) => {
        setActiveSection(sectionId);
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handleDownload = () => {
        // Placeholder for PDF download
        alert('Función de descarga en desarrollo. Pronto disponible en PDF.');
    };

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'BeZhas Whitepaper - $BEZ Coin',
                    text: 'Whitepaper Técnico del Token de Utilidad y Tesorería de BeZhas',
                    url: window.location.href
                });
            } catch (err) {
                console.log('Error sharing:', err);
            }
        } else {
            navigator.clipboard.writeText(window.location.href);
            alert('¡Enlace copiado al portapapeles!');
        }
    };

    return (
        <div className="whitepaper-page">
            {/* Header Hero */}
            <div className="whitepaper-hero">
                <div className="hero-content">
                    <div className="hero-badge">
                        <FileText className="w-4 h-4 mr-2" />
                        Whitepaper Técnico v1.0
                    </div>
                    <h1 className="hero-title">
                        $BEZ Coin
                        <span className="gradient-text"> Utility & Treasury Token</span>
                    </h1>
                    <p className="hero-subtitle">
                        El token de la verdad económica sobre Polygon. Garantía colateral del protocolo de
                        validación de calidad más grande del mundo Web3.
                    </p>
                    <div className="hero-actions">
                        <button className="btn-primary" onClick={handleDownload}>
                            <Download className="w-5 h-5 mr-2" />
                            Descargar PDF
                        </button>
                        <button className="btn-secondary" onClick={handleShare}>
                            <Share2 className="w-5 h-5 mr-2" />
                            Compartir
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="whitepaper-container">
                {/* Sidebar Navigation */}
                <aside className="whitepaper-sidebar">
                    <div className="sidebar-sticky">
                        <h3 className="sidebar-title">Contenido</h3>
                        <nav className="sidebar-nav">
                            {sections.map((section) => {
                                const Icon = section.icon;
                                return (
                                    <button
                                        key={section.id}
                                        className={`nav-item ${activeSection === section.id ? 'active' : ''}`}
                                        onClick={() => scrollToSection(section.id)}
                                    >
                                        <Icon className="w-4 h-4 mr-2" />
                                        {section.title}
                                    </button>
                                );
                            })}
                        </nav>
                        <div className="sidebar-footer">
                            <button className="btn-contact" onClick={() => navigate('/contact')}>
                                Contactar Equipo
                            </button>
                        </div>
                    </div>
                </aside>

                {/* Content Sections */}
                <main className="whitepaper-content">
                    {/* Section 1: Introducción */}
                    <section id="intro" className="wp-section">
                        <div className="section-header">
                            <BookOpen className="section-icon" />
                            <h2>1. Introducción: El Token de la Verdad Económica</h2>
                        </div>
                        <div className="section-body">
                            <p className="lead-text">
                                En la economía Web3, la mayoría de los tokens sufren de <strong>falta de utilidad real</strong>.
                                $BEZ rompe este ciclo actuando como la unidad de medida y la garantía colateral del Protocolo BeZhas.
                            </p>
                            <div className="highlight-box">
                                <Zap className="box-icon" />
                                <p>
                                    <strong>$BEZ no es solo una moneda</strong>; es el combustible del motor de validación de calidad
                                    más grande del mundo sobre Polygon.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Section 2: Ecosistema */}
                    <section id="ecosystem" className="wp-section">
                        <div className="section-header">
                            <Layers className="section-icon" />
                            <h2>2. El Ecosistema de Doble Capa</h2>
                        </div>
                        <div className="section-body">
                            <p>El valor de $BEZ se sustenta en dos pilares fundamentales:</p>

                            <div className="dual-layer-grid">
                                <div className="layer-card">
                                    <div className="layer-header">
                                        <Globe className="w-6 h-6 text-blue-400" />
                                        <h3>Capa de Servicio (API/SDK)</h3>
                                    </div>
                                    <p>Donde las empresas pagan por el derecho a validar.</p>
                                    <ul className="feature-list">
                                        <li><Check className="w-4 h-4 text-green-400" /> API REST con autenticación JWT</li>
                                        <li><Check className="w-4 h-4 text-green-400" /> SDK JavaScript/TypeScript</li>
                                        <li><Check className="w-4 h-4 text-green-400" /> Webhooks en tiempo real</li>
                                        <li><Check className="w-4 h-4 text-green-400" /> Rate limiting inteligente</li>
                                    </ul>
                                </div>

                                <div className="layer-card highlight">
                                    <div className="layer-header">
                                        <Lock className="w-6 h-6 text-purple-400" />
                                        <h3>Capa de Tesorería (Collateral)</h3>
                                    </div>
                                    <p>Donde las empresas bloquean tokens para garantizar su calidad ante el cliente.</p>
                                    <ul className="feature-list">
                                        <li><Check className="w-4 h-4 text-green-400" /> Smart Contracts auditados</li>
                                        <li><Check className="w-4 h-4 text-green-400" /> Colateralización dinámica</li>
                                        <li><Check className="w-4 h-4 text-green-400" /> Sistema de arbitraje DAO</li>
                                        <li><Check className="w-4 h-4 text-green-400" /> Liberación automática</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Section 3: Tokenomics */}
                    <section id="tokenomics" className="wp-section">
                        <div className="section-header">
                            <Coins className="section-icon" />
                            <h2>3. Tokenomics: Mecanismos de Valor</h2>
                        </div>
                        <div className="section-body">
                            <h3 className="subsection-title">A. El Ciclo de Demanda Perpetua (Flywheel)</h3>
                            <p>
                                Para que una empresa (ej. Maersk) use la red BeZhas, debe seguir este flujo:
                            </p>

                            <div className="flywheel-steps">
                                <div className="step-card">
                                    <div className="step-number">1</div>
                                    <div className="step-content">
                                        <h4>Compra de Mercado</h4>
                                        <p>La empresa necesita adquirir $BEZ para cargar su "Bóveda de Garantía".</p>
                                    </div>
                                    <TrendingUp className="step-icon text-green-400" />
                                </div>

                                <div className="step-arrow">
                                    <ArrowRight className="w-6 h-6" />
                                </div>

                                <div className="step-card">
                                    <div className="step-number">2</div>
                                    <div className="step-content">
                                        <h4>Bloqueo de Suministro (Locking)</h4>
                                        <p>Mientras el producto está en tránsito, los tokens están fuera de circulación.</p>
                                    </div>
                                    <Lock className="step-icon text-blue-400" />
                                </div>

                                <div className="step-arrow">
                                    <ArrowRight className="w-6 h-6" />
                                </div>

                                <div className="step-card">
                                    <div className="step-number">3</div>
                                    <div className="step-content">
                                        <h4>Quema y Comisiones (Burn & Fees)</h4>
                                        <p>Una pequeña fracción de cada validación exitosa se quema, reduciendo el suministro total.</p>
                                    </div>
                                    <Flame className="step-icon text-orange-400" />
                                </div>
                            </div>

                            <h3 className="subsection-title mt-6">B. Fórmula de Estabilidad de Tesorería</h3>
                            <p>El Smart Contract de Tesorería utiliza una fórmula de colateralización dinámica:</p>

                            <div className="formula-box">
                                <div className="formula">
                                    <div className="formula-main">
                                        C<sub>r</sub> = (V<sub>fiat</sub> × Q<sub>target</sub>) / P<sub>bez</sub>
                                    </div>
                                    <div className="formula-legend">
                                        <div className="legend-item">
                                            <strong>C<sub>r</sub></strong>: Colateral requerido
                                        </div>
                                        <div className="legend-item">
                                            <strong>V<sub>fiat</sub></strong>: Valor del contrato
                                        </div>
                                        <div className="legend-item">
                                            <strong>Q<sub>target</sub></strong>: Nivel de calidad prometido
                                        </div>
                                        <div className="legend-item">
                                            <strong>P<sub>bez</sub></strong>: Precio actual del token
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Section 4: Funciones */}
                    <section id="functions" className="wp-section">
                        <div className="section-header">
                            <Target className="section-icon" />
                            <h2>4. Funciones del Token $BEZ</h2>
                        </div>
                        <div className="section-body">
                            <div className="functions-table">
                                <div className="table-row header">
                                    <div className="table-cell">Función</div>
                                    <div className="table-cell">Descripción</div>
                                    <div className="table-cell">Impacto en el Precio</div>
                                </div>

                                <div className="table-row">
                                    <div className="table-cell">
                                        <Shield className="w-5 h-5 text-blue-400 mr-2" />
                                        <strong>Garantía (Collateral)</strong>
                                    </div>
                                    <div className="table-cell">
                                        Las empresas bloquean $BEZ para asegurar contratos de servicio.
                                    </div>
                                    <div className="table-cell">
                                        <span className="impact-badge positive">
                                            <TrendingUp className="w-4 h-4" />
                                            Retira oferta del mercado (Holding forzado)
                                        </span>
                                    </div>
                                </div>

                                <div className="table-row">
                                    <div className="table-cell">
                                        <Coins className="w-5 h-5 text-yellow-400 mr-2" />
                                        <strong>Medio de Pago</strong>
                                    </div>
                                    <div className="table-cell">
                                        Los clientes que pagan con $BEZ reciben bonificaciones directas.
                                    </div>
                                    <div className="table-cell">
                                        <span className="impact-badge positive">
                                            <TrendingUp className="w-4 h-4" />
                                            Estimula la adopción masiva
                                        </span>
                                    </div>
                                </div>

                                <div className="table-row">
                                    <div className="table-cell">
                                        <BarChart3 className="w-5 h-5 text-purple-400 mr-2" />
                                        <strong>Gobernanza de Calidad</strong>
                                    </div>
                                    <div className="table-cell">
                                        Los validadores (nodos) hacen staking de $BEZ para arbitrar disputas.
                                    </div>
                                    <div className="table-cell">
                                        <span className="impact-badge positive">
                                            <TrendingUp className="w-4 h-4" />
                                            Asegura la red y premia al holder
                                        </span>
                                    </div>
                                </div>

                                <div className="table-row">
                                    <div className="table-cell">
                                        <RefreshCw className="w-5 h-5 text-green-400 mr-2" />
                                        <strong>Conversión Fiat-to-Bez</strong>
                                    </div>
                                    <div className="table-cell">
                                        Nuestra API convierte automáticamente pagos de empresas Web2 en compras de $BEZ.
                                    </div>
                                    <div className="table-cell">
                                        <span className="impact-badge positive">
                                            <TrendingUp className="w-4 h-4" />
                                            Presión de compra constante (Buy pressure)
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Section 5: Polygon */}
                    <section id="polygon" className="wp-section">
                        <div className="section-header">
                            <Shield className="section-icon" />
                            <h2>5. Implementación en Polygon (PoS/zkEVM)</h2>
                        </div>
                        <div className="section-body">
                            <p>Elegimos Polygon por tres razones técnicas críticas:</p>

                            <div className="polygon-features">
                                <div className="feature-card">
                                    <Zap className="w-8 h-8 text-yellow-400 mb-3" />
                                    <h4>Finalidad Rápida</h4>
                                    <p>
                                        Las validaciones de calidad deben ser casi instantáneas
                                        <strong> (menos de 2 segundos)</strong>.
                                    </p>
                                </div>

                                <div className="feature-card">
                                    <Globe className="w-8 h-8 text-blue-400 mb-3" />
                                    <h4>Interoperabilidad</h4>
                                    <p>
                                        $BEZ puede moverse a Ethereum u otras cadenas si es necesario
                                        para <strong>tesorerías globales</strong>.
                                    </p>
                                </div>

                                <div className="feature-card">
                                    <Layers className="w-8 h-8 text-green-400 mb-3" />
                                    <h4>Sostenibilidad</h4>
                                    <p>
                                        Bajos costos de energía, vital para empresas con políticas
                                        <strong> ESG</strong> (como las logísticas europeas).
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Section 6: Burn Mechanism */}
                    <section id="burn" className="wp-section">
                        <div className="section-header">
                            <Flame className="section-icon" />
                            <h2>6. La Deflación Programada (The Burn Mechanism)</h2>
                        </div>
                        <div className="section-body">
                            <p>
                                Para incentivar a los inversores iniciales, BeZhas implementa un
                                <strong> "Proof of Quality Burn"</strong>:
                            </p>

                            <div className="burn-mechanism">
                                <div className="burn-card">
                                    <div className="burn-icon-wrapper">
                                        <Flame className="w-12 h-12 text-orange-400" />
                                    </div>
                                    <h3>0.5% Burn Rate</h3>
                                    <p>
                                        Cada vez que una empresa recibe una <strong>"Calidad Perfecta (100%)"</strong>,
                                        el protocolo quema el 0.5% de la comisión de servicio.
                                    </p>
                                </div>

                                <div className="burn-formula">
                                    <h4>Correlación Calidad-Escasez</h4>
                                    <p className="burn-equation">
                                        Mayor calidad en el mundo real → Más tokens quemados → Token más escaso
                                    </p>
                                    <p className="burn-benefit">
                                        Esto alinea los intereses de las <strong>empresas</strong>,
                                        los <strong>clientes</strong> y los <strong>inversores</strong>.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Section 7: Conclusión */}
                    <section id="conclusion" className="wp-section">
                        <div className="section-header">
                            <TrendingUp className="section-icon" />
                            <h2>7. Conclusión: El Valor de BeZhas</h2>
                        </div>
                        <div className="section-body">
                            <div className="conclusion-box">
                                <p className="conclusion-text">
                                    A diferencia de otros tokens, el valor de <strong>$BEZ está directamente ligado
                                        al Producto Interno Bruto (PIB)</strong> de las empresas que lo usan.
                                </p>
                                <div className="conclusion-highlight">
                                    <TrendingUp className="w-6 h-6 text-green-400 mr-3" />
                                    <p>
                                        <strong>Si Maersk mueve más carga o los hoteles tienen más huéspedes,
                                            la demanda de $BEZ sube matemáticamente.</strong>
                                    </p>
                                </div>
                            </div>

                            <div className="cta-section">
                                <h3>¿Listo para unirte a la revolución?</h3>
                                <div className="cta-buttons">
                                    <button className="btn-primary" onClick={() => navigate('/bezcoin')}>
                                        <Coins className="w-5 h-5 mr-2" />
                                        Explorar $BEZ Coin
                                    </button>
                                    <button className="btn-secondary" onClick={() => navigate('/contact')}>
                                        Contactar Equipo
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
};

export default WhitePaper;
