/** @jest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react';
import ChatAppShortcuts from '@/components/ChatAppShortcuts';
import type { ChatAction } from '@/lib/ai-workspace';

const app = (id: string, title: string, extra: Partial<ChatAction> = {}): ChatAction => ({
    id, kind: 'app', title, description: `desc ${title}`, sensitive: false, locked: false, ...extra,
});

describe('ChatAppShortcuts', () => {
    it('pinta una tarjeta por app y abre la pulsada', () => {
        const onOpen = jest.fn();
        render(<ChatAppShortcuts apps={[app('app_hub', 'BeZhas Hub'), app('app_energy', 'BEZ Energy')]} onOpen={onOpen} />);
        fireEvent.click(screen.getByRole('button', { name: 'Abrir BEZ Energy' }));
        expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'app_energy' }));
    });
    it('marca como próximamente la app no disponible', () => {
        render(<ChatAppShortcuts apps={[app('app_cargolink', 'BZ CargoLink', { unavailable: true })]} onOpen={jest.fn()} />);
        expect(screen.getByText('Próximamente')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'BZ CargoLink (no disponible)' })).toBeTruthy();
    });
    it('ignora las acciones que no son apps y no pinta nada sin apps', () => {
        const { container } = render(<ChatAppShortcuts apps={[{ ...app('buy_bez', 'Comprar BEZ'), kind: 'navigate' }]} onOpen={jest.fn()} />);
        expect(container.firstChild).toBeNull();
    });
});
