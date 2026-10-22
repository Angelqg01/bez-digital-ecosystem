import type { Metadata } from 'next';
import Icon from '../../../components/hub/Icon';
import { LINKS, PLUGIN } from '../../../config/hubData';

export const metadata: Metadata = {
  title: 'Developers — BeZhas Hub',
  description: 'Plugin de WordPress, API, SDK y servidor MCP de BeZhas.',
};

const TOOLS = [
  { icon: 'bot', title: 'BeZhas MCP', body: 'Conecta Claude, ChatGPT, Codex o Gemini con herramientas de consulta y preparación de operaciones.', href: LINKS.mcp, cta: 'Conectar tu IA' },
  { icon: 'plug', title: 'API y SDK', body: 'API REST y WebSocket, con SDK y documentación completa.', href: LINKS.docs, cta: 'Abrir la documentación' },
  { icon: 'route', title: 'RPC y nodos', body: 'Endpoints RPC públicos y nodos dedicados.', href: LINKS.rpc, cta: 'Ver endpoints' },
  { icon: 'shield-check', title: 'Developer Portal', body: 'Contratos, SDK y referencia de la API en un solo portal.', href: LINKS.developers, cta: 'Entrar al portal' },
];

export default function DevelopersPage() {
  return (
    <>
      <section className="hub-section">
        <div className="hub-wrap">
          <span className="hub-eyebrow">Developers</span>
          <h1 className="hub-h2" style={{ fontSize: 'clamp(36px,5vw,64px)' }}>Integra BeZhas en tu sistema</h1>
          <p className="hub-lead">Plugin para WordPress y WooCommerce, API, SDK y un servidor MCP para tus agentes de IA.</p>
          <div className="hub-grid hub-grid-4">
            {TOOLS.map((t) => (
              <a key={t.title} className="hub-card" href={t.href}>
                <span className="hub-card-ico"><Icon name={t.icon} /></span>
                <h3>{t.title}</h3>
                <p>{t.body}</p>
                <span className="hub-card-foot">{t.cta} <Icon name="arrow-up-right" size={16} /></span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="hub-section hub-deep" id="plugin">
        <div className="hub-wrap hub-split">
          <div>
            <span className="hub-eyebrow">Plugin WordPress · v{PLUGIN.version}</span>
            <h2 className="hub-h2">BeZhas Hub — Embedded Gateway</h2>
            <p className="hub-lead">
              Consola del Hub embebida en wp-admin, suscripción a los planes, activación de apps nativas y BeZhas-Pay con shortcode,
              bloque de WordPress y gateway WooCommerce.
            </p>
            <div className="hub-hero-cta">
              <a className="hub-btn hub-btn-primary" href={PLUGIN.url}>Descargar {PLUGIN.file}</a>
            </div>
            <ol className="hub-steps" style={{ marginTop: 32 }}>
              <li>Descarga el ZIP y comprueba su huella SHA-256.</li>
              <li>En WordPress: Plugins → Añadir nuevo → Subir plugin, y activa el plugin.</li>
              <li>En BeZhas → Hub, pega tu API Key y pulsa Conectar.</li>
              <li>Usa <code>[bezhas_pay amount="49.90" currency="EUR"]</code> o el bloque «BeZhas Pay» para cobrar.</li>
            </ol>
          </div>
          <div style={{ display: 'grid', gap: 14 }}>
            <div className="hub-card">
              <span className="hub-tag">Huella SHA-256</span>
              <div className="hub-codebox"><span className="hub-mono">{PLUGIN.sha256}</span></div>
              <a className="hub-card-foot" href={PLUGIN.sha256Url}>Fichero .sha256 <Icon name="arrow-up-right" size={16} /></a>
            </div>
            <div className="hub-card">
              <span className="hub-tag">Requisitos</span>
              <ul className="hub-feats">
                <li>PHP {PLUGIN.php} o superior, con los parches de seguridad de octubre de 2026 (8.2.35, 8.3.36, 8.4.27 u 8.5.12)</li>
                <li>WordPress 5.8+; WooCommerce 5.0+ solo para el gateway</li>
                <li>API Key de BeZhas y cuenta activa</li>
              </ul>
              <p style={{ fontSize: 13.5 }}>
                Las versiones de PHP 8.1 y anteriores ya no reciben parches upstream y tienen vulnerabilidades críticas conocidas (PHP2Shell).
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="hub-section">
        <div className="hub-wrap">
          <span className="hub-eyebrow">MCP</span>
          <h2 className="hub-h2">Endpoint para tus agentes</h2>
          <div className="hub-codebox" style={{ marginTop: 24, maxWidth: 560 }}>
            <span className="hub-mono">{LINKS.mcpEndpoint}</span>
          </div>
          <p className="hub-lead">Autenticación con la API Key de tu plan en la cabecera <code>x-api-key</code>. Los límites por minuto dependen del plan.</p>
        </div>
      </section>
    </>
  );
}
