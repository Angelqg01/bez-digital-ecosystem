import NativeAppRedirectPage from '../../components/control-plane/NativeAppRedirectPage';

export default function BridgePage() {
  return (
    <NativeAppRedirectPage
      appKey="wallet"
      path="/bridge"
      title="Bridge migrado a BeZhas Wallet"
      reason="Las operaciones cross-chain quedan centralizadas en la wallet para compartir firma, validacion y estado de transacciones sin duplicar logica blockchain en el Hub."
    />
  );
}
