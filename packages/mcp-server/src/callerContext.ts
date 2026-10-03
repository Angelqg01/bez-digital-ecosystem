/**
 * Credencial de quien llama al MCP público, disponible para las herramientas durante la petición.
 * Las herramientas que actúan en nombre de la persona (pagos) reenvían SU token al backend: así el
 * backend decide con la identidad y los scopes de esa persona, nunca con una credencial de servicio.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export interface Caller {
    bearer: string;
}

const storage = new AsyncLocalStorage<Caller>();

export const runAsCaller = <T>(caller: Caller, fn: () => T): T => storage.run(caller, fn);
export const currentCaller = (): Caller | undefined => storage.getStore();
