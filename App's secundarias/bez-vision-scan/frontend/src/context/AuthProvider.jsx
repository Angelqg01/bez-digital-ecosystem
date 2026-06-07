import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { siweLogin, subscribeWithBEZ, shortAddress } from '../../../../_shared/bezhas-wallet-auth.js';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// --- COMPONENTE DE BOTÓN DE CABECERA (PILL SHAPED) ---
export function HeaderAuthButton() {
  const { token, user, openLoginModal, logout } = useAuth();

  if (token && user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          background: 'rgba(0, 240, 255, 0.08)',
          border: '1px solid rgba(0, 240, 255, 0.3)',
          borderRadius: '20px',
          color: '#00f0ff',
          fontSize: '12px',
          fontWeight: 700,
          boxShadow: '0 0 10px rgba(0, 240, 255, 0.1)'
        }}>
          <span style={{ fontSize: '14px' }}>👤</span>
          <span>{user.username}</span>
          <span style={{
            fontSize: '10px',
            background: 'linear-gradient(135deg, #a855f7, #6366f1)',
            color: '#fff',
            padding: '2px 8px',
            borderRadius: '10px',
            marginLeft: '4px',
            fontWeight: 800,
            textTransform: 'uppercase'
          }}>{user.role || 'Usuario'}</span>
        </div>
        <button
          onClick={logout}
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '20px',
            color: '#ef4444',
            padding: '6px 16px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => {
            e.target.style.background = 'rgba(239, 68, 68, 0.2)';
            e.target.style.transform = 'scale(1.03)';
          }}
          onMouseLeave={e => {
            e.target.style.background = 'rgba(239, 68, 68, 0.1)';
            e.target.style.transform = 'scale(1)';
          }}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={openLoginModal}
      style={{
        background: 'linear-gradient(135deg, #00f0ff, #a855f7)',
        border: 'none',
        borderRadius: '20px',
        color: '#000',
        padding: '8px 20px',
        fontSize: '12px',
        fontWeight: 800,
        cursor: 'pointer',
        boxShadow: '0 4px 15px rgba(0, 240, 255, 0.3)',
        transition: 'all 0.3s ease',
      }}
      onMouseEnter={e => {
        e.target.style.boxShadow = '0 6px 20px rgba(168, 85, 247, 0.5)';
        e.target.style.transform = 'scale(1.05)';
      }}
      onMouseLeave={e => {
        e.target.style.boxShadow = '0 4px 15px rgba(0, 240, 255, 0.3)';
        e.target.style.transform = 'scale(1)';
      }}
    >
      🔑 Conectar / Registro
    </button>
  );
}

// --- COMPONENTE DE BLOQUEO DE CONTENIDO ---
export function LockScreen({ title = "Acceso Restringido" }) {
  const { openLoginModal } = useAuth();
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      padding: '40px 20px',
      textAlign: 'center',
      background: 'rgba(15, 23, 42, 0.35)',
      borderRadius: '24px',
      border: '1px dashed rgba(255,255,255,0.08)',
      margin: '20px',
      backdropFilter: 'blur(12px)',
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
    }}>
      <div style={{
        fontSize: '64px',
        marginBottom: '20px',
        animation: 'pulse 2s infinite'
      }}>🔒</div>
      <h2 style={{
        fontSize: '24px',
        fontWeight: 900,
        color: '#fff',
        marginBottom: '12px',
        fontFamily: 'Space Grotesk, system-ui'
      }}>{title}</h2>
      <p style={{
        fontSize: '14px',
        color: '#94a3b8',
        maxWidth: '480px',
        lineHeight: '1.6',
        marginBottom: '28px'
      }}>
        Para probar las características operativas de la BeZhas Blockchain (firmas, contratos de custodia, transferencias de gas en tiempo real y DePIN), debes estar registrado o autenticado.
      </p>
      <button
        onClick={openLoginModal}
        style={{
          background: 'linear-gradient(135deg, #00f0ff, #a855f7)',
          border: 'none',
          borderRadius: '24px',
          color: '#000',
          padding: '12px 32px',
          fontSize: '13px',
          fontWeight: 900,
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(0, 240, 255, 0.3)',
          transition: 'all 0.3s ease',
        }}
        onMouseEnter={e => {
          e.target.style.transform = 'scale(1.05)';
          e.target.style.boxShadow = '0 6px 25px rgba(168, 85, 247, 0.5)';
        }}
        onMouseLeave={e => {
          e.target.style.transform = 'scale(1)';
          e.target.style.boxShadow = '0 4px 20px rgba(0, 240, 255, 0.3)';
        }}
      >
        Crear Perfil Blockchain
      </button>
    </div>
  );
}

