import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, ExternalLink, Loader2, Lock, ShieldCheck } from 'lucide-react';
import axios from 'axios';
import { apiUrl } from '../../utils/apiBase';
import { track } from '../../lib/funnelEvents';
import { STEPS, STEPS_BEFORE_EMAIL, nextIndex, toProfile, isEmail, labelOf } from '../../lib/onboardingFlow';

const chip = 'rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:border-indigo-400 hover:bg-indigo-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800';
const field = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100';
const primary = 'flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60';

const NIVELES = { lectura: 'solo lectura', preparacion: 'preparar operaciones (sin ejecutarlas)', ejecucion_con_aprobacion: 'ejecutar con aprobación humana' };
const PROGRESS_KEY = 'bz_onb_progress';
const IDLE_MS = 60_000;
/** Solo se guarda el avance ANTES del email, y solo respuestas del catálogo: nunca el email ni nada sensible. */
const loadProgress = () => {
    try {
        const p = JSON.parse(window.sessionStorage.getItem(PROGRESS_KEY) || 'null');
        return p && p.answers && Number.isInteger(p.index) && p.index < STEPS_BEFORE_EMAIL ? p : null;
    } catch { return null; }
};
const saveProgress = (answers, index) => { try { window.sessionStorage.setItem(PROGRESS_KEY, JSON.stringify({ answers, index })); } catch { /* sin storage */ } };
const clearProgress = () => { try { window.sessionStorage.removeItem(PROGRESS_KEY); } catch { /* sin storage */ } };

const errorOf = (err, fallback) => (err && err.response && err.response.data && err.response.data.error) || fallback;

/**
 * Cuestionario guiado dentro del chat. Solo pregunta lo no sensible, con opciones cerradas (no hay campo de texto
 * libre salvo el email). La contraseña, el KYB, la custodia y las credenciales se piden en la pantalla segura que
 * se abre al final: aquí nunca.
 */
