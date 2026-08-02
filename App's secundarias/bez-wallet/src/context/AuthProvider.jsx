/**
 * AuthProvider de bez-wallet — adaptador sobre el provider compartido.
 *
 * Antes esto era una copia de 645 líneas con su propio modal y, sobre todo, con
 * un `login`/`register` que fabricaba `mock-jwt-${Date.now()}` sin llamar a
 * ningún backend: se entraba con cualquier contraseña, el token no lo firmaba
 * nadie y cualquier endpoint real devolvía 401. La sesión de verdad vive ahora
 * en _shared/BezhasAuthProvider.jsx, común a todas las SubApps.
 *
 * Este archivo se conserva como fachada para que los imports de App.jsx
 * (`./context/AuthProvider`) sigan funcionando sin tocar los consumidores.
 */
import React from 'react';
import {
  BezhasAuthProvider,
  useAuth,
  HeaderAuthButton,
  LockScreen,
  AuthModal,
} from '../../../_shared/BezhasAuthProvider.jsx';

/**
 * En dev, vite.config proxya `/api` a la API core (localhost:3001), así que la
 * base vacía es la correcta: las llamadas salen del mismo origen y no hay
 * preflight de CORS. En producción manda VITE_API_URL.
 */
const API_BASE = import.meta.env.VITE_API_URL ?? '';

export function AuthProvider({ children }) {
  return (
    <BezhasAuthProvider appName="BeZhas Wallet" accent="#00f0ff" apiBase={API_BASE}>
      {children}
    </BezhasAuthProvider>
  );
}

export { useAuth, HeaderAuthButton, LockScreen, AuthModal };
export default AuthProvider;
