import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// Silenciar warnings y errores innecesarios en desarrollo
if (import.meta.env.DEV) {
  const originalWarn = console.warn;
  const originalError = console.error;

  console.warn = (...args) => {
    const msg = args[0]?.toString() || '';
    // Filtrar warnings comunes que no afectan funcionalidad
    if (msg.includes('React Router Future Flag Warning') ||
      msg.includes('Lit is in dev mode') ||
      msg.includes('validateDOMNesting') ||
      msg.includes('Unauthorized') ||
      msg.includes('Failed to load settings') ||
      (msg.includes('contract') && (msg.includes('not deployed') || msg.includes('not found'))) ||
      msg.includes('UserProfile contract') ||
      msg.includes('Marketplace contract') ||
      msg.includes('TokenSale contract') ||
      msg.includes('BezhasToken contract')) {
      return;
    }
    originalWarn.apply(console, args);
  };

  // Silenciar errores de Axios en desarrollo (backend no disponible es esperado)
  console.error = (...args) => {
    const msg = args[0]?.toString() || '';
    const errorObj = args[0];

    // Silenciar errores comunes de desarrollo
    if (msg.includes('AxiosError') ||
      msg.includes('Request failed') ||
      msg.includes('Network Error') ||
      msg.includes('404') ||
      msg.includes('401') ||
      msg.includes('403') ||
      msg.includes('CALL_EXCEPTION') ||
      msg.includes('missing revert data') ||
      msg.includes('could not decode result data') ||
      msg.includes('Error al obtener los datos del usuario') ||
      msg.includes('Error loading user data') ||
      msg.includes('net::ERR_NAME_NOT_RESOLVED') ||
      msg.includes('net::ERR_FILE_NOT_FOUND') ||
      (errorObj?.code === 'CALL_EXCEPTION') ||
      (errorObj?.name === 'AxiosError')) {
      return; // Silently ignore
    }
    originalError.apply(console, args);
  };
}

// Loading component - BEZ Coin spinning animation
import { BezCoinLoaderFullScreen } from './components/ui/BezCoinLoader';

function LoadingScreen() {
  return <BezCoinLoaderFullScreen text="Cargando BeZhas..." />;
}

// Lazy load Web3 app (wagmi 3.x)
const AppWithWeb3 = lazy(() => import('./AppWithWeb3'));

import { GoogleOAuthProvider } from '@react-oauth/google';

// Wrapper seguro para Google OAuth que no falla si no hay conexión
const SafeGoogleOAuthProvider = ({ children }) => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // Si no hay clientId configurado, renderizar sin el provider
  if (!clientId) {
    return children;
  }

  return (
    <GoogleOAuthProvider
      clientId={clientId}
      onScriptLoadError={() => {
        // Silenciar error de carga del script de Google (sin conexión)
      }}
    >
      {children}
    </GoogleOAuthProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SafeGoogleOAuthProvider>
      <Suspense fallback={<LoadingScreen />}>
        <AppWithWeb3 />
      </Suspense>
    </SafeGoogleOAuthProvider>
  </React.StrictMode>
);
