import React from 'react';
import SafeGoogleLogin from './SafeGoogleLogin';
import http from '../../services/http';

/**
 * OAuthButtons
 * Renders Google, GitHub and LinkedIn sign-in buttons in a unified style.
 *
 * Props
 *  onSuccess(authData)  – called when any provider succeeds (receives { user, token })
 *  onError(msg)         – called when a provider fails
 *  onNavigate           – optional callback after success (defaults to window.location)
 *  mode                 – 'register' | 'login' (cosmetic only)
 */
export default function OAuthButtons({ onSuccess, onError, mode = 'login' }) {
    /* ── Google ──────────────────────────────────────── */
    const handleGoogleSuccess = async (credentialResponse) => {
        try {
            const { data } = await http.post('/api/auth/google', {
                idToken: credentialResponse.credential,
            });
            if (data.token) {
                onSuccess(data);
            } else {
                onError && onError(data.error || 'Error con Google');
            }
        } catch (err) {
            onError && onError('Error de conexión con Google');
        }
    };

    /* ── GitHub ──────────────────────────────────────── */
    const handleGitHub = () => {
        const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
        if (!clientId) { onError && onError('GitHub OAuth no configurado'); return; }
        const redirectUri = `${window.location.origin}/auth/github/callback`;
        window.location.href =
            `https://github.com/login/oauth/authorize?client_id=${clientId}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user%20user:email`;
    };

    /* ── LinkedIn ────────────────────────────────────── */
    const handleLinkedIn = () => {
        const clientId = import.meta.env.VITE_LINKEDIN_CLIENT_ID;
        if (!clientId) { onError && onError('LinkedIn OAuth no configurado'); return; }
        const redirectUri = encodeURIComponent(`${window.location.origin}/auth/linkedin/callback`);
        const state = Math.random().toString(36).slice(2);
        sessionStorage.setItem('linkedin_oauth_state', state);
        window.location.href =
            `https://www.linkedin.com/oauth/v2/authorization?response_type=code` +
            `&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}` +
            `&scope=openid%20profile%20email`;
    };

    const label = mode === 'register' ? 'Registrarse' : 'Iniciar sesión';

    return (
        <div className="space-y-2 w-full">
            {/* Google — uses the official GSI button */}
            <div className="flex justify-center">
                <SafeGoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => onError && onError('Error con Google')}
                    useOneTap={false}
                    type="standard"
                    theme="filled_black"
                    size="large"
                    text={mode === 'register' ? 'signup_with' : 'signin_with'}
                    shape="rectangular"
                    logo_alignment="left"
                />
            </div>

            {/* GitHub */}
            <button
                type="button"
                onClick={handleGitHub}
                className="
                    w-full flex items-center justify-center gap-3 py-2.5 px-4
                    bg-[#161b22] hover:bg-[#21262d]
                    border border-[#30363d] hover:border-[#8b949e]
                    rounded-lg text-sm font-medium text-white
                    transition-all duration-200
                "
            >
                <GitHubIcon />
                {label} con GitHub
            </button>

            {/* LinkedIn */}
            <button
                type="button"
                onClick={handleLinkedIn}
                className="
                    w-full flex items-center justify-center gap-3 py-2.5 px-4
                    bg-[#0a66c2] hover:bg-[#004182]
                    rounded-lg text-sm font-medium text-white
                    transition-all duration-200
                "
            >
                <LinkedInIcon />
                {label} con LinkedIn
            </button>
        </div>
    );
}

/* ── SVG icons ─────────────────────────────────── */

function GitHubIcon() {
    return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
        </svg>
    );
}

function LinkedInIcon() {
    return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
    );
}
