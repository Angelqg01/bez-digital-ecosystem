import { useUserStore } from '../stores/userStore';

/** Guarda la sesión que devuelve la API (registro, login o confirmación de email) en el store del Hub. */
export function saveSession(token: string, user: any) {
  const s = useUserStore.getState();
  s.setToken(token);
  s.setUser(user);
}
