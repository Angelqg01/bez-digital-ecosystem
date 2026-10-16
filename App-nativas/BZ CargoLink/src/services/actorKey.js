/**
 * Clave de operador de CargoLink.
 *
 * El backend (api/services/cargoLinkLifecycle.js → resolveIdentity) NO acepta el JWT de la plataforma en los endpoints
 * /v1/*: exige una clave con rol (`bzk_live_…`) emitida por un admin (Operadores). Se guarda en el navegador bajo
 * `cargolink_actor_key` (la misma que ya usa IotHubPanel). Si no hay clave, se cae al JWT: sirve para /admin/* y para
 * que el servidor responda con un 401 claro en vez de «sin token».
 */
const KEY = 'cargolink_actor_key'

const read = (k) => { try { return localStorage.getItem(k) } catch { return null } }

export const getActorKey = () => read(KEY) || ''
export const setActorKey = (v) => { try { v ? localStorage.setItem(KEY, v.trim()) : localStorage.removeItem(KEY) } catch { /* almacenamiento bloqueado */ } }
export const jwt = () => read('bezhas_access_token') || read('bezhas-jwt')
/** Credencial para los endpoints de CargoLink: clave de operador y, si no hay, el JWT. */
export const authKey = () => getActorKey() || jwt()
export const hasActorKey = () => !!getActorKey()
