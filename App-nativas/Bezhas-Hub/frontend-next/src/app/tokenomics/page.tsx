import NativeAppRedirectPage from '../../components/control-plane/NativeAppRedirectPage';

export default function TokenomicsPage() {
  return (
    <NativeAppRedirectPage
      appKey="capital"
      path="/tokenomics"
      title="Tokenomics migrado a BZ Capital"
      reason="La analitica economica de token, liquidez, emision y rentabilidad pertenece al modulo financiero. El Hub solo debe exponer resumen global y enlaces profundos."
    />
  );
}
