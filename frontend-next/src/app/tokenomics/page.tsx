import SubappRedirectPage from '../../components/control-plane/SubappRedirectPage';

export default function TokenomicsPage() {
  return (
    <SubappRedirectPage
      appKey="capital"
      path="/tokenomics"
      title="Tokenomics migrado a BZ Capital"
      reason="La analitica economica de token, liquidez, emision y rentabilidad pertenece al modulo financiero. El Hub solo debe exponer resumen global y enlaces profundos."
    />
  );
}
