import NativeAppRedirectPage from '../../components/control-plane/NativeAppRedirectPage';

export default function EdgeNodePage() {
  return (
    <NativeAppRedirectPage
      appKey="nodes"
      title="Edge Nodes migrado a Edge Node Manager"
      reason="La operacion de nodos, despliegues, uptime y recompensas DePIN pertenece a la app dedicada. El Hub debe quedarse con scorecards y alertas agregadas."
    />
  );
}
