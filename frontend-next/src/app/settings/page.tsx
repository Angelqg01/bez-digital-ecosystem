/* eslint-disable */
"use client";

import React, { useState } from 'react';
import {
    Settings as SettingsIcon, User, Bell, Shield, Globe, Palette, Eye, EyeOff,
    Lock, Smartphone, Mail, Save, Loader2, Check, Moon, Sun, Monitor
} from 'lucide-react';
import { useAccount, useDisconnect } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { toast } from 'react-hot-toast';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type Section = 'profile' | 'notifications' | 'security' | 'privacy' | 'appearance';

export default function SettingsPage() {
    const { address, isConnected } = useAccount();
    const { disconnect } = useDisconnect();
    const { open } = useWeb3Modal();

    const [activeSection, setActiveSection] = useState<Section>('profile');
    const [isSaving, setIsSaving] = useState(false);

    // Profile state
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [email, setEmail] = useState('');

    // Notification prefs
    const [notifTx, setNotifTx] = useState(true);
    const [notifSocial, setNotifSocial] = useState(true);
    const [notifMarketing, setNotifMarketing] = useState(false);
    const [notifEmail, setNotifEmail] = useState(false);

    // Security
    const [twoFA, setTwoFA] = useState(false);

    // Privacy
    const [balanceVisible, setBalanceVisible] = useState(true);
    const [profilePublic, setProfilePublic] = useState(true);

    // Appearance
    const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system');
    const [language, setLanguage] = useState('es');

    const handleSave = () => {
        setIsSaving(true);
        setTimeout(() => {
            setIsSaving(false);
            toast.success('ConfiguraciÃ³n guardada');
        }, 800);
    };

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh]">
                <div className="bg-white dark:bg-gray-900 p-12 rounded-3xl shadow-soft-lg border border-light-border dark:border-gray-800 text-center max-w-md">
                    <SettingsIcon size={48} className="text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                    <h2 className="text-2xl font-display font-bold text-gray-900 dark:text-white mb-4">ConfiguraciÃ³n</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">Conecta tu wallet para acceder.</p>
                    <button onClick={() => open()} className="bg-gradient-primary text-white font-bold py-3 px-8 rounded-xl shadow-button hover:opacity-90 transition-opacity">Conectar Wallet</button>
                </div>
            </div>
        );
    }

    const sections = [
        { id: 'profile' as Section, label: 'Perfil', icon: User },
        { id: 'notifications' as Section, label: 'Notificaciones', icon: Bell },
        { id: 'security' as Section, label: 'Seguridad', icon: Shield },
        { id: 'privacy' as Section, label: 'Privacidad', icon: Eye },
        { id: 'appearance' as Section, label: 'Apariencia', icon: Palette },
    ];

    const Toggle = ({ checked, onToggle }: { checked: boolean; onToggle: () => void }) => (
        <button onClick={onToggle} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
    );

    return (
        <div className="container mx-auto px-6 py-8 max-w-5xl">
            <h1 className="text-3xl font-display font-bold text-gray-900 dark:text-white mb-8 flex items-center gap-3">
                <SettingsIcon className="text-primary-500" /> ConfiguraciÃ³n
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                {/* Sidebar */}
                <div className="space-y-1">
                    {sections.map(s => (
                        <button key={s.id} onClick={() => setActiveSection(s.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeSection === s.id ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                            <s.icon size={18} /> {s.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="md:col-span-3 bg-white dark:bg-gray-900 rounded-2xl border border-light-border dark:border-gray-800 p-8 shadow-soft-lg">
                    {/* Profile */}
                    {activeSection === 'profile' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Perfil</h2>
                            <div><label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Nombre de usuario</label>
                                <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder={`User_${address?.slice(2,8)}`} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl py-3 px-4 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500" /></div>
                            <div><label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Correo electrÃ³nico</label>
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl py-3 px-4 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500" /></div>
                            <div><label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">BiografÃ­a</label>
                                <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} maxLength={500} placeholder="CuÃ©ntanos sobre ti..." className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl py-3 px-4 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
                                <p className="text-xs text-gray-400 mt-1 text-right">{bio.length}/500</p></div>
                        </div>
                    )}

                    {/* Notifications */}
                    {activeSection === 'notifications' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Notificaciones</h2>
                            {[
                                { label: 'Transacciones', desc: 'Alertas de pagos, escrows y transferencias BEZ', checked: notifTx, toggle: () => setNotifTx(!notifTx) },
                                { label: 'Social', desc: 'Likes, comentarios y nuevos seguidores', checked: notifSocial, toggle: () => setNotifSocial(!notifSocial) },
                                { label: 'Marketing', desc: 'Novedades, ofertas y actualizaciones del ecosistema', checked: notifMarketing, toggle: () => setNotifMarketing(!notifMarketing) },
                                { label: 'Email', desc: 'Resumen semanal y alertas importantes por email', checked: notifEmail, toggle: () => setNotifEmail(!notifEmail) },
                            ].map((n, i) => (
                                <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                                    <div><p className="font-semibold text-gray-900 dark:text-white text-sm">{n.label}</p><p className="text-xs text-gray-500">{n.desc}</p></div>
                                    <Toggle checked={n.checked} onToggle={n.toggle} />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Security */}
                    {activeSection === 'security' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Seguridad</h2>
                            <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800">
                                <div><p className="font-semibold text-gray-900 dark:text-white text-sm">AutenticaciÃ³n 2FA</p><p className="text-xs text-gray-500">Protege tu cuenta con un segundo factor</p></div>
                                <Toggle checked={twoFA} onToggle={() => setTwoFA(!twoFA)} />
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                                <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Lock size={16} className="text-primary-500" /> Wallet conectada</p>
                                <p className="text-xs text-gray-500 mt-1 font-mono">{address}</p>
                            </div>
                            <div className="pt-4"><button onClick={() => { disconnect(); toast.success('Desconectado'); }} className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 py-3 px-6 rounded-xl font-semibold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">ðŸ” Desconectar Wallet</button></div>
                        </div>
                    )}

                    {/* Privacy */}
                    {activeSection === 'privacy' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Privacidad</h2>
                            {[
                                { label: 'Balance visible', desc: 'Otros usuarios pueden ver tu balance BEZ', checked: balanceVisible, toggle: () => setBalanceVisible(!balanceVisible) },
                                { label: 'Perfil pÃºblico', desc: 'Tu perfil aparece en bÃºsquedas', checked: profilePublic, toggle: () => setProfilePublic(!profilePublic) },
                            ].map((p, i) => (
                                <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                                    <div><p className="font-semibold text-gray-900 dark:text-white text-sm">{p.label}</p><p className="text-xs text-gray-500">{p.desc}</p></div>
                                    <Toggle checked={p.checked} onToggle={p.toggle} />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Appearance */}
                    {activeSection === 'appearance' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Apariencia</h2>
                            <div>
                                <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">Tema</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { id: 'system' as const, label: 'Sistema', icon: Monitor },
                                        { id: 'light' as const, label: 'Claro', icon: Sun },
                                        { id: 'dark' as const, label: 'Oscuro', icon: Moon },
                                    ].map(t => (
                                        <button key={t.id} onClick={() => setTheme(t.id)} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${theme === t.id ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}>
                                            <t.icon size={24} className={theme === t.id ? 'text-primary-500' : 'text-gray-400'} />
                                            <span className={`text-sm font-medium ${theme === t.id ? 'text-primary-600 dark:text-primary-400' : 'text-gray-600 dark:text-gray-400'}`}>{t.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Idioma</label>
                                <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl py-3 px-4 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500">
                                    <option value="es">ðŸ‡ªðŸ‡¸ EspaÃ±ol</option>
                                    <option value="en">ðŸ‡ºðŸ‡¸ English</option>
                                    <option value="pt">ðŸ‡§ðŸ‡· PortuguÃªs</option>
                                    <option value="de">ðŸ‡©ðŸ‡ª Deutsch</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Save Button */}
                    <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 flex justify-end">
                        <button onClick={handleSave} disabled={isSaving} className="bg-gradient-primary text-white font-bold py-3 px-8 rounded-xl shadow-button hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-2">
                            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

