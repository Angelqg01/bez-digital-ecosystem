/**
 * Tema claro / oscuro.
 *
 * Lo que se protege: que el tema viva en `data-bz-theme` sobre <html> y no en
 * estado de React. Ese atributo lo escribe el script anti-flash antes del primer
 * pintado; si el provider dejara de leerlo o de escribirlo ahi, volveria el salto
 * de tema en cada carga — invisible en desarrollo, muy visible en produccion.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from '@/lib/theme-context';
import ThemeToggle from '@/components/ThemeToggle';

const ATTR = 'data-bz-theme';
const KEY = 'bezhas_theme';

function Probe() {
    const { theme, ready } = useTheme();
    return <span data-testid="probe">{ready ? theme : 'pending'}</span>;
}

/** matchMedia no existe en jsdom; se declara con la preferencia que pida el test. */
function stubMatchMedia(prefersLight: boolean) {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: jest.fn().mockImplementation((q: string) => ({
            matches: q.includes('prefers-color-scheme: light') ? prefersLight : false,
            media: q,
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            addListener: jest.fn(),
            removeListener: jest.fn(),
            dispatchEvent: jest.fn(),
        })),
    });
}

beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute(ATTR);
    stubMatchMedia(false);
});

describe('ThemeProvider', () => {
    it('adopta el tema que el script anti-flash ya dejo en <html>', () => {
        document.documentElement.setAttribute(ATTR, 'light');
        render(
            <ThemeProvider>
                <Probe />
            </ThemeProvider>,
        );
        expect(screen.getByTestId('probe')).toHaveTextContent('light');
    });

    it('sin atributo previo no se inventa un tema claro', () => {
        render(
            <ThemeProvider>
                <Probe />
            </ThemeProvider>,
        );
        expect(screen.getByTestId('probe')).toHaveTextContent('dark');
    });
});

describe('ThemeToggle', () => {
    const setup = () =>
        render(
            <ThemeProvider>
                <ThemeToggle />
                <Probe />
            </ThemeProvider>,
        );

    it('alterna el atributo de <html>, que es lo que lee el CSS', async () => {
        document.documentElement.setAttribute(ATTR, 'dark');
        setup();

        await userEvent.click(screen.getByRole('button'));
        expect(document.documentElement.getAttribute(ATTR)).toBe('light');

        await userEvent.click(screen.getByRole('button'));
        expect(document.documentElement.getAttribute(ATTR)).toBe('dark');
    });

    it('persiste la eleccion para la siguiente visita', async () => {
        document.documentElement.setAttribute(ATTR, 'dark');
        setup();

        await userEvent.click(screen.getByRole('button'));
        expect(localStorage.getItem(KEY)).toBe('light');
    });

    it('anuncia a donde lleva el boton, no donde esta', async () => {
        document.documentElement.setAttribute(ATTR, 'dark');
        setup();

        expect(screen.getByRole('button')).toHaveAccessibleName('Cambiar a tema claro');
        await userEvent.click(screen.getByRole('button'));
        expect(screen.getByRole('button')).toHaveAccessibleName('Cambiar a tema oscuro');
    });

    it('si el almacenamiento esta bloqueado el tema sigue cambiando', async () => {
        document.documentElement.setAttribute(ATTR, 'dark');
        const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceededError'); // Safari en navegacion privada
        });
        setup();

        await userEvent.click(screen.getByRole('button'));
        expect(document.documentElement.getAttribute(ATTR)).toBe('light');
        spy.mockRestore();
    });
});
