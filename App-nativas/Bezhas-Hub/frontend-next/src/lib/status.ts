// Estado en vivo de cada app nativa: una petición HEAD desde el servidor, cacheada 5 minutos.
// Si no responde a tiempo se muestra «sin respuesta», nunca un «online» inventado.
export type AppState = 'online' | 'offline';

export async function appStatus(url: string): Promise<AppState> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 300 },
    });
    return res.status < 500 ? 'online' : 'offline';
  } catch {
    return 'offline';
  }
}
