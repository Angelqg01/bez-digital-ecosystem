import NativeAppRedirectPage from '../../components/control-plane/NativeAppRedirectPage';

export default function FarmingPage() {
  return (
    <NativeAppRedirectPage
      appKey="capital"
      path="/farming"
      title="Yield farming migrado a BZ Capital"
      reason="Las operaciones DeFi verticales pertenecen a BZ Capital. El Hub conserva visibilidad ejecutiva, no ejecucion de pools ni calculo operativo de rendimientos."
    />
  );
}
