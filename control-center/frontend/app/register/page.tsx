'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function RegisterPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const returnUrl = searchParams.get('returnUrl') || '/dashboard';

    const [form, setForm] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const validate = (): boolean => {
        const errors: Record<string, string> = {};

        if (!form.username.trim()) errors.username = 'El nombre de usuario es obligatorio';
        if (!form.email.trim()) errors.email = 'El email es obligatorio';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
            errors.email = 'Introduce un email válido';

        if (!form.password) errors.password = 'La contraseña es obligatoria';
        else if (form.password.length < 6)
            errors.password = 'Mínimo 6 caracteres';

        if (form.password !== form.confirmPassword)
            errors.confirmPassword = 'Las contraseñas no coinciden';

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!validate()) return;

        try {
            setLoading(true);
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: form.username.trim(),
                    email: form.email.trim(),
                    password: form.password,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Error al registrar.');
                return;
            }

            // Save auth state
            localStorage.setItem('bezhas_token', data.token);
            localStorage.setItem('bezhas_user', JSON.stringify(data.user));
            document.cookie = `bezhas_token=${data.token}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`;

            router.push(returnUrl);
        } catch {
            setError('Error de conexión. Inténtalo de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [field]: e.target.value });
        // Clear field error on change
        if (fieldErrors[field]) {
            setFieldErrors({ ...fieldErrors, [field]: '' });
        }
    };

    // Password strength indicator
    const getPasswordStrength = (): { label: string; color: string; width: string } => {
        const len = form.password.length;
        if (len === 0) return { label: '', color: '', width: '0%' };
        if (len < 6) return { label: 'Débil', color: 'bg-rose-500', width: '25%' };
        if (len < 10) return { label: 'Aceptable', color: 'bg-amber-500', width: '50%' };
        if (len < 14) return { label: 'Fuerte', color: 'bg-emerald-500', width: '75%' };
        return { label: 'Muy fuerte', color: 'bg-emerald-400', width: '100%' };
    };

    const strength = getPasswordStrength();

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden text-white">
            {/* Background effects */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500 rounded-full blur-[200px] opacity-10" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600 rounded-full blur-[200px] opacity-10" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-violet-600 rounded-full blur-[250px] opacity-5" />

            <div className="relative z-10 w-full max-w-md mx-4">
                {/* Logo */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-block">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center text-white font-black text-2xl shadow-2xl shadow-emerald-500/20 mb-4 hover:scale-105 transition-transform">
                            B
                        </div>
                    </Link>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight">
                        Crear <span className="bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">Cuenta</span>
                    </h1>
                    <p className="text-slate-400 mt-2 text-sm">
                        Regístrate para acceder al ecosistema BeZhas
                    </p>
                </div>

                {/* Register Card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[28px] p-8 shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2.5">
                                <span className="text-rose-400 shrink-0 mt-0.5">⚠️</span>
                                <p className="text-sm text-rose-300">{error}</p>
                            </div>
                        )}

                        {/* Username */}
                        <div>
                            <label htmlFor="register-username" className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                                Nombre de usuario
                            </label>
                            <input
                                id="register-username"
                                type="text"
                                value={form.username}
                                onChange={handleChange('username')}
                                placeholder="Tu nombre de usuario"
                                className={`w-full px-4 py-3 rounded-xl bg-white/5 text-white border ${fieldErrors.username ? 'border-rose-500/50' : 'border-white/10'} focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 placeholder:text-slate-600 transition-all`}
                                autoComplete="username"
                            />
                            {fieldErrors.username && (
                                <p className="text-rose-400 text-xs mt-1">{fieldErrors.username}</p>
                            )}
                        </div>

                        {/* Email */}
                        <div>
                            <label htmlFor="register-email" className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                                Email
                            </label>
                            <input
                                id="register-email"
                                type="email"
                                value={form.email}
                                onChange={handleChange('email')}
                                placeholder="tu@email.com"
                                className={`w-full px-4 py-3 rounded-xl bg-white/5 text-white border ${fieldErrors.email ? 'border-rose-500/50' : 'border-white/10'} focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 placeholder:text-slate-600 transition-all`}
                                autoComplete="email"
                            />
                            {fieldErrors.email && (
                                <p className="text-rose-400 text-xs mt-1">{fieldErrors.email}</p>
                            )}
                        </div>

                        {/* Password */}
                        <div>
                            <label htmlFor="register-password" className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                                Contraseña
                            </label>
                            <input
                                id="register-password"
                                type="password"
                                value={form.password}
                                onChange={handleChange('password')}
                                placeholder="Mínimo 6 caracteres"
                                className={`w-full px-4 py-3 rounded-xl bg-white/5 text-white border ${fieldErrors.password ? 'border-rose-500/50' : 'border-white/10'} focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 placeholder:text-slate-600 transition-all`}
                                autoComplete="new-password"
                            />
                            {fieldErrors.password && (
                                <p className="text-rose-400 text-xs mt-1">{fieldErrors.password}</p>
                            )}
                            {/* Strength meter */}
                            {form.password.length > 0 && (
                                <div className="mt-2">
                                    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${strength.color} rounded-full transition-all duration-300`}
                                            style={{ width: strength.width }}
                                        />
                                    </div>
                                    <p className={`text-[10px] mt-1 font-semibold ${strength.color === 'bg-rose-500' ? 'text-rose-400' : strength.color === 'bg-amber-500' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                        {strength.label}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label htmlFor="register-confirm" className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                                Confirmar contraseña
                            </label>
                            <input
                                id="register-confirm"
                                type="password"
                                value={form.confirmPassword}
                                onChange={handleChange('confirmPassword')}
                                placeholder="Repite la contraseña"
                                className={`w-full px-4 py-3 rounded-xl bg-white/5 text-white border ${fieldErrors.confirmPassword ? 'border-rose-500/50' : 'border-white/10'} focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 placeholder:text-slate-600 transition-all`}
                                autoComplete="new-password"
                            />
                            {fieldErrors.confirmPassword && (
                                <p className="text-rose-400 text-xs mt-1">{fieldErrors.confirmPassword}</p>
                            )}
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-blue-600 text-white rounded-xl py-4 px-6 font-bold text-sm transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 mt-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Creando cuenta...
                                </>
                            ) : (
                                <>
                                    <span>🚀</span>
                                    Crear Cuenta
                                </>
                            )}
                        </button>
                    </form>

                    {/* Link to Login */}
                    <p className="text-center text-slate-400 text-sm mt-6">
                        ¿Ya tienes cuenta?{' '}
                        <Link
                            href="/login"
                            className="text-emerald-400 font-semibold hover:text-emerald-300 transition-colors"
                        >
                            Inicia sesión
                        </Link>
                    </p>

                    {/* Demo Account Notice */}
                    <div className="mt-5 flex items-center gap-2.5 p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                        <span className="text-blue-400 shrink-0">💡</span>
                        <p className="text-[11px] text-blue-300/80 leading-relaxed">
                            <strong>Demo:</strong> También puedes iniciar sesión con{' '}
                            <span className="font-mono text-blue-300">demo@bez.digital</span> / <span className="font-mono text-blue-300">demo1234</span>
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-slate-600 text-xs mt-6 font-medium">
                    BeZhas Blockchain &copy; {new Date().getFullYear()} &mdash; Sovereign L2 Infrastructure
                </p>
            </div>
        </div>
    );
}

export default function RegisterPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
            </div>
        }>
            <RegisterPageContent />
        </Suspense>
    );
}
