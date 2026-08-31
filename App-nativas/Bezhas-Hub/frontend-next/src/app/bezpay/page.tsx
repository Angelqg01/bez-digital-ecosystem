import NativeAppRedirectPage from '../../components/control-plane/NativeAppRedirectPage';

export default function BezPayPage() {
  return (
    <NativeAppRedirectPage
      appKey="pay"
      title="BezPay operativo migrado a BeZhas Pay Manager"
      reason="El Hub conserva billing, planes y permisos. La conciliacion de pagos, checkout y operacion del motor de pagos debe vivir en la app de pagos."
    />
  );
}
