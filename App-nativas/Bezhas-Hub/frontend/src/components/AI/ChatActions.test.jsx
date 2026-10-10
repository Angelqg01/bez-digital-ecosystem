import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { ChatActionCards, ChatActionsMenu } from './ChatActionCards';
import { ChatActionDialog } from './ChatActionDialog';

const a = (over = {}) => ({ id: 'staking', category: 'ecosystem', categoryLabel: 'Apps del ecosistema', kind: 'navigate', title: 'Staking', description: 'Deposita BEZ', sensitive: true, locked: false, ...over });

describe('ChatActionCards', () => {
    test('no pinta nada sin acciones', () => {
        const { container } = render(<ChatActionCards actions={[]} onOpen={() => {}} />);
        expect(container).toBeEmptyDOMElement();
    });

    test('pinta tarjetas con título y descripción, y avisa al abrir', () => {
        const onOpen = vi.fn();
        render(<ChatActionCards actions={[a(), a({ id: 'wallet', title: 'Wallet', description: 'Saldos' })]} onOpen={onOpen} />);
        fireEvent.click(screen.getByText('Staking'));
        expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'staking' }));
        expect(screen.getByText('Saldos')).toBeInTheDocument();
    });

    test('las bloqueadas indican que requieren un plan de pago y siguen siendo pulsables', () => {
        const onOpen = vi.fn();
        render(<ChatActionCards actions={[a({ id: 'exclusive_docs', title: 'Docs', locked: true })]} onOpen={onOpen} />);
        expect(screen.getByText('Requiere un plan de pago')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Docs'));
        expect(onOpen).toHaveBeenCalled();
    });

    test('disabled bloquea los botones', () => {
        render(<ChatActionCards actions={[a()]} onOpen={() => {}} disabled />);
        expect(screen.getByRole('button')).toBeDisabled();
    });
});

describe('ChatActionsMenu', () => {
    test('agrupa por categoría y muestra todas las acciones', () => {
        render(<ChatActionsMenu actions={[a(), a({ id: 'settings', category: 'account', categoryLabel: 'Cuenta y planes', title: 'Ajustes' })]} onOpen={() => {}} />);
        expect(screen.getByText(/Apps del ecosistema/)).toBeInTheDocument();
        expect(screen.getByText(/Cuenta y planes/)).toBeInTheDocument();
        expect(screen.getAllByRole('button')).toHaveLength(2);
    });

    test('catálogo vacío', () => {
        render(<ChatActionsMenu actions={[]} onOpen={() => {}} />);
        expect(screen.getByText('No hay acciones disponibles.')).toBeInTheDocument();
    });
});

