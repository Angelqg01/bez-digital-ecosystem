import SubappRedirectPage from '../../components/control-plane/SubappRedirectPage';

export default function EdgeNodePage() {
  return (
    <SubappRedirectPage
      appKey="nodes"
      title="Edge Nodes migrado a Edge Node Manager"
      reason="La operacion de nodos, despliegues, uptime y recompensas DePIN pertenece a la app dedicada. El Hub debe quedarse con scorecards y alertas agregadas."
    />
  );
}
