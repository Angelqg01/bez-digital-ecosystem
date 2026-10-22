'use client';

// Sesión del chat dentro del Hub: el JWT que ya guarda el Hub (userStore), sin segundo login.
// Sin sesión el chat da UNA pregunta gratis (lo decide el servidor); para seguir, «iniciar sesión» lleva a /auth.
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useUserStore } from '../../stores/userStore';

const API = (process.env.NEXT_PUBLIC_CHAT_API_URL || 'https://api.bezhas.com').replace(/\/+$/, '');

export function useAuth() {
  const router = useRouter();
  const token = useUserStore((s) => s.token);
  // userStore se rehidrata en el cliente: hasta entonces se trata como invitado para no pintar distinto en SSR.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const logged = hydrated && !!token;
  return {
    token: logged ? token : null,
    isAuthenticated: logged,
    openLoginModal: () => router.push('/auth'),
    apiBase: API,
  };
}
