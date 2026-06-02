import SubappRedirectPage from '../../components/control-plane/SubappRedirectPage';

export default function MarketplacePage() {
  return (
    <SubappRedirectPage
      appKey="capital"
      path="/marketplace"
      title="Marketplace operativo migrado a apps verticales"
      reason="El Hub no debe ejecutar compraventa ni escrow de dominio. Debe dirigir al marketplace financiero o a la app vertical correspondiente segun el activo."
    />
  );
}
