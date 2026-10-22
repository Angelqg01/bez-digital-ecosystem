import './hub.css';
import HubHeader from '../../components/hub/HubHeader';
import HubFooter from '../../components/hub/HubFooter';

export default function HubLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="hub">
      <HubHeader />
      <main>{children}</main>
      <HubFooter />
    </div>
  );
}
