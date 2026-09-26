/*
 * Retira el service worker de la versión anterior de www.bezhas.com.
 *
 * La web anterior (Vite + PWA) registró /sw.js con precaché de index.html: sin
 * este fichero, el navegador de quien ya la visitó seguía sirviendo la versión
 * vieja desde su caché, porque un 404 al buscar actualizaciones NO desinstala
 * un service worker. El navegador comprueba /sw.js en cada visita; al ver este
 * contenido nuevo lo instala, borra las cachés, se da de baja y recarga la
 * pestaña ya contra el servidor. Este panel no usa service worker propio.
 */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const claves = await caches.keys();
    await Promise.all(claves.map((clave) => caches.delete(clave)));
    await self.registration.unregister();
    const ventanas = await self.clients.matchAll({ type: 'window' });
    ventanas.forEach((ventana) => ventana.navigate(ventana.url));
  })());
});
