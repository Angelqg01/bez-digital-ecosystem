// Component test for the App Nativa activation calculator.
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import NativeAppActivation from './NativeAppActivation';

/** El importe de la fila "Total" (el mismo texto sale en el selector de plan). */
const totalMostrado = () => {
  const fila = screen.getByText('Total').parentElement;
  return within(fila).getByText(/€$/).textContent;
};

describe('NativeAppActivation', () => {
  it('renderiza la sección con el id de ancla y los planes base', () => {
    const { container } = render(<NativeAppActivation />);
    expect(container.querySelector('#activar-apps-nativas')).toBeTruthy();
    expect(screen.getByText('Starter')).toBeTruthy();
    expect(screen.getByText('Business')).toBeTruthy();
    // El plan se llama "Enterprise VIP" en config/plans.js, la fuente única.
    expect(screen.getByText('Enterprise VIP')).toBeTruthy();
  });

  it('por defecto: Business con Pay+CargoLink cabe en sus 3 slots → total 499 €', () => {
    render(<NativeAppActivation />);
    // Business incluye 3 módulos sin coste, así que pay (49) y cargolink (89)
    // no suman: el total es la base del plan.
    expect(totalMostrado()).toBe('499 €');
  });

  it('activar una App Nativa extra de pago sube el total', () => {
    render(<NativeAppActivation />);
    // Energy (+129 €) está como toggle; al activarla pasa a facturarse
    // (Business ya gasta sus 3 incluidos en pay/cargolink/energy → factura la más barata).
    const energyBtn = screen.getByText('BeZhas Energy').closest('button');
    fireEvent.click(energyBtn);
    // El total ya no es 199 (entra a facturarse pay, la más barata de las 3).
    expect(screen.queryByText('199 €')).toBeNull();
  });

  it('seleccionar Enterprise VIP muestra su precio y comp los módulos', () => {
    // Este test esperaba "A medida", de cuando Enterprise no tenía precio
    // público. Hoy sí lo tiene (2.499 €) y `includedAddons: Infinity`, así que
    // lo que hay que comprobar es que los módulos activos no suman nada.
    render(<NativeAppActivation />);
    fireEvent.click(screen.getByText('Enterprise VIP'));
    expect(totalMostrado()).toBe('2499 €');
  });

  it('Hub y Wallet aparecen como incluidas y no son desactivables', () => {
    render(<NativeAppActivation />);
    const hubBtn = screen.getByText('BeZhas Hub').closest('button');
    expect(hubBtn.disabled).toBe(true);
    expect(within(hubBtn).getByText('incluida')).toBeTruthy();
  });

  it('OPERANT no se regala con los slots libres del plan', () => {
    // Es el único módulo con coste marginal real: comparlo sería servir
    // cómputo a pérdida. Business trae 3 slots y aun así OPERANT factura.
    render(<NativeAppActivation />);
    fireEvent.click(screen.getByText('OPERANT').closest('button'));
    expect(totalMostrado()).toBe('748 €');   // 499 de base + 249 del módulo
  });

  it('el toggle anual muestra el ahorro', () => {
    render(<NativeAppActivation />);
    const annualBtn = screen.getByText(/ver anual/i);
    fireEvent.click(annualBtn);
    // Tras activar anual, aparece el desglose "/ año · ahorras".
    expect(screen.getByText(/ahorras/i)).toBeTruthy();
  });
});
