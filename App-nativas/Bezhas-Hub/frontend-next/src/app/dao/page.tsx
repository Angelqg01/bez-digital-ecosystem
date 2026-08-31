import SubappRedirectPage from '../../components/control-plane/SubappRedirectPage';

export default function DAOPage() {
  return (
    <SubappRedirectPage
      appKey="wallet"
      path="/dao"
      title="DAO y governance se operan en BeZhas Wallet"
      reason="El Hub solo muestra acceso y estado global. Las propuestas, votos y validadores deben vivir junto a la identidad wallet y la firma on-chain."
    />
  );
}
