import Link from 'next/link';
import { LINKS, LIVE_APPS } from '../../config/hubData';

export default function HubFooter() {
  return (
    <footer className="hub-footer">
      <div className="hub-wrap">
        <div className="hub-footer-grid">
          <div>
            <div className="hub-logo"><span className="hub-logo-mark">B</span><span>BeZhas <small>Hub</small></span></div>
            <p style={{ marginTop: 14, color: 'var(--ink-2)', fontSize: 14.5, maxWidth: '34ch' }}>
              Centro de operaciones B2B del ecosistema BeZhas: organización, claves de API y acceso a las apps nativas.
            </p>
          </div>
          <div>
            <h4>Apps nativas</h4>
            <ul>{LIVE_APPS.map((a) => <li key={a.key}><a href={a.href}>{a.name}</a></li>)}</ul>
          </div>
          <div>
            <h4>Plataforma</h4>
            <ul>
              <li><a href={LINKS.precios}>Planes y precios</a></li>
              <li><a href={LINKS.token}>BEZ-Coin</a></li>
              <li><a href={LINKS.network}>Estado de red</a></li>
              <li><a href={LINKS.enterprise}>Enterprise</a></li>
              <li><Link href="/developers">Plugin WordPress</Link></li>
            </ul>
          </div>
          <div>
            <h4>Desarrolladores y ayuda</h4>
            <ul>
              <li><a href={LINKS.developers}>Developer Portal</a></li>
              <li><a href={LINKS.mcp}>BeZhas MCP</a></li>
              <li><a href={LINKS.docs}>API y SDK Docs</a></li>
              <li><a href={LINKS.support}>Soporte</a></li>
              <li><a href={LINKS.telegram}>Telegram</a></li>
              <li><a href={LINKS.sales}>ventas@bezhas.com</a></li>
            </ul>
          </div>
        </div>
        <div className="hub-footer-bottom">
          <span>© {new Date().getFullYear()} BeZhas · Algeciras, España</span>
          <span><a href={LINKS.privacy}>Privacidad</a> · MiCA · SEPA · DAC8</span>
        </div>
      </div>
    </footer>
  );
}
