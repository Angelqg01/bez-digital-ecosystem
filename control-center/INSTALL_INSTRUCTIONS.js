/**
 * BeZhas Web3 — Integración de rutas Agent Runtime + AEGIS
 *
 * INSTRUCCIONES DE INSTALACIÓN EN bezhas-web3:
 * ══════════════════════════════════════════════
 *
 * 1. Copiar archivos en bezhas-web3:
 *    ├── src/pages/AgentRuntimePage.jsx
 *    ├── src/pages/AegisDashboard.jsx
 *    ├── src/hooks/useAgentRuntime.js
 *    └── src/components/TelegramStatusWidget.jsx
 *
 * 2. Añadir variables al .env de bezhas-web3:
 *    VITE_API_URL=http://localhost:3001
 *    VITE_WS_URL=ws://localhost:3002
 *
 * 3. Añadir las rutas en tu router (React Router v6):
 */

// En src/App.jsx o src/router/index.jsx — añadir estas rutas:

import { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';

const AgentRuntimePage = lazy(() => import('./pages/AgentRuntimePage'));
const AegisDashboard   = lazy(() => import('./pages/AegisDashboard'));

// Dentro de <Routes> existente, añadir:
export const AGENT_ROUTES = (
  <>
    <Route path="/dashboard/agents"   element={<AgentRuntimePage />} />
    <Route path="/dashboard/security" element={<AegisDashboard />}   />
  </>
);

/**
 * NAVBAR LINKS — añadir en tu componente de navegación:
 *
 * { label: '🤖 Agent Runtime', to: '/dashboard/agents'   }
 * { label: '🛡️ AEGIS Security', to: '/dashboard/security' }
 *
 * WIDGET COMPACTO — incrustar en el sidebar o header:
 *
 * import TelegramStatusWidget from './components/TelegramStatusWidget';
 * <TelegramStatusWidget compact />  // solo dot + estado
 * <TelegramStatusWidget />          // card completa con HITL
 *
 * IMPORTS NECESARIOS en cualquier página que muestre estado de agentes:
 *
 * import { useAgentRuntime } from '../hooks/useAgentRuntime';
 * const { agents, hitlQueue, resolveHITL } = useAgentRuntime();
 */