describe('ChatActionDialog', () => {
    const base = { plans: [], currentPlan: '', docs: [], onGo: vi.fn(), onClose: vi.fn(), onUpgrade: vi.fn(), onAskDoc: vi.fn() };
    const result = { id: 'staking', kind: 'navigate', href: '/dashboard/farming', sensitive: true, external: true };

    test('confirmación sensible: aviso de seguridad y «Abrir» entrega el resultado del servidor', () => {
        const onGo = vi.fn();
        render(<ChatActionDialog {...base} onGo={onGo} dialog={{ type: 'confirm', action: a(), result }} />);
        expect(screen.getByRole('dialog', { name: 'Staking' })).toBeInTheDocument();
        expect(screen.getByText(/no ejecuta operaciones ni te pedirá claves privadas/i)).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('go-btn'));
        expect(onGo).toHaveBeenCalledWith(result);
    });

    test('confirmación no sensible: sin aviso', () => {
        render(<ChatActionDialog {...base} dialog={{ type: 'confirm', action: a({ sensitive: false }), result }} />);
        expect(screen.queryByText(/no ejecuta operaciones/i)).not.toBeInTheDocument();
    });

    test('Escape, botón de cerrar y clic fuera cierran; el clic dentro no', () => {
        const onClose = vi.fn();
        const { container } = render(<ChatActionDialog {...base} onClose={onClose} dialog={{ type: 'confirm', action: a(), result }} />);
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
        fireEvent.click(screen.getByLabelText('Cerrar ventana'));
        expect(onClose).toHaveBeenCalledTimes(2);
        fireEvent.click(screen.getByRole('dialog'));
        expect(onClose).toHaveBeenCalledTimes(2);
        fireEvent.click(container.firstChild);
        expect(onClose).toHaveBeenCalledTimes(3);
    });

    test('bloqueada: mensaje y «Ver planes» llama a onUpgrade con el id de mejora', () => {
        const onUpgrade = vi.fn();
        render(<ChatActionDialog {...base} onUpgrade={onUpgrade} dialog={{ type: 'locked', action: a(), message: 'Requiere plan', upgradeActionId: 'subscribe_plans' }} />);
        expect(screen.getByRole('dialog', { name: 'Función bloqueada' })).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('upgrade-btn'));
        expect(onUpgrade).toHaveBeenCalledWith('subscribe_plans');
    });

    test('bloqueada sin enlace de mejora: sin botón «Ver planes»', () => {
        render(<ChatActionDialog {...base} dialog={{ type: 'locked', action: a(), message: 'Sin permiso' }} />);
        expect(screen.queryByTestId('upgrade-btn')).not.toBeInTheDocument();
    });

    test('planes: lista con precio, marca el plan actual y permite ir a suscribirse', () => {
        const onGo = vi.fn();
        const plans = [{ id: 'starter', name: 'Starter', priceMonthly: 0 }, { id: 'creator', name: 'Creator Pro', priceMonthly: 99, currency: 'EUR', description: 'Para creadores' }];
        render(<ChatActionDialog {...base} onGo={onGo} plans={plans} currentPlan="starter" dialog={{ type: 'plans', action: a({ kind: 'plans', title: 'Suscribirme' }), result: { href: '/vip', kind: 'plans' } }} />);
        expect(screen.getByText('Gratis')).toBeInTheDocument();
        expect(screen.getByText('99 EUR/mes')).toBeInTheDocument();
        expect(screen.getByText('tu plan')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('go-btn'));
        expect(onGo).toHaveBeenCalledWith({ href: '/vip', kind: 'plans' });
    });

    test('planes sin datos: mensaje de carga fallida', () => {
        render(<ChatActionDialog {...base} dialog={{ type: 'plans', action: a({ kind: 'plans' }), result: { href: '/vip' } }} />);
        expect(screen.getByText('No se pudieron cargar los planes.')).toBeInTheDocument();
    });

    test('documentos: lista y «preguntar» envía el título; vacío muestra ayuda', () => {
        const onAskDoc = vi.fn();
        const { rerender } = render(<ChatActionDialog {...base} onAskDoc={onAskDoc} docs={[{ id: 'd1', title: 'Manual', classification: 'INTERNAL' }]} dialog={{ type: 'docs', action: a({ kind: 'docs', title: 'Docs' }), result: { href: '/docs' } }} />);
        fireEvent.click(screen.getByText('Manual'));
        expect(onAskDoc).toHaveBeenCalledWith('Manual');
        rerender(<ChatActionDialog {...base} docs={[]} dialog={{ type: 'docs', action: a({ kind: 'docs', title: 'Docs' }), result: { href: '/docs' } }} />);
        expect(screen.getByText(/Todavía no hay documentos/)).toBeInTheDocument();
    });

    test('error: muestra el mensaje y se puede cerrar', () => {
        const onClose = vi.fn();
        render(<ChatActionDialog {...base} onClose={onClose} dialog={{ type: 'error', message: 'Destino no permitido.' }} />);
        expect(screen.getByText('Destino no permitido.')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Cerrar'));
        expect(onClose).toHaveBeenCalled();
    });
});
