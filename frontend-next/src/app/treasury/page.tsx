import SubappRedirectPage from '../../components/control-plane/SubappRedirectPage';

export default function TreasuryPage() {
  return (
    <SubappRedirectPage
      appKey="capital"
      path="/treasury"
      title="Treasury operativo migrado a BZ Capital"
      reason="Tesoreria, rendimiento y gestion financiera deben tener un unico owner. El Hub puede mostrar estado agregado, pero no ejecutar operativa financiera."
    />
  );
}
