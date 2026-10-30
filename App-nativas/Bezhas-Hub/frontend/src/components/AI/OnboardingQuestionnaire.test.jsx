import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import axios from 'axios';
import OnboardingQuestionnaire from './OnboardingQuestionnaire';

vi.mock('axios', () => ({ default: { post: vi.fn() } }));
vi.mock('../../lib/funnelEvents', () => ({ track: vi.fn() }));
import { track } from '../../lib/funnelEvents';

const REC = {
    planRecomendado: { id: 'business', nombre: 'Business' }, coste: { mensualEUR: 499, conIvaEUR: 603.79 },
    porQue: ['Sector logistica'], subappsSugeridas: ['cargolink'], subappsEnPreparacion: [], nivelOperacion: 'lectura',
    pendientePantallaSegura: ['Verificar el correo y crear la contraseña, con segundo factor.'], siguientePaso: 'Continúa en la pantalla segura.',
};

const pick = (name) => fireEvent.click(screen.getByRole('button', { name }));

async function hastaElEmail() {
    pick('Dirección / CEO');
    pick('Una sola sociedad');
    const choose = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
    choose(/Sector/, 'logistica'); choose(/Trabajadores/, '11-50'); choose(/Facturación/, '1m-5m'); choose(/Documentos/, '<1k');
    pick('Siguiente');
    pick('Pagos y cobros');
    await screen.findByTestId('onb-email');
}

describe('OnboardingQuestionnaire', () => {
    beforeEach(() => {
        window.sessionStorage.clear();
        track.mockClear();
        axios.post.mockReset();
        axios.post.mockImplementation((url) => Promise.resolve({ data: url.endsWith('/recommend') ? { recomendacion: REC } : { url: '/o/' + 'a'.repeat(64) } }));
    });

    it('pide el email tras la cuarta pregunta y no antes', async () => {
        render(<OnboardingQuestionnaire />);
        expect(screen.queryByTestId('onb-email')).toBeNull();
        await hastaElEmail();
    });

    it('sin consentimiento no guarda nada', async () => {
        render(<OnboardingQuestionnaire />);
        await hastaElEmail();
        fireEvent.change(screen.getByLabelText('Email corporativo'), { target: { value: 'ana@empresa.com' } });
        fireEvent.submit(screen.getByTestId('onb-email'));
        expect(await screen.findByRole('alert')).toHaveTextContent(/consentimiento/);
        expect(axios.post).not.toHaveBeenCalled();
    });

    it('con consentimiento guarda el perfil y el email, sin ningún campo de contraseña', async () => {
        render(<OnboardingQuestionnaire />);
        await hastaElEmail();
        expect(document.querySelector('input[type=password]')).toBeNull();
        fireEvent.change(screen.getByLabelText('Email corporativo'), { target: { value: 'ana@empresa.com' } });
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.submit(screen.getByTestId('onb-email'));
        await screen.findByText('¿Cómo quieres integrar BeZhas?');
        const [url, body] = axios.post.mock.calls[0];
        expect(url).toMatch(/guided\/start$/);
        expect(body).toMatchObject({ email: 'ana@empresa.com', consent: true });
        expect(body.respuestas).toMatchObject({ cargo: 'direccion', sector: 'logistica', caso: 'pagos' });
    });

    it('termina con la recomendación y el enlace a la pantalla segura', async () => {
        render(<OnboardingQuestionnaire />);
        await hastaElEmail();
        fireEvent.change(screen.getByLabelText('Email corporativo'), { target: { value: 'ana@empresa.com' } });
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.submit(screen.getByTestId('onb-email'));
        await screen.findByText('¿Cómo quieres integrar BeZhas?');
        pick('SDK');
        pick('Siguiente');
        pick('Solo consultar y verificar');
        await waitFor(() => expect(screen.getByTestId('onb-result')).toBeInTheDocument());
        expect(screen.getByText('Business')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /pantalla segura/i })).toHaveAttribute('href', '/o/' + 'a'.repeat(64));
    });

    it('guarda el avance en la sesión antes del email, sin guardar el email', async () => {
        const { unmount } = render(<OnboardingQuestionnaire />);
        pick('Dirección / CEO');
        pick('Una sola sociedad');
        const saved = JSON.parse(window.sessionStorage.getItem('bz_onb_progress'));
        expect(saved.answers).toMatchObject({ cargo: 'direccion', estructura: 'unica' });
        expect(JSON.stringify(saved)).not.toMatch(/@/);
        unmount();
        render(<OnboardingQuestionnaire />);
        expect(screen.getByText('Cuéntanos de tu empresa')).toBeInTheDocument();
    });

    it('registra el embudo sin contenido: solo evento y paso', async () => {
        render(<OnboardingQuestionnaire />);
        pick('Dirección / CEO');
        expect(track).toHaveBeenCalledWith('onboarding_started');
        expect(track).toHaveBeenCalledWith('onboarding_step', { step: 'cargo' });
        track.mock.calls.forEach((c) => expect(JSON.stringify(c)).not.toMatch(/direccion|@/));
    });

    it('a los 60 s sin responder muestra un aviso dentro del formulario, no una ventana', () => {
        vi.useFakeTimers();
        try {
            render(<OnboardingQuestionnaire />);
            expect(screen.queryByTestId('onb-idle')).toBeNull();
            act(() => { vi.advanceTimersByTime(60_000); });
            expect(screen.getByTestId('onb-idle')).toHaveTextContent(/cuando quieras/);
            expect(track).toHaveBeenCalledWith('nudge_shown', { trigger: 'questionnaire_idle' });
        } finally { vi.useRealTimers(); }
    });
});
