import NativeAppRedirectPage from '../../components/control-plane/NativeAppRedirectPage';

export default function TreasuryPage() {
  return (
    <NativeAppRedirectPage
      appKey="capital"
      path="/treasury"
      title="Treasury operativo migrado a BZ Capital"
      reason="Tesoreria, rendimiento y gestion financiera deben tener un unico owner. El Hub puede mostrar estado agregado, pero no ejecutar operativa financiera."
    />
  );
}
