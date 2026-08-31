/**
 * AuthProvider de BZ Vision Scan — adaptador sobre el provider compartido.
 *
 * Antes esto era una copia de ~645 lineas con su propio modal y, sobre todo,
 * con un `login`/`register` que fabricaba `mock-jwt-${Date.now()}` sin llamar
 * a ningun backend: se entraba con cualquier contrasena, el token no lo firmaba
 * nadie y cualquier endpoint real devolvia 401. La sesion de verdad vive ahora
 * en _shared/BezhasAuthProvider.jsx, comun a todas las SubApps.
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
} from '../../../../_shared/BezhasAuthProvider.jsx';

/**
 * En dev, vite.config proxya `/api` a la API core (localhost:3001), asi que la
 * base vacia es la correcta: las llamadas salen del mismo origen y no hay
 * preflight de CORS. En produccion manda VITE_API_URL.
 */
const API_BASE = import.meta.env.VITE_API_URL ?? '';

export function AuthProvider({ children }) {
  return (
    <BezhasAuthProvider appName="BZ Vision Scan" accent="#00f0ff" apiBase={API_BASE}>
      {children}
    </BezhasAuthProvider>
  );
}

export { useAuth, HeaderAuthButton, LockScreen, AuthModal };
export default AuthProvider;
