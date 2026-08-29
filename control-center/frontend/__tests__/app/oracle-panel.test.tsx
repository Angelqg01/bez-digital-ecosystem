/**
 * OraclePanel — los tres estados del precio.
 *
 * Lo que se protege: que la regla fail-closed llegue hasta la interfaz. El resto
 * de la portada promete que una lectura fuera de ventana no se da por buena; si
 * este panel pintara un precio caducado como vigente, la promesa seria falsa
 * justo en el dato que mas se mira.
 */
import { render, screen } from '@testing-library/react';
import OraclePanel, { type ContractCard } from '@/app/(landing)/_components/OraclePanel';

const mockUseOracle = jest.fn();
jest.mock('@/lib/public-hooks', () => ({
    useOracleTokenPrices: () => mockUseOracle(),
}));

const contracts: ContractCard[] = [
    {
        chainId: 137,
        name: 'Polygon',
        address: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
        explorerLabel: 'Polygonscan',
        explorerUrl: 'https://polygonscan.com/token/0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
        mark: <svg />,
    },
    {
        chainId: 56,
        name: 'BNB Chain',
        address: '0x8a1e3930fde1f151471c368fdbb39f3f63a65b55',
        explorerLabel: 'BscScan',
        explorerUrl: 'https://bscscan.com/token/0x8a1e3930fde1f151471c368fdbb39f3f63a65b55',
        mark: <svg />,
    },
];

const payload = (over: Record<string, unknown> = {}) => ({
    success: true,
    tokens: { BEZ: { symbol: 'BEZ', priceUSD: 0.0075, change24h: -1.2, updatedAt: new Date().toISOString() } },
    bezCoinPriceUSD: 0.0075,
    bezCoinChange24h: -1.2,
    updatedAt: new Date().toISOString(),
    freshnessWindow: 900,
    source: 'bezhas-oracle',
    markets: [
        { chainId: 137, price: 0.0075, liquidityUsd: 42000, pool: 'QuickSwap V3', status: 'active' },
        { chainId: 56, price: null, liquidityUsd: 0, pool: 'PancakeSwap V3', status: 'pending' },
    ],
    ...over,
});

/** El estado vive en data-state; es lo que colorea el punto y la etiqueta. */
const stateOf = (c: HTMLElement) => c.querySelector('[data-state]')?.getAttribute('data-state');

beforeEach(() => mockUseOracle.mockReset());

describe('OraclePanel', () => {
    it('con lectura fresca muestra el precio como vigente', () => {
        mockUseOracle.mockReturnValue({ data: payload(), error: undefined });
        const { container } = render(<OraclePanel contracts={contracts} />);

        expect(stateOf(container)).toBe('live');
        expect(screen.getByText('En vivo')).toBeInTheDocument();
        // Aparece dos veces: en el titular y en la fila del mercado de Polygon.
        expect(screen.getAllByText('$0.0075')).toHaveLength(2);
        expect(screen.getByText('-1.20% 24 h')).toBeInTheDocument();
    });

    it('fuera de la ventana de frescura la marca obsoleta, no vigente', () => {
        const old = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
        mockUseOracle.mockReturnValue({
            data: payload({ updatedAt: old, tokens: { BEZ: { priceUSD: 0.0075, change24h: 0, updatedAt: old } } }),
            error: undefined,
        });
        const { container } = render(<OraclePanel contracts={contracts} />);

        expect(stateOf(container)).toBe('stale');
        expect(screen.getByText('Obsoleto')).toBeInTheDocument();
        expect(screen.getByText(/fuera de ventana, no se considera vigente/)).toBeInTheDocument();
    });

    it('respeta la ventana que publica el backend, no una fija', () => {
        // 10 minutos de antiguedad: dentro de los 900 s por defecto, fuera de 300.
        const t = new Date(Date.now() - 600 * 1000).toISOString();
        const data = payload({
            updatedAt: t,
            freshnessWindow: 300,
            tokens: { BEZ: { priceUSD: 0.0075, change24h: 0, updatedAt: t } },
        });
        mockUseOracle.mockReturnValue({ data, error: undefined });
        const { container } = render(<OraclePanel contracts={contracts} />);

        expect(stateOf(container)).toBe('stale');
    });

    it('sin precio dice que el oraculo esta pendiente en vez de inventarse uno', () => {
        mockUseOracle.mockReturnValue({
            data: payload({ tokens: { BEZ: { priceUSD: null, change24h: 0 } }, bezCoinPriceUSD: null }),
            error: undefined,
        });
        const { container } = render(<OraclePanel contracts={contracts} />);

        expect(stateOf(container)).toBe('down');
        expect(screen.getByText('Oraculo pendiente')).toBeInTheDocument();
        expect(screen.getByText(/a la espera del primer par BEZ\/USDC/)).toBeInTheDocument();
    });

    it('si el oraculo no responde tampoco pinta un precio', () => {
        mockUseOracle.mockReturnValue({ data: undefined, error: new Error('network') });
        const { container } = render(<OraclePanel contracts={contracts} />);

        expect(stateOf(container)).toBe('down');
        expect(screen.getByText('Sin dato')).toBeInTheDocument();
    });

    it('acepta un payload sin markets (backend anterior) sin romperse', () => {
        const data = payload();
        delete (data as Record<string, unknown>).markets;
        delete (data as Record<string, unknown>).freshnessWindow;
        mockUseOracle.mockReturnValue({ data, error: undefined });
        const { container } = render(<OraclePanel contracts={contracts} />);

        expect(stateOf(container)).toBe('live');
        // Las dos tarjetas de contrato siguen ahi, en pendiente.
        expect(screen.getAllByText('Pendiente de pool')).toHaveLength(2);
    });

    it('pinta cada mercado en su tarjeta de cadena', () => {
        mockUseOracle.mockReturnValue({ data: payload(), error: undefined });
        render(<OraclePanel contracts={contracts} />);

        expect(screen.getByText('QuickSwap V3 · activo')).toBeInTheDocument();
        expect(screen.getByText('$42.0K')).toBeInTheDocument();
        expect(screen.getByText('PancakeSwap V3 · pendiente')).toBeInTheDocument();
        expect(screen.getByText('Sin liquidez')).toBeInTheDocument();
    });

    it('muestra las direcciones reales de los contratos con su explorador', () => {
        mockUseOracle.mockReturnValue({ data: payload(), error: undefined });
        render(<OraclePanel contracts={contracts} />);

        expect(screen.getByText('0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8')).toBeInTheDocument();
        expect(screen.getByText('0x8a1e3930fde1f151471c368fdbb39f3f63a65b55')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Polygonscan/ })).toHaveAttribute(
            'href',
            'https://polygonscan.com/token/0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
        );
        expect(screen.getByRole('link', { name: /BscScan/ })).toHaveAttribute(
            'href',
            'https://bscscan.com/token/0x8a1e3930fde1f151471c368fdbb39f3f63a65b55',
        );
    });

    it('el aviso MiCA acompana siempre al precio', () => {
        mockUseOracle.mockReturnValue({ data: payload(), error: undefined });
        render(<OraclePanel contracts={contracts} />);

        expect(screen.getByText(/no es asesoramiento financiero/)).toBeInTheDocument();
        expect(screen.getByText(/token de utilidad/)).toBeInTheDocument();
    });
});
