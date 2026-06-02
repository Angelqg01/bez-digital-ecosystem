import SubappRedirectPage from '../../components/control-plane/SubappRedirectPage';

export default function FarmingPage() {
  return (
    <SubappRedirectPage
      appKey="capital"
      path="/farming"
      title="Yield farming migrado a BZ Capital"
      reason="Las operaciones DeFi verticales pertenecen a BZ Capital. El Hub conserva visibilidad ejecutiva, no ejecucion de pools ni calculo operativo de rendimientos."
    />
  );
}
