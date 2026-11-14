import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

let precio = 0.0075;
vi.mock('../hooks/useBezPrice', () => ({ useBezPrice: () => precio }));
vi.mock('../hooks/useRWAContracts', () => ({
    useRWAContracts: () => ({ tokenizationFee: '100', bezBalance: '5000', tokenizeAsset: vi.fn() }),
    ASSET_CATEGORIES: { INMUEBLE: 0, HOTEL: 1, LOCAL: 2, ROPA: 3, COCHE: 4, BARCO: 5, HELICOPTERO: 6, OBJETO: 7 },
    CATEGORY_NAMES: { 0: 'Inmueble', 1: 'Hotel', 2: 'Local Comercial', 3: 'Ropa/Moda', 4: 'Vehículo', 5: 'Barco/Yate', 6: 'Helicóptero', 7: 'Objeto de Lujo' },
}));
vi.mock('../services/ipfs.service', () => ({ default: { uploadFile: vi.fn(), uploadFiles: vi.fn() } }));

import RealEstateRWAForm from './RealEstateRWAForm';

const escribir = (placeholder, valor) => fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value: valor } });

/** Llega al paso 3 con un inmueble de 1.000.000 USD. */
function hastaElPaso3() {
    render(<RealEstateRWAForm onSuccess={vi.fn()} />);
    fireEvent.click(screen.getByText('Inmueble'));
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    escribir(/Apartamento Luxury Penthouse/, 'Penthouse Madrid Centro');
    escribir('1000000', '1000000');
    escribir('Calle, Ciudad, País', 'Calle Mayor 1, Madrid, España');
    escribir('150', '150');
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
}

beforeEach(() => { precio = 0.0075; });

describe('Asistente de tokenización · paso 3 con el precio real del BEZ', () => {
    it('enseña el precio del BEZ y la tarifa de tokenización en USD (100 BEZ ≈ 0,75 USD)', () => {
        hastaElPaso3();
        expect(screen.getByTestId('precio-bez')).toHaveTextContent('$0.0075');
        expect(screen.getByTestId('precio-bez')).toHaveTextContent(/no de mercado/);
        expect(screen.getByText(/≈ \$0,75/)).toBeInTheDocument();
    });

    it('sugiere el precio por fracción que cuadra con la valoración y lo aplica con un clic', () => {
        hastaElPaso3();
        escribir('1000', '10000');
        const boton = screen.getByTestId('usar-precio-sugerido');
        expect(boton).toHaveTextContent('13.333,33 BEZ');
        expect(boton).toHaveTextContent('$100,00 por fracción');

        fireEvent.click(boton);
        expect(screen.getByPlaceholderText('100.00')).toHaveValue(13333.33);
        expect(screen.queryByTestId('usar-precio-sugerido')).not.toBeInTheDocument(); // ya es el sugerido
        expect(screen.getByTestId('equivalencias')).toHaveTextContent('El precio cuadra con la valoración declarada');
    });

    it('avisa cuando el precio escrito recaudaría mucho menos que la valoración', () => {
        hastaElPaso3();
        escribir('1000', '1000');
        escribir('100.00', '100');
        const eq = screen.getByTestId('equivalencias');
        expect(eq).toHaveTextContent('$0,75'); // precio por fracción ≈ USD
        expect(screen.getByRole('alert')).toHaveTextContent(/recaudarías \$750.*99,9 % menos/);
    });

    it('sin precio del BEZ no enseña equivalencias ni sugerencia: no inventa nada', () => {
        precio = null;
        hastaElPaso3();
        escribir('1000', '10000');
        escribir('100.00', '100');
        expect(screen.queryByTestId('precio-bez')).not.toBeInTheDocument();
        expect(screen.queryByTestId('usar-precio-sugerido')).not.toBeInTheDocument();
        expect(screen.queryByTestId('equivalencias')).not.toBeInTheDocument();
        expect(screen.getByText('Capital Total a Recaudar:')).toBeInTheDocument(); // el cálculo en BEZ de siempre
    });
});
