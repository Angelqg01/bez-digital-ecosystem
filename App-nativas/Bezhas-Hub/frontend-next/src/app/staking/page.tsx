import NativeAppRedirectPage from '../../components/control-plane/NativeAppRedirectPage';

export default function StakingPage() {
  return (
    <NativeAppRedirectPage
      appKey="capital"
      path="/staking"
      title="Staking migrado a BZ Capital"
      reason="Staking es operativa financiera. Debe vivir en BZ Capital junto a farming, tesoreria, tokenomics y RWA para evitar contratos y calculos duplicados en el Hub."
    />
  );
}