// --- MODAL DE AUTENTICACIÓN ---
function LoginRegisterModal({ onClose }) {
  const { login, register, loginWithWallet } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('Inversor Especial');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [walletBusy, setWalletBusy] = useState(false);

  const handleWallet = async () => {
    setError('');
    setWalletBusy(true);
    try {
      await loginWithWallet(isLogin ? 'login' : 'subscribe');
    } catch (e) {
      setError(e?.message || 'No se pudo conectar la wallet.');
    } finally {
      setWalletBusy(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Por favor completa todos los campos.');
      return;
    }

    if (isLogin) {
      login(username, password);
    } else {
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden.');
        return;
      }
      register(username, role, password);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'rgba(4, 7, 15, 0.85)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      fontFamily: 'Space Grotesk, system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: '#090d16',
        border: '1px solid rgba(0, 240, 255, 0.15)',
        borderRadius: '24px',
        padding: '28px',
        boxShadow: '0 10px 40px rgba(0, 240, 255, 0.1)',
        position: 'relative',
        animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: '#475569',
            fontSize: '18px',
            cursor: 'pointer',
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => e.target.style.color = '#fff'}
          onMouseLeave={e => e.target.style.color = '#475569'}
        >
          ✕
        </button>

        {/* Brand/Icon */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #00f0ff, #a855f7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
            fontSize: '24px',
            boxShadow: '0 0 20px rgba(0, 240, 255, 0.2)'
          }}>
            🔑
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#fff', margin: 0 }}>BeZhas Blockchain L2</h3>
          <p style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Demo & Investor Authentication Panel</p>
        </div>

        {/* Toggle Slide */}
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '30px',
          padding: '4px',
          marginBottom: '24px'
        }}>
          <button
            onClick={() => { setIsLogin(true); setError(''); }}
            type="button"
            style={{
              flex: 1,
              background: isLogin ? 'linear-gradient(135deg, #00f0ff, #6366f1)' : 'transparent',
              color: isLogin ? '#000' : '#94a3b8',
              border: 'none',
              borderRadius: '25px',
              padding: '8px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Iniciar Sesión
          </button>
          <button
            onClick={() => { setIsLogin(false); setError(''); }}
            type="button"
            style={{
              flex: 1,
              background: !isLogin ? 'linear-gradient(135deg, #a855f7, #6366f1)' : 'transparent',
              color: !isLogin ? '#fff' : '#94a3b8',
              border: 'none',
              borderRadius: '25px',
              padding: '8px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Registrarse
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#ef4444',
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '11px',
            marginBottom: '16px',
            fontWeight: 600
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 800, marginBottom: '6px', letterSpacing: '0.5px' }}>
              Usuario o Correo
            </label>
            <input
              type="text"
              placeholder="inversor@bezhas.net"
              value={username}
              onChange={e => setUsername(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                padding: '10px 14px',
                color: '#fff',
                fontSize: '13px',
                outline: 'none',
                transition: 'border 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = isLogin ? '#00f0ff' : '#a855f7'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>

          {!isLogin && (
            <div>
              <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 800, marginBottom: '6px', letterSpacing: '0.5px' }}>
                Perfil / Rol de Red
              </label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                style={{
                  width: '100%',
                  background: '#090d16',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  color: '#fff',
                  fontSize: '13px',
                  outline: 'none',
                  cursor: 'pointer',
                  transition: 'border 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = '#a855f7'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
              >
                <option value="Inversor Especial">Inversor Especial (Demo)</option>
                <option value="Validador L2 Node">Validador L2 Node</option>
                <option value="Operador DePIN IoT">Operador DePIN IoT</option>
                <option value="Gestor de Cadena">Gestor de Cadena</option>
                <option value="Auditor Corporativo">Auditor Corporativo</option>
              </select>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 800, marginBottom: '6px', letterSpacing: '0.5px' }}>
              Contraseña
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                padding: '10px 14px',
                color: '#fff',
                fontSize: '13px',
                outline: 'none',
                transition: 'border 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = isLogin ? '#00f0ff' : '#a855f7'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>

          {!isLogin && (
            <div>
              <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 800, marginBottom: '6px', letterSpacing: '0.5px' }}>
                Confirmar Contraseña
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  color: '#fff',
                  fontSize: '13px',
                  outline: 'none',
                  transition: 'border 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = '#a855f7'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
              />
            </div>
          )}

          <button
            type="submit"
            style={{
              width: '100%',
              background: isLogin ? 'linear-gradient(135deg, #00f0ff, #6366f1)' : 'linear-gradient(135deg, #a855f7, #6366f1)',
              border: 'none',
              borderRadius: '12px',
              color: isLogin ? '#000' : '#fff',
              padding: '12px',
              fontSize: '13px',
              fontWeight: 900,
              cursor: 'pointer',
              marginTop: '10px',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: isLogin ? '0 4px 15px rgba(0, 240, 255, 0.2)' : '0 4px 15px rgba(168, 85, 247, 0.2)'
            }}
            onMouseEnter={e => e.target.style.transform = 'scale(1.02)'}
            onMouseLeave={e => e.target.style.transform = 'scale(1)'}
          >
            {isLogin ? 'Acceder al Ecosistema' : 'Registrar e Iniciar Sesión'}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0 14px' }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>o</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
        </div>

        {/* Wallet auth */}
        <button
          type="button"
          onClick={handleWallet}
          disabled={walletBusy}
          style={{
            width: '100%',
            background: 'rgba(0, 240, 255, 0.06)',
            border: '1px solid rgba(0, 240, 255, 0.3)',
            borderRadius: '12px',
            color: '#00f0ff',
            padding: '12px',
            fontSize: '13px',
            fontWeight: 800,
            cursor: walletBusy ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all 0.2s',
          }}
        >
          👛 {walletBusy ? 'Firmando con la wallet…' : (isLogin ? 'Iniciar sesión con Wallet' : 'Suscribirse con Wallet')}
        </button>
        <p style={{ fontSize: 10, color: '#475569', textAlign: 'center', marginTop: 8 }}>
          Sign-In With Ethereum (SIWE) · firma criptográfica, sin contraseña
        </p>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Check if token is coming from URL (Hub redirection SSO)
    const searchParams = new URLSearchParams(location.search);
    const urlToken = searchParams.get('token');

    if (urlToken) {
      console.log('🔑 SSO Token detected in URL. Storing...');
      localStorage.setItem('bezhas-jwt', urlToken);
      setToken(urlToken);

      const ssoUser = { username: 'Hub Admin', role: 'Administrador Global', email: 'admin@hub.bezhas' };
      localStorage.setItem('bezhas-user', JSON.stringify(ssoUser));
      setUser(ssoUser);
      
      searchParams.delete('token');
      const newUrl = `${location.pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
      navigate(newUrl, { replace: true });
      setIsLoading(false);
      return;
    }

    // 2. Check if token is already in localStorage
    const localToken = localStorage.getItem('bezhas-jwt');
    const localUser = localStorage.getItem('bezhas-user');

    if (localToken) {
      setToken(localToken);
      if (localUser) {
        try {
          setUser(JSON.parse(localUser));
        } catch {
          setUser({ username: 'Investor Demo', role: 'Inversor Especial' });
        }
      } else {
        setUser({ username: 'Investor Demo', role: 'Inversor Especial' });
      }
    }
    setIsLoading(false);
  }, [location, navigate]);

  const login = (usernameOrEmail, password) => {
    const mockToken = `mock-jwt-${Date.now()}`;
    const loggedUser = {
      username: usernameOrEmail.split('@')[0],
      role: 'Inversor Especial',
      email: usernameOrEmail.includes('@') ? usernameOrEmail : `${usernameOrEmail}@bezhas.net`
    };

    localStorage.setItem('bezhas-jwt', mockToken);
    localStorage.setItem('bezhas-user', JSON.stringify(loggedUser));
    setToken(mockToken);
    setUser(loggedUser);
    setIsLoginModalOpen(false);
  };

  const register = (username, profile, password) => {
    const mockToken = `mock-jwt-${Date.now()}`;
    const loggedUser = {
      username,
      role: profile,
      email: `${username}@bezhas.net`
    };

    localStorage.setItem('bezhas-jwt', mockToken);
    localStorage.setItem('bezhas-user', JSON.stringify(loggedUser));
    setToken(mockToken);
    setUser(loggedUser);
    setIsLoginModalOpen(false);
  };

  // Login / sign-up with a Web3 wallet (SIWE, with demo fallback).
  const loginWithWallet = async (mode = 'login') => {
    const session = await siweLogin({ statement: 'Inicia sesión en BeZhas Vision Scan con tu wallet.', mode });
    const walletUser = {
      username: shortAddress(session.address),
      role: session.authMethod === 'siwe' ? 'Wallet Verified' : 'Wallet (Demo)',
      walletAddress: session.address,
    };
    localStorage.setItem('bezhas-jwt', session.token);
    localStorage.setItem('bezhas-user', JSON.stringify(walletUser));
    setToken(session.token);
    setUser(walletUser);
    setIsLoginModalOpen(false);
    return session;
  };

  // Pay a subscription in BEZ-Coin (Polygon).
  const subscribeWithBEZPlan = async (amountBEZ = 50) => subscribeWithBEZ({ amountBEZ });

  const logout = () => {
    localStorage.removeItem('bezhas-jwt');
    localStorage.removeItem('bezhas-user');
    setToken(null);
    setUser(null);
  };

  const openLoginModal = () => setIsLoginModalOpen(true);
  const closeLoginModal = () => setIsLoginModalOpen(false);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', color: '#fff', fontFamily: 'Space Grotesk' }}>
        <h2>Cargando Ecosistema BeZhas L2...</h2>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ token, user, login, register, loginWithWallet, subscribeWithBEZPlan, logout, isLoginModalOpen, openLoginModal, closeLoginModal }}>
      {children}
      {isLoginModalOpen && <LoginRegisterModal onClose={closeLoginModal} />}
    </AuthContext.Provider>
  );
};
