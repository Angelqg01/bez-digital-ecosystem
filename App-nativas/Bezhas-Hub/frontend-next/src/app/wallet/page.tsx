import SubappRedirectPage from '../../components/control-plane/SubappRedirectPage';

export default function WalletPage() {
  return (
    <SubappRedirectPage
      appKey="wallet"
      title="Wallet se opera fuera del Hub"
      reason="BeZhas-Hub conserva identidad, permisos y estado agregado. La gestion de balances, transferencias e historial pertenece a BeZhas Wallet para evitar dos fuentes de verdad."
    />
  );
}
