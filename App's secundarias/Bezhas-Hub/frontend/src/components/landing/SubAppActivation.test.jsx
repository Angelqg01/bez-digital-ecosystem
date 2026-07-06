// Component test for the SubApp activation calculator.
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import SubAppActivation from './SubAppActivation';

describe('SubAppActivation', () => {
  it('renderiza la sección con el id de ancla y los planes base', () => {
    const { container } = render(<SubAppActivation />);
    expect(container.querySelector('#activar-subapps')).toBeTruthy();
    expect(screen.getByText('Starter')).toBeTruthy();
    expect(screen.getByText('Business')).toBeTruthy();
    expect(screen.getByText('Enterprise')).toBeTruthy();
  });

  it('por defecto: Business con Pay+CargoLink incluidos → total 199 €', () => {
    render(<SubAppActivation />);
    // El total grande aparece como "199 €".
    expect(screen.getByText('199 €')).toBeTruthy();
  });

  it('activar una SubApp extra de pago sube el total', () => {
    render(<SubAppActivation />);
    // Energy (+129 €) está como toggle; al activarla pasa a facturarse
    // (Business ya gasta sus 3 incluidos en pay/cargolink/energy → factura la más barata).
    const energyBtn = screen.getByText('BeZhas Energy').closest('button');
    fireEvent.click(energyBtn);
    // El total ya no es 199 (entra a facturarse pay, la más barata de las 3).
    expect(screen.queryByText('199 €')).toBeNull();
  });

  it('seleccionar Enterprise muestra "A medida"', () => {
    render(<SubAppActivation />);
    fireEvent.click(screen.getByText('Enterprise'));
    expect(screen.getByText('A medida')).toBeTruthy();
  });

  it('Hub y Wallet aparecen como incluidas y no son desactivables', () => {
    render(<SubAppActivation />);
    const hubBtn = screen.getByText('BeZhas Hub').closest('button');
    expect(hubBtn.disabled).toBe(true);
    expect(within(hubBtn).getByText('incluida')).toBeTruthy();
  });

  it('el toggle anual muestra el ahorro', () => {
    render(<SubAppActivation />);
    const annualBtn = screen.getByText(/ver anual/i);
    fireEvent.click(annualBtn);
    // Tras activar anual, aparece el desglose "/ año · ahorras".
    expect(screen.getByText(/ahorras/i)).toBeTruthy();
  });
});
