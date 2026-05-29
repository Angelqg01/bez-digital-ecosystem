import SubappRedirectPage from '../../components/control-plane/SubappRedirectPage';

export default function StakingPage() {
  return (
    <SubappRedirectPage
      appKey="capital"
      path="/staking"
      title="Staking migrado a BZ Capital"
      reason="Staking es operativa financiera. Debe vivir en BZ Capital junto a farming, tesoreria, tokenomics y RWA para evitar contratos y calculos duplicados en el Hub."
    />
  );
}
