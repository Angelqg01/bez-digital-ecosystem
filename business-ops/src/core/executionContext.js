'use strict';

const { AsyncLocalStorage } = require('node:async_hooks');

/**
 * executionContext — contexto implícito de "qué tarea se está ejecutando ahora".
 *
 * Sirve para que piezas profundas del árbol de llamadas (p. ej. HITLGate, al que
 * llega un agente que no sabe nada de colas ni de tareas) puedan avisar de que
 * su tarea queda APARCADA esperando a un humano, sin tener que enhebrar el
 * taskId ni la cola por toda la jerarquía de agentes.
 *
 * Se propaga solo por el árbol async de `runInTask` (AsyncLocalStorage de Node),
 * así que nunca se filtra entre tareas ni entre tenants concurrentes.
 *
 * Fuera de una tarea (llamada directa por API, canal síncrono, test) no hay
 * contexto y `currentTask()` devuelve null: quien lo use debe degradar sin más.
 */
const storage = new AsyncLocalStorage();

/**
 * Ejecuta `fn` con el contexto de tarea activo.
 * @param {{taskId: string, park: Function, unpark: Function, markSideEffect?: Function}} ctx
 * @param {Function} fn
 */
function runInTask(ctx, fn) {
  return storage.run(ctx, fn);
}

/** Contexto de la tarea en curso, o null si no estamos dentro de una. */
function currentTask() {
  return storage.getStore() || null;
}

/**
 * Marca que la tarea en curso ya ha hecho algo con efecto fuera del sistema
 * (enviar, escribir, cobrar…). A partir de ahí deja de ser reintentable en
 * automático: repetirla duplicaría ese efecto.
 *
 * Fuera de una tarea no hace nada — igual que el resto del contexto.
 */
function markSideEffect(detail = {}) {
  const ctx = storage.getStore();
  if (ctx?.markSideEffect) ctx.markSideEffect(detail);
}

module.exports = { runInTask, currentTask, markSideEffect };
