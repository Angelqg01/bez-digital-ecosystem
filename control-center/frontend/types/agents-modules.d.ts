/**
 * Ambient declaration for the dynamically-loaded agents UI module.
 *
 * `@agents/*` maps (see tsconfig paths) to `./modules/agents-ui/*`, a JSX
 * bundle that is NOT part of this checkout — it is provided at deploy time and
 * loaded lazily via next/dynamic in components/AgentsDashboard.tsx, which
 * already degrades to an inline fallback (AgentsFallbackUI + ErrorBoundary)
 * when it is absent. Without this declaration TypeScript can't resolve the
 * import (TS2307) and rejects the props passed to the default component
 * (TS2322). Declaring the module as a permissive React component keeps the
 * lazy-load contract intact while letting the props through.
 */
declare module '@agents/*' {
  import type { ComponentType } from 'react';

  export interface AgentModuleProps {
    wallet?: { connected: boolean; address: string | null } | null;
    engine?: Record<string, unknown>;
    liveData?: Record<string, unknown>;
    [key: string]: unknown;
  }

  const Component: ComponentType<AgentModuleProps>;
  export default Component;
}
