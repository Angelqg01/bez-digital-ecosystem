import type { AppInfo } from '../../config/hubData';
import type { AppState } from '../../lib/status';
import Icon from './Icon';

const LABEL: Record<AppState | 'soon', string> = { online: 'Online', offline: 'Sin respuesta', soon: 'En desarrollo' };

export default function AppCard({ app, state }: { app: AppInfo; state: AppState | 'soon' }) {
  const body = (
    <>
      <div className="hub-card-top">
        <span className="hub-card-ico"><Icon name={app.icon} /></span>
        <span className="hub-status" data-s={state}><i />{LABEL[state]}</span>
      </div>
      <span className="hub-tag">{app.tag}</span>
      <h3>{app.name}</h3>
      <p>{app.desc}</p>
      {app.href && (
        <span className="hub-card-foot">Abrir {app.href.replace('https://', '').split('/')[0]} <Icon name="arrow-up-right" size={16} /></span>
      )}
    </>
  );
  return app.href ? (
    <a className="hub-card" href={app.href}>{body}</a>
  ) : (
    <div className="hub-card hub-card-soon">{body}</div>
  );
}