export default function OnboardingQuestionnaire({ onClose }) {
    const restored = useRef(loadProgress()).current;
    const [answers, setAnswers] = useState(restored ? restored.answers : {});
    const [index, setIndex] = useState(restored ? restored.index : 0);
    const [idle, setIdle] = useState(false);
    const [phase, setPhase] = useState('questions'); // questions | email | result
    const [email, setEmail] = useState('');
    const [consent, setConsent] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [rec, setRec] = useState(null);
    const [secureUrl, setSecureUrl] = useState('');
    const [multi, setMulti] = useState([]);
    const [group, setGroup] = useState({});

    const step = STEPS[index];

    useEffect(() => { track('onboarding_started'); }, []);

    // Avance guardado en la sesión mientras no se haya dado el email.
    useEffect(() => {
        if (phase === 'questions' && index < STEPS_BEFORE_EMAIL) saveProgress(answers, index);
    }, [answers, index, phase]);

    // 60 s sin responder: un aviso discreto dentro del propio formulario (nunca una ventana nueva).
    useEffect(() => {
        setIdle(false);
        if (phase !== 'questions') return undefined;
        const t = setTimeout(() => { setIdle(true); track('nudge_shown', { trigger: 'questionnaire_idle' }); }, IDLE_MS);
        return () => clearTimeout(t);
    }, [index, phase]);
    const total = useMemo(() => STEPS.filter((s) => !s.when || s.when(answers)).length, [answers]);
    const shown = useMemo(() => STEPS.slice(0, index).filter((s) => !s.when || s.when(answers)).length + 1, [index, answers]);

    const recommend = async (all) => {
        const { data } = await axios.post(apiUrl('/api/onboarding/guided/recommend'), { respuestas: toProfile(all) });
        return data.recomendacion;
    };

    const advance = async (all) => {
        setError('');
        track('onboarding_step', { step: step.id });
        // Tras la 4.ª pregunta: email.
        if (index === STEPS_BEFORE_EMAIL - 1 && !secureUrl) { setAnswers(all); setPhase('email'); return; }
        const next = nextIndex(index, all);
        if (next !== -1) { setAnswers(all); setIndex(next); setMulti([]); return; }
        setBusy(true);
        try {
            setAnswers(all);
            setRec(await recommend(all));
            setPhase('result');
            track('onboarding_completed');
            await openSession(all);
        } catch (e) { setError(errorOf(e, 'No se pudo calcular la recomendación.')); } finally { setBusy(false); }
    };

    const openSession = async (all) => {
        const { data } = await axios.post(apiUrl('/api/onboarding/guided/start'), { respuestas: toProfile(all), email: email.trim(), consent: true });
        setSecureUrl(data.url);
    };

    const choose = (value) => advance({ ...answers, [step.id]: value });

    const submitGroup = (e) => {
        e.preventDefault();
        if (step.fields.some((f) => !group[f.id])) { setError('Elige una opción en cada campo.'); return; }
        void advance({ ...answers, ...group });
    };

    const submitEmail = async (e) => {
        e.preventDefault();
        if (!isEmail(email)) { setError('Escribe un email válido.'); return; }
        if (!consent) { setError('Marca la casilla de consentimiento para continuar.'); return; }
        setBusy(true); setError('');
        try {
            // Se guarda ya: si el usuario se va ahora, el enlace seguro con su perfil queda creado.
            await openSession(answers);
            track('onboarding_email_saved');
            clearProgress();
            setPhase('questions');
            const next = nextIndex(index, answers);
            setIndex(next === -1 ? index : next);
        } catch (err) { setError(errorOf(err, 'No se pudo guardar. Inténtalo de nuevo.')); } finally { setBusy(false); }
    };

    const wrap = 'mx-auto w-full max-w-md space-y-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-700';

    if (phase === 'email') {
        return (
            <form onSubmit={submitEmail} className={wrap} data-testid="onb-email" noValidate>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Guarda tu configuración</p>
                <p className="text-xs text-gray-500">Te enviamos el resumen y puedes retomarlo cuando quieras. La contraseña la crearás en una pantalla segura de BeZhas, nunca aquí.</p>
                <input className={field} type="email" name="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="Email corporativo" aria-label="Email corporativo" value={email} onChange={(e) => setEmail(e.target.value)} />
                <label className="flex items-start gap-2 text-[11px] text-gray-500">
                    <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                    <span>Acepto que BeZhas trate mi email y estas respuestas para preparar mi alta y contactarme (RGPD, art. 6.1.a). Puedo retirarlo cuando quiera.</span>
                </label>
                <button disabled={busy} className={primary}>{busy && <Loader2 size={14} className="animate-spin" />} Continuar</button>
                {error && <p role="alert" className="text-center text-xs text-red-600">{error}</p>}
            </form>
        );
    }

    if (phase === 'result' && rec) {
        return (
            <div className={wrap} data-testid="onb-result">
                <p className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100"><Check size={16} className="text-emerald-500" /> Tu configuración recomendada</p>
                <div className="rounded-xl bg-indigo-50 p-3 dark:bg-indigo-950">
                    <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">{rec.planRecomendado.nombre}</p>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400">{rec.coste.mensualEUR} €/mes + IVA ({rec.coste.conIvaEUR} € con IVA)</p>
                </div>
                <ul className="list-disc space-y-1 pl-4 text-xs text-gray-600 dark:text-gray-300">{rec.porQue.map((m) => <li key={m}>{m}</li>)}</ul>
                <p className="text-xs text-gray-600 dark:text-gray-300"><b>SubApps:</b> {rec.subappsSugeridas.join(', ') || '—'}{rec.subappsEnPreparacion.length > 0 && <span className="text-gray-400"> · en preparación: {rec.subappsEnPreparacion.join(', ')}</span>}</p>
                <p className="text-xs text-gray-600 dark:text-gray-300"><b>Nivel de operación:</b> {NIVELES[rec.nivelOperacion] || rec.nivelOperacion}</p>
                <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200"><Lock size={12} /> Se completa en la pantalla segura</p>
                    <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-gray-500">{rec.pendientePantallaSegura.map((m) => <li key={m}>{m}</li>)}</ul>
                </div>
                <p className="text-[11px] text-gray-500">{rec.siguientePaso}</p>
                {secureUrl
                    ? <a href={secureUrl} target="_blank" rel="noopener noreferrer" onClick={() => track('onboarding_link_opened')} className={primary}><ShieldCheck size={14} /> Continuar en la pantalla segura <ExternalLink size={12} /></a>
                    : <p className="text-center text-xs text-gray-400">Preparando el enlace seguro…</p>}
                {error && <p role="alert" className="text-center text-xs text-red-600">{error}</p>}
                {onClose && <button type="button" onClick={onClose} className="block w-full text-center text-[11px] text-gray-400 hover:text-gray-600">Volver al chat</button>}
            </div>
        );
    }

    return (
        <div className={wrap} data-testid="onb-step">
            <div className="flex items-center justify-between text-[11px] text-gray-400">
                <span>Pregunta {shown} de {total}</span>
                {onClose && <button type="button" onClick={onClose} className="hover:text-gray-600">Salir</button>}
            </div>
            <div className="h-1 overflow-hidden rounded bg-gray-100 dark:bg-gray-800"><div className="h-full bg-indigo-500 transition-all" style={{ width: `${(shown / total) * 100}%` }} /></div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{step.title}</p>
            {step.hint && <p className="text-xs text-gray-500">{step.hint}</p>}
            {idle && <p role="status" data-testid="onb-idle" className="text-xs italic text-gray-500">Puedes continuar cuando quieras.{index < STEPS_BEFORE_EMAIL ? ' Tus respuestas se mantienen guardadas en esta sesión.' : ''}</p>}

            {step.kind === 'single' && (
                <div className="flex flex-wrap gap-2">{step.options.map((o) => <button key={o.value} type="button" disabled={busy} onClick={() => void choose(o.value)} className={chip}>{o.label}</button>)}</div>
            )}

            {step.kind === 'multi' && (<>
                <div className="flex flex-wrap gap-2">{step.options.map((o) => {
                    const on = multi.includes(o.value);
                    return <button key={o.value} type="button" aria-pressed={on} onClick={() => setMulti((m) => (on ? m.filter((x) => x !== o.value) : [...m, o.value]))} className={`${chip} ${on ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950' : ''}`}>{o.label}</button>;
                })}</div>
                <button type="button" disabled={busy || multi.length === 0} onClick={() => void advance({ ...answers, [step.id]: multi })} className={primary}>Siguiente <ArrowRight size={14} /></button>
            </>)}

            {step.kind === 'group' && (
                <form onSubmit={submitGroup} className="space-y-2">
                    {step.fields.map((f) => (
                        <label key={f.id} className="block text-[11px] font-semibold text-gray-500">{f.label}
                            <select className={`${field} mt-1 font-normal`} value={group[f.id] || ''} onChange={(e) => setGroup((g) => ({ ...g, [f.id]: e.target.value }))}>
                                <option value="" disabled>Elige…</option>
                                {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </label>
                    ))}
                    <button disabled={busy} className={primary}>Siguiente <ArrowRight size={14} /></button>
                </form>
            )}

            {Object.keys(answers).length > 0 && (
                <p className="text-[11px] text-gray-400">{['cargo', 'estructura', 'sector', 'caso'].filter((k) => answers[k]).map((k) => labelOf(k, answers[k])).join(' · ')}</p>
            )}
            {busy && <p className="flex items-center justify-center gap-2 text-xs text-gray-400"><Loader2 size={14} className="animate-spin" /> Calculando…</p>}
            {error && <p role="alert" className="text-center text-xs text-red-600">{error}</p>}
        </div>
    );
}
