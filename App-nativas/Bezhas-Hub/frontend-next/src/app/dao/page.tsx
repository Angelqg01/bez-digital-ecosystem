import NativeAppRedirectPage from '../../components/control-plane/NativeAppRedirectPage';

export default function DAOPage() {
  return (
    <NativeAppRedirectPage
      appKey="wallet"
      path="/dao"
      title="DAO y governance se operan en BeZhas Wallet"
      reason="El Hub solo muestra acceso y estado global. Las propuestas, votos y validadores deben vivir junto a la identidad wallet y la firma on-chain."
    />
  );
}
