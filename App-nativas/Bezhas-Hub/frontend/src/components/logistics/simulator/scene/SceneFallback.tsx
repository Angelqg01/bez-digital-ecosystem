import React from 'react';

/**
 * ¿Puede este navegador crear un contexto WebGL?
 *
 * three/R3F lanza «Error creating WebGL context» al montar <Canvas> cuando el
 * navegador tiene la aceleración por hardware desactivada, la GPU está en la
 * lista negra o se agotaron los contextos. Ese error salía hasta el
 * ErrorBoundary global y tumbaba toda la consola de desarrolladores. Se
 * comprueba antes de montar la escena y se libera el contexto de prueba para
 * no gastar uno de los ~16 que permite el navegador.
 */
export function isWebGLAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as
      | WebGLRenderingContext
      | WebGL2RenderingContext
      | null;
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** Aviso que ocupa el hueco de la escena 3D; el simulador sigue funcionando encima. */
export function Scene3DUnavailable({ reason }: { reason?: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-6 text-center bg-[radial-gradient(ellipse_at_center,_rgba(20,184,166,0.08),_transparent_70%)]">
      <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-teal-400/80">
        Vista 3D no disponible
      </span>
      <p className="max-w-md text-xs text-zinc-400">
        El navegador no ha podido iniciar WebGL. La simulación, la cadena y los paneles funcionan igual;
        para ver el gemelo digital activa la aceleración por hardware del navegador y recarga.
      </p>
      {reason && <code className="text-[10px] text-zinc-600">{reason}</code>}
    </div>
  );
}

type BoundaryState = { error: Error | null };

/**
 * Captura fallos de la escena 3D (creación del contexto, pérdida de contexto al
 * montar, shaders) para que no suban al ErrorBoundary de la app.
 */
export class Scene3DErrorBoundary extends React.Component<{ children: React.ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.warn('[LogisticsSimulator360] Escena 3D desactivada:', error.message);
  }

  render() {
    if (this.state.error) return <Scene3DUnavailable reason={this.state.error.message} />;
    return this.props.children;
  }
}
