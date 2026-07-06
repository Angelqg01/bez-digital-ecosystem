// Preview de Card — composición completa con sus subcomponentes reales.
import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Badge } from 'bezhas-frontend';

const dark: React.CSSProperties = { background: '#080911', padding: 24, borderRadius: 12 };

export const CardCompleta = () => (
  <div style={dark}>
    <Card className="max-w-sm">
      <CardHeader>
        <Badge variant="primary">Plan Business</Badge>
        <CardTitle>Conexión entre empresas</CardTitle>
        <CardDescription>
          Integra tu ERP con tus socios mediante una API unificada, sin desarrollos a medida.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-400">
          Pedidos, facturas y seguimiento logístico sincronizados en tiempo real con cada socio verificado.
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="primary">Solicitar acceso</Button>
      </CardFooter>
    </Card>
  </div>
);

export const CardSimple = () => (
  <div style={dark}>
    <Card className="max-w-sm">
      <CardContent>
        <p className="text-sm text-gray-600">Ahorro operativo estimado: 18% anual al digitalizar la conciliación con proveedores.</p>
      </CardContent>
    </Card>
  </div>
);
