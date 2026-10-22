import './hub.css';
import HubHeader from '../../components/hub/HubHeader';
import HubFooter from '../../components/hub/HubFooter';
import AIWorkspaceBar from '../../components/ai-chat/AIWorkspaceBar';

const SUGGESTIONS = ['¿Qué apps nativas tiene BeZhas?', '¿Qué planes ofrece BeZhas?', '¿Tenéis plugin para WordPress?'];

export default function HubLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="hub">
      <HubHeader />
      <main>{children}</main>
      <HubFooter />
      <AIWorkspaceBar
        hideAppId="app_hub"
        bottomOffset={12}
        bottomOffsetMobile={12}
        siteUrl="https://www.bezhas.com"
        suggestions={SUGGESTIONS}
      />
    </div>
  );
}
