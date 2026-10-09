import React, { useEffect, useRef, useState } from 'react';
import { Loader2, ShieldCheck, Wallet } from 'lucide-react';
import { useAccount, useSignMessage } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { useAuth } from '../../context/AuthContext';
import { authErrorMessage } from '../../lib/chatActions';
import * as authService from '../../services/authService';

const field = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100';

/**
 * Inicio de sesión / registro dentro del chat flotante (sin salir de la página): wallet (SIWE), email y contraseña,
 * y segundo factor (TOTP o código de respaldo). Usa AuthContext con `redirect: false`.
 */
const SIGN_TIMEOUT_MS = 90_000;

export default function ChatAuthCard({ onAuthed, autoSign = false }) {
    const { login, register, verifyLogin2FA, loginOrRegisterWithWallet } = useAuth();
    const { address, isConnected } = useAccount();
    const { open } = useWeb3Modal();
    const { signMessageAsync } = useSignMessage();
    const [mode, setMode] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [twoFactorToken, setTwoFactorToken] = useState('');
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [view, setView] = useState('main'); // main | forgot | reset
    const [resetCode, setResetCode] = useState('');

    const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '';

    const walletLogin = async () => {
        setError('');
        if (!isConnected || !address) { open(); return; }
        setBusy(true);
        try {
            // Si la wallet no responde (ventana cerrada, app sin abrir) no se queda cargando para siempre.
            const signWithTimeout = (message) => Promise.race([
                signMessageAsync({ message }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('La wallet no ha respondido. Ábrela, acepta la firma y vuelve a pulsar el botón.')), SIGN_TIMEOUT_MS)),
            ]);
            const data = await loginOrRegisterWithWallet(address, { redirect: false, signMessage: signWithTimeout });
            onAuthed(data);
        } catch (err) {
            const msg = String((err && (err.shortMessage || err.message)) || '');
            console.error('[chat] login con wallet falló:', err);
            // Sin respuesta del servidor (red, proxy caído) o error de la wallet: se muestra la causa real, no un genérico.
            setError(/reject|denied|cancel/i.test(msg) ? 'Firma cancelada.' : authErrorMessage(err, msg ? msg.slice(0, 160) : 'No se pudo iniciar sesión con la wallet'));
        } finally { setBusy(false); }
    };

    // Con la wallet ya conectada y un mensaje esperando, la firma se pide sola UNA vez por dirección
    // (si se rechaza, queda el botón; no se insiste). «Conectada» no es «con sesión»: falta esta firma.
    const autoTried = useRef('');
    useEffect(() => {
        if (!autoSign || !isConnected || !address || autoTried.current === address) return;
        autoTried.current = address;
        void walletLogin();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoSign, isConnected, address]);

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true); setError('');
        try {
            const data = mode === 'login'
                ? await login(email, password, { redirect: false })
                : await register({ email, password, username: username || undefined, accountType: 'individual' }, { redirect: false });
            // El backend del Hub identifica el segundo factor por userId; otros despliegues emiten un twoFactorToken.
            if (data && data.requires2FA && (data.twoFactorToken || data.userId)) { setTwoFactorToken(data.twoFactorToken || data.userId); setCode(''); return; }
            if (data && data.token) onAuthed(data);
            else setError('Respuesta inesperada del servidor');
        } catch (err) {
            setError(authErrorMessage(err, mode === 'login' ? 'Credenciales inválidas' : 'No se pudo crear la cuenta'));
        } finally { setBusy(false); }
    };

    const submit2fa = async (e) => {
        e.preventDefault();
        setBusy(true); setError('');
        try {
            const data = await verifyLogin2FA(twoFactorToken, code.trim(), { redirect: false });
            onAuthed(data);
        } catch (err) {
            const msg = authErrorMessage(err, 'Código 2FA inválido');
            setError(msg);
            if (err && err.response && err.response.status === 401 && msg.startsWith('Sesión de verificación')) setTwoFactorToken('');
        } finally { setBusy(false); }
    };

    const sendResetCode = async (e) => {
        e.preventDefault();
        setBusy(true); setError('');
        try {
            const r = await authService.forgotPassword(email.trim());
            setNotice(r.message || 'Si el email tiene una cuenta, te hemos enviado un código.');
            setView('reset');
        } catch (err) { setError(authErrorMessage(err, 'No se pudo enviar el código')); } finally { setBusy(false); }
    };

    const doReset = async (e) => {
        e.preventDefault();
        setBusy(true); setError('');
        try {
            await authService.resetPassword(email.trim(), resetCode.trim(), password);
            setNotice('Contraseña actualizada. Ya puedes iniciar sesión.');
            setPassword(''); setResetCode(''); setMode('login'); setView('main');
        } catch (err) { setError(authErrorMessage(err, 'No se pudo restablecer la contraseña')); } finally { setBusy(false); }
    };

    if (twoFactorToken) {
        return (
            <form onSubmit={submit2fa} className="mx-auto w-full max-w-sm space-y-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-700" data-testid="chat-2fa">
                <p className="flex items-center justify-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100"><ShieldCheck size={16} className="text-indigo-500" /> Verificación en dos pasos</p>
                <p className="text-center text-xs text-gray-500">Introduce el código de tu app de autenticación o un código de respaldo.</p>
                <input className={`${field} text-center tracking-widest`} inputMode="numeric" autoComplete="one-time-code" autoFocus required minLength={6} maxLength={8} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" aria-label="Código de verificación" />
                <button disabled={busy || code.trim().length < 6} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                    {busy && <Loader2 size={14} className="animate-spin" />} Verificar
                </button>
                <button type="button" onClick={() => { setTwoFactorToken(''); setCode(''); setError(''); }} className="block w-full text-center text-[11px] text-gray-400 hover:text-gray-600">Volver</button>
                {error && <p role="alert" className="text-center text-xs text-red-600">{error}</p>}
            </form>
        );
    }

    if (view === 'forgot' || view === 'reset') {
        return (
            <form onSubmit={view === 'forgot' ? sendResetCode : doReset} className="mx-auto w-full max-w-sm space-y-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-700" data-testid="chat-reset">
                <p className="text-center text-sm font-semibold text-gray-800 dark:text-gray-100">Recuperar contraseña</p>
                {notice && view === 'reset' && <p className="text-center text-xs text-gray-500">{notice}</p>}
                <input className={field} type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                {view === 'reset' && (<>
                    <input className={`${field} text-center tracking-widest`} required minLength={6} maxLength={20} placeholder="Código del email" value={resetCode} onChange={(e) => setResetCode(e.target.value)} autoComplete="one-time-code" aria-label="Código recibido por email" />
                    <input className={field} type="password" required minLength={8} placeholder="Nueva contraseña (mín. 8)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                </>)}
                <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                    {busy && <Loader2 size={14} className="animate-spin" />} {view === 'forgot' ? 'Enviarme un código' : 'Cambiar contraseña'}
                </button>
                <button type="button" onClick={() => { setView('main'); setError(''); setNotice(''); }} className="block w-full text-center text-[11px] text-gray-400 hover:text-gray-600">Volver</button>
                {error && <p role="alert" className="text-center text-xs text-red-600">{error}</p>}
            </form>
        );
    }

    return (
        <div className="mx-auto w-full max-w-sm space-y-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
            <p className="text-center text-sm font-semibold text-gray-800 dark:text-gray-100">Inicia sesión o crea tu cuenta para chatear</p>
            {notice && <p role="status" className="text-center text-xs text-emerald-600">{notice}</p>}

            <button type="button" onClick={walletLogin} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />}
                {isConnected && address ? `Firmar con ${short}` : 'Conectar wallet'}
            </button>

            <div className="flex items-center gap-2 text-[11px] text-gray-400"><span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />o con email<span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" /></div>

            <form onSubmit={submit} className="space-y-3">
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 text-xs font-semibold dark:bg-gray-800">
                    {['login', 'register'].map((m) => (
                        <button key={m} type="button" onClick={() => { setMode(m); setError(''); }} className={`rounded-lg py-1.5 ${mode === m ? 'bg-white text-indigo-600 shadow dark:bg-gray-900' : 'text-gray-500'}`}>{m === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</button>
                    ))}
                </div>
                {mode === 'register' && <input className={field} placeholder="Nombre de usuario (mín. 3)" minLength={3} maxLength={40} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />}
                <input className={field} type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                <input className={field} type="password" required minLength={8} placeholder="Contraseña (mín. 8)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
                <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                    {busy && <Loader2 size={14} className="animate-spin" />} {mode === 'login' ? 'Entrar' : 'Registrarme'}
                </button>
                {mode === 'login' && <button type="button" onClick={() => { setView('forgot'); setError(''); setNotice(''); }} className="block w-full text-center text-[11px] text-indigo-500 hover:underline">¿Olvidaste tu contraseña?</button>}
            </form>
            {error && <p role="alert" className="text-center text-xs text-red-600">{error}</p>}
        </div>
    );
}
