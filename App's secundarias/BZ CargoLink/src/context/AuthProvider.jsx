/**
 * AuthProvider de BZ CargoLink — adaptador sobre el provider compartido.
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
} from '../../../_shared/BezhasAuthProvider.jsx';

/**
 * Esta app no proxya `/api`, asi que necesita la URL absoluta de la API core.
 * normalizeApiBase() dentro del provider quita el `/api` final, que las rutas
 * ya incluyen.
 */
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export function AuthProvider({ children }) {
  return (
    <BezhasAuthProvider appName="BZ CargoLink" accent="#00D4AA" apiBase={API_BASE}>
      {children}
    </BezhasAuthProvider>
  );
}

export { useAuth, HeaderAuthButton, LockScreen, AuthModal };
export default AuthProvider;
