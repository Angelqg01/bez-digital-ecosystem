'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, Smartphone, KeyRound, Eye, EyeOff, Save, Key, Plus, Loader2, CheckCircle2, XCircle, Trash2, UserCog, QrCode, ExternalLink } from 'lucide-react';
import { api, ApiError } from '@/lib/api';

interface IdentitySecret {
    id: number;
    name: string;
    service: string;
    updated_at: string;
    _revealed?: string; // transient: only set after reveal
}

interface IdentityNode {
    id: number;
    node_id: string;
    label: string;
    ip_address: string;
    role: string;
    status: 'active' | 'standby' | 'revoked';
    last_seen: string | null;
}

type ToastType = 'ok' | 'err';
interface Toast { type: ToastType; msg: string }

interface QuickAdminStatus {
    success: boolean;
    username: string;
    walletAddress: string;
    twoFactorEnabled: boolean;
    passwordHistoryCount: number;
    lastPasswordRotatedAt: string | null;
    last2FAVerifiedAt: string | null;
}

const SUPERADMIN_NATIVE_APPS = [
    { name: 'BeZhas Wallet', url: 'http://127.0.0.1:3010' },
    { name: 'Gas Tank', url: 'http://127.0.0.1:3011' },
    { name: 'Edge Nodes', url: 'http://127.0.0.1:3012' },
    { name: 'Vision Scan', url: 'http://127.0.0.1:3013' },
    { name: 'BZ Capital', url: 'http://127.0.0.1:3014' },
    { name: 'BZ Prestige', url: 'http://127.0.0.1:3015' },
    { name: 'BZ CargoLink', url: 'http://127.0.0.1:3016' },
    { name: 'BZ Sphere', url: 'http://127.0.0.1:3017' },
];

export default function TabIdentity() {
    // ── State ────────────────────────────────────────────────────────────────
    const [secrets, setSecrets] = useState<IdentitySecret[]>([]);
    const [nodes, setNodes] = useState<IdentityNode[]>([]);
    const [nativeAppsLinks, setNativeAppsLinks] = useState(SUPERADMIN_NATIVE_APPS);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<Toast | null>(null);
    const [revealingId, setRevealingId] = useState<string | null>(null);
    const [showAll, setShowAll] = useState(false);

    // New secret form
    const [newSecret, setNewSecret] = useState({ name: '', value: '', service: '' });
    const [savingSecret, setSavingSecret] = useState(false);

    // New node form
    const [showNodeForm, setShowNodeForm] = useState(false);
    const [newNode, setNewNode] = useState({ label: '', ipAddress: '', role: 'execution' });
    const [savingNode, setSavingNode] = useState(false);

    // DID
    const [did, setDid] = useState<{ did: string; displayName: string; email: string } | null>(null);

    // Quick SuperAdmin credentials
    const [quickStatus, setQuickStatus] = useState<QuickAdminStatus | null>(null);
    const [quickAdmin, setQuickAdmin] = useState({ username: 'superadmin', currentPassword: '', newPassword: '', confirmPassword: '' });
    const [savingQuickAdmin, setSavingQuickAdmin] = useState(false);
    const [twoFactorSetup, setTwoFactorSetup] = useState<{ qrCodeUrl: string; otpauthUrl: string; backupCodes: string[] } | null>(null);
    const [twoFactorCode, setTwoFactorCode] = useState('');
    const [saving2FA, setSaving2FA] = useState(false);

    // ── Helpers ──────────────────────────────────────────────────────────────
    const showToast = (type: ToastType, msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3000);
    };


    const apiErrorMessage = (error: unknown, fallback: string) => (
        error instanceof ApiError ? error.message : fallback
    );

    // ── Data loading ─────────────────────────────────────────────────────────
    const load = useCallback(async () => {
        setLoading(true);
        try {
            // Sin token explícito: la sesión viaja en la cookie HttpOnly
            // bezhas_admin_token, que lib/api manda con credentials:'include'.
            // Antes esto leía localStorage, donde el login nunca llegó a
            // escribir nada, así que el bloque de credenciales SuperAdmin no se
            // cargaba jamás.
            const [secretsRes, nodesRes, didRes, quickRes] = await Promise.allSettled([
                api.get<{ data: IdentitySecret[] }>('/identity/secrets'),
                api.get<{ data: IdentityNode[] }>('/identity/nodes'),
                api.get<{ data: { did: string; displayName: string; email: string } }>('/identity/did'),
                api.get<QuickAdminStatus>('/admin-auth/quick-super-admin/status', { quiet: true }),
            ]);

            if (secretsRes.status === 'fulfilled') setSecrets(secretsRes.value.data);
            if (nodesRes.status === 'fulfilled') setNodes(nodesRes.value.data);
            if (didRes.status === 'fulfilled') setDid(didRes.value.data);
            if (quickRes.status === 'fulfilled') {
                setQuickStatus(quickRes.value);
                setQuickAdmin(prev => ({ ...prev, username: quickRes.value.username || prev.username }));
            }
        } catch { /* handled per-call above */ } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        const isProd = window.location.hostname === 'bez.digital';
        if (isProd) {
            setNativeAppsLinks([
                { name: 'BeZhas Wallet', url: '/dashboard/wallet' },
                { name: 'Gas Tank', url: '/dashboard/gas' },
                { name: 'Edge Nodes', url: '/dashboard/validators' },
                { name: 'Vision Scan', url: '/dashboard/qr' },
                { name: 'BZ Capital', url: '/dashboard/farming' },
                { name: 'BZ Prestige', url: '/dashboard/nfts' },
                { name: 'BZ CargoLink', url: '/dashboard/sectors' },
                { name: 'BZ Sphere', url: '/dashboard/channels' },
            ]);
        }
    }, []);

    // ── Reveal secret value ───────────────────────────────────────────────────
    const handleReveal = async (name: string) => {
        if (revealingId === name) {
            // Toggle off — hide revealed value
            setSecrets(prev => prev.map(s => s.name === name ? { ...s, _revealed: undefined } : s));
            setRevealingId(null);
            return;
        }
        setRevealingId(name);
        try {
            const res = await api.get<{ data: { value: string } }>(`/identity/secrets/${name}/reveal`);
            setSecrets(prev => prev.map(s => s.name === name ? { ...s, _revealed: res.data.value } : s));
        } catch {
            showToast('err', `Error al revelar ${name}`);
            setRevealingId(null);
        }
    };

    // ── Save new/updated secret ───────────────────────────────────────────────
    const handleSaveSecret = async () => {
        if (!newSecret.name || !newSecret.value) {
            showToast('err', 'Nombre y valor son obligatorios');
            return;
        }
        setSavingSecret(true);
        try {
            await api.post('/identity/secrets', newSecret);
            showToast('ok', `'${newSecret.name}' guardado en la bóveda`);
            setNewSecret({ name: '', value: '', service: '' });
            load();
        } catch {
            showToast('err', 'Error al guardar el secreto');
        } finally {
            setSavingSecret(false);
        }
    };

    // ── Authorize new node ────────────────────────────────────────────────────
    const handleAddNode = async () => {
        if (!newNode.label) { showToast('err', 'Label es obligatorio'); return; }
        setSavingNode(true);
        try {
            await api.post('/identity/nodes', {
                nodeId: `node_${Date.now()}`,
                label: newNode.label,
                ipAddress: newNode.ipAddress,
                role: newNode.role,
            });
            showToast('ok', `Nodo '${newNode.label}' autorizado`);
            setNewNode({ label: '', ipAddress: '', role: 'execution' });
            setShowNodeForm(false);
            load();
        } catch {
            showToast('err', 'Error al autorizar el nodo');
        } finally {
            setSavingNode(false);
        }
    };

    // ── Revoke node ───────────────────────────────────────────────────────────
    const handleRevokeNode = async (nodeId: string, label: string) => {
        if (!confirm(`¿Revocar el nodo "${label}"? Esta acción no es reversible.`)) return;
        try {
            await api.del(`/identity/nodes/${nodeId}`);
            showToast('ok', `Nodo '${label}' revocado`);
            load();
        } catch {
            showToast('err', 'Error al revocar el nodo');
        }
    };

    const handleRotateQuickAdmin = async () => {
        if (!quickAdmin.username || quickAdmin.username.length < 3) {
            showToast('err', 'El usuario debe tener al menos 3 caracteres');
            return;
        }
        if (!quickAdmin.currentPassword) {
            showToast('err', 'Escribe la contraseña actual');
            return;
        }
        if (quickAdmin.newPassword === quickAdmin.currentPassword) {
            showToast('err', 'La nueva contraseña coincide con la actual. Elige una contraseña nueva.');
            return;
        }
        if (quickAdmin.newPassword.length < 14) {
            showToast('err', 'La contraseña debe tener al menos 14 caracteres');
            return;
        }
        if (quickAdmin.newPassword !== quickAdmin.confirmPassword) {
            showToast('err', 'Las contraseñas no coinciden');
            return;
        }

        setSavingQuickAdmin(true);
        try {
            const res = await api.post<{ success: boolean; username: string; walletAddress: string; message: string }>(
                '/admin-auth/quick-super-admin/rotate',
                { username: quickAdmin.username, currentPassword: quickAdmin.currentPassword, newPassword: quickAdmin.newPassword },
            );
            setQuickAdmin({ username: res.username, currentPassword: '', newPassword: '', confirmPassword: '' });
            showToast('ok', 'Usuario y contraseña SuperAdmin actualizados');
            load();
        } catch (error) {
            showToast('err', apiErrorMessage(error, 'No se pudieron actualizar las credenciales SuperAdmin'));
        } finally {
            setSavingQuickAdmin(false);
        }
    };

    const handleStart2FASetup = async () => {
        setSaving2FA(true);
        try {
            const res = await api.post<{ success: boolean; qrCodeUrl: string; otpauthUrl: string; backupCodes: string[] }>(
                '/admin-auth/quick-super-admin/2fa/setup',
                {},
            );
            setTwoFactorSetup({ qrCodeUrl: res.qrCodeUrl, otpauthUrl: res.otpauthUrl, backupCodes: res.backupCodes || [] });
            showToast('ok', 'QR 2FA generado. Escanéalo con tu app.');
        } catch (error) {
            showToast('err', apiErrorMessage(error, 'No se pudo generar 2FA'));
        } finally {
            setSaving2FA(false);
        }
    };

    const handleVerify2FASetup = async () => {
        setSaving2FA(true);
        try {
            const res = await api.post<{ success: boolean; backupCodes: string[] }>(
                '/admin-auth/quick-super-admin/2fa/verify-setup',
                { code: twoFactorCode },
            );
            setTwoFactorSetup(prev => prev ? { ...prev, backupCodes: res.backupCodes || prev.backupCodes } : prev);
            setTwoFactorCode('');
            showToast('ok', '2FA activado para el acceso SuperAdmin');
            load();
        } catch (error) {
            showToast('err', apiErrorMessage(error, 'Código 2FA inválido'));
        } finally {
            setSaving2FA(false);
        }
    };

    // Sin token en la query: un JWT en la URL acaba en el historial del
    // navegador, en la cabecera Referer de la primera petición saliente de la
    // SubApp y en los logs de acceso de cualquier proxy por el que pase. Cada
    // SubApp autentica por su cuenta.
    const openNativeApp = (url: string) => {
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
                    toast.type === 'ok' ? 'bg-emerald-900/90 text-emerald-300 border border-emerald-700' : 'bg-red-900/90 text-red-300 border border-red-700'
                }`}>
                    {toast.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {toast.msg}
                </div>
            )}

            <div>
                <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-2">Identidad &amp; Seguridad Soberana</h2>
                <p className="text-gray-400 text-sm max-w-2xl">Gestión de la Identidad Digital (DID), Nodos de Ejecución autorizados para OpenClaw y el almacén cifrado de secretos y credenciales API.</p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-6 h-6 animate-spin text-[#0d33f2]" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* DID Section */}
                    <div className="bg-white/5 border border-white/10 p-6">
                        <div className="flex items-center space-x-3 mb-4 text-[#0d33f2]">
                            <Shield size={24} />
                            <h3 className="font-bold tracking-widest uppercase text-white">Identidad Digital (DID)</h3>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Display Name</label>
                                <div className="mt-1 text-sm font-mono text-gray-300 bg-black/40 border border-white/5 px-3 py-2">
                                    {did?.displayName || '—'}
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Respaldo (Recovery Email)</label>
                                <div className="mt-1 text-sm font-mono text-gray-300 bg-black/40 border border-white/5 px-3 py-2">
                                    {did?.email || '—'}
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Configuración W3C DID</label>
                                <div className="bg-black/40 border border-white/5 p-3 font-mono text-[10px] text-emerald-400 break-all mt-1">
                                    {did?.did || 'Cargando...'}
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Estado de Verificación</label>
                                <div className="flex items-center space-x-2 mt-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span className="text-xs font-bold text-gray-300">Biometría Enlazada (FaceID Activo)</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* OpenClaw Execution Nodes */}
                    <div className="bg-white/5 border border-white/10 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-3 text-[#0d33f2]">
                                <Smartphone size={24} />
                                <h3 className="font-bold tracking-widest uppercase text-white">Nodos OpenClaw</h3>
                            </div>
                            <button
                                onClick={() => setShowNodeForm(v => !v)}
                                className="text-[10px] border border-white/10 uppercase tracking-widest font-bold text-gray-400 hover:text-white px-2 py-1 transition-colors flex items-center gap-1"
                            >
                                <Plus size={12} /> Nuevo
                            </button>
                        </div>

                        {showNodeForm && (
                            <div className="mb-4 p-4 bg-black/40 border border-white/5 space-y-2">
                                <input
                                    type="text" placeholder="Label (ej: VPS Principal)"
                                    className="w-full bg-black/60 border border-white/10 text-white px-3 py-2 text-xs font-mono focus:border-[#0d33f2] outline-none"
                                    value={newNode.label}
                                    onChange={e => setNewNode(v => ({ ...v, label: e.target.value }))}
                                />
                                <input
                                    type="text" placeholder="IP Address (opcional)"
                                    className="w-full bg-black/60 border border-white/10 text-white px-3 py-2 text-xs font-mono focus:border-[#0d33f2] outline-none"
                                    value={newNode.ipAddress}
                                    onChange={e => setNewNode(v => ({ ...v, ipAddress: e.target.value }))}
                                />
                                <button
                                    onClick={handleAddNode}
                                    disabled={savingNode}
                                    className="w-full py-2 bg-[#0d33f2] text-white text-xs font-bold uppercase tracking-widest hover:brightness-110 disabled:opacity-50 flex justify-center items-center gap-2"
                                >
                                    {savingNode && <Loader2 size={12} className="animate-spin" />}
                                    Autorizar Nodo
                                </button>
                            </div>
                        )}

                        <div className="space-y-2">
                            {nodes.length === 0 && !showNodeForm && (
                                <p className="text-xs text-gray-500 text-center py-4">Sin nodos configurados</p>
                            )}
                            {nodes.map(node => (
                                <div key={node.id} className="flex justify-between items-center bg-black/40 border border-white/5 p-3">
                                    <div>
                                        <div className="text-sm font-bold">{node.label}</div>
                                        <div className="text-[10px] text-gray-500 font-mono tracking-widest">{node.ip_address || '—'} • {node.role}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] px-2 py-1 font-bold uppercase tracking-widest ${
                                            node.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                                            node.status === 'revoked' ? 'bg-red-500/20 text-red-400' :
                                            'bg-[#0d33f2]/20 text-[#0d33f2]'
                                        }`}>{node.status}</span>
                                        {node.status !== 'revoked' && (
                                            <button
                                                onClick={() => handleRevokeNode(node.node_id, node.label)}
                                                className="text-gray-600 hover:text-red-400 transition-colors"
                                                title="Revocar nodo"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Secrets Management */}
                    <div className="col-span-1 md:col-span-2 bg-white/5 border border-white/10 p-6">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center space-x-3 text-red-500">
                                <KeyRound size={24} />
                                <h3 className="font-bold tracking-widest uppercase text-white">Bóveda de Secretos OpenClaw</h3>
                            </div>
                            <button
                                onClick={() => setShowAll(!showAll)}
                                className="flex items-center space-x-2 text-[10px] uppercase tracking-widest font-bold text-gray-400 hover:text-white transition-colors"
                            >
                                {showAll ? <EyeOff size={14} /> : <Eye size={14} />}
                                <span>{showAll ? 'Ocultar' : 'Revelar'} Todos</span>
                            </button>
                        </div>

                        <p className="text-xs text-gray-400 mb-4">Secretos cifrados con AES-256-GCM. Cada revelación queda registrada en el audit log. OpenClaw tiene acceso de solo lectura vía inyección de variables.</p>

                        {/* Secret list */}
                        <div className="space-y-3 mb-6">
                            {secrets.length === 0 && (
                                <p className="text-xs text-gray-500 text-center py-6">No hay secretos en la bóveda. Añade uno abajo.</p>
                            )}
                            {secrets.map(secret => (
                                <div key={secret.id} className="flex flex-col md:flex-row md:items-center justify-between bg-black/40 border border-white/5 p-4 group hover:border-white/20 transition-colors gap-3">
                                    <div>
                                        <div className="text-sm font-bold font-mono text-gray-200">{secret.name}</div>
                                        <div className="text-[10px] text-gray-500 tracking-widest uppercase">{secret.service}</div>
                                        <div className="text-[9px] text-gray-600">Actualizado: {new Date(secret.updated_at).toLocaleString('es-ES')}</div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="font-mono text-xs text-gray-400 bg-white/5 px-3 py-2 border border-white/10 min-w-[220px] max-w-xs overflow-hidden text-ellipsis">
                                            {(showAll || secret._revealed) ? (secret._revealed || '••••••••') : '••••••••••••••••••••••••'}
                                        </div>
                                        <button
                                            onClick={() => handleReveal(secret.name)}
                                            disabled={revealingId === secret.name && !secret._revealed}
                                            className="text-gray-500 hover:text-[#0d33f2] transition-colors disabled:opacity-50"
                                            title={secret._revealed ? 'Ocultar' : 'Revelar valor'}
                                        >
                                            {revealingId === secret.name && !secret._revealed
                                                ? <Loader2 size={14} className="animate-spin" />
                                                : secret._revealed ? <EyeOff size={14} /> : <Key size={14} />
                                            }
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Add new secret form */}
                        <div className="border-t border-white/10 pt-5">
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-3 font-bold">Añadir / Actualizar Secreto</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <input
                                    type="text" placeholder="NOMBRE_SECRETO"
                                    className="bg-black/60 border border-white/10 text-white px-3 py-2 text-xs font-mono focus:border-[#0d33f2] outline-none uppercase"
                                    value={newSecret.name}
                                    onChange={e => setNewSecret(v => ({ ...v, name: e.target.value.toUpperCase() }))}
                                />
                                <input
                                    type="password" placeholder="valor del secreto"
                                    className="bg-black/60 border border-white/10 text-white px-3 py-2 text-xs font-mono focus:border-[#0d33f2] outline-none"
                                    value={newSecret.value}
                                    onChange={e => setNewSecret(v => ({ ...v, value: e.target.value }))}
                                />
                                <input
                                    type="text" placeholder="Servicio (ej: GPT-4 Engine)"
                                    className="bg-black/60 border border-white/10 text-white px-3 py-2 text-xs font-mono focus:border-[#0d33f2] outline-none"
                                    value={newSecret.service}
                                    onChange={e => setNewSecret(v => ({ ...v, service: e.target.value }))}
                                />
                            </div>
                            <div className="mt-3 flex justify-end">
                                <button
                                    onClick={handleSaveSecret}
                                    disabled={savingSecret}
                                    className="bg-[#0d33f2] text-white px-6 py-3 text-xs font-bold tracking-widest uppercase italic shadow-[0_0_15px_rgba(13,51,242,0.3)] hover:brightness-110 transition-all flex items-center space-x-2 disabled:opacity-50"
                                >
                                    {savingSecret ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    <span>Guardar en Bóveda</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Quick SuperAdmin Credentials */}
                    <div className="col-span-1 md:col-span-2 bg-white/5 border border-white/10 p-6">
                        <div className="flex items-center space-x-3 mb-4 text-[#0d33f2]">
                            <UserCog size={24} />
                            <h3 className="font-bold tracking-widest uppercase text-white">Acceso Rápido SuperAdmin</h3>
                        </div>
                        <p className="text-xs text-gray-400 mb-5">
                            Cambia el usuario y contraseña del acceso rápido vinculado a la wallet SuperAdmin
                            <span className="ml-1 font-mono text-gray-300">{quickStatus?.walletAddress || '0x52df82920cbae522880dd7657e43d1a754ed044e'}</span>.
                            El backend guarda solo hashes bcrypt y bloquea la contraseña actual o cualquiera de las últimas 3.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div>
                                <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">
                                    Usuario
                                </label>
                                <input
                                    type="text"
                                    className="w-full bg-black/60 border border-white/10 text-white px-3 py-2 text-xs font-mono focus:border-[#0d33f2] outline-none"
                                    value={quickAdmin.username}
                                    onChange={e => setQuickAdmin(v => ({ ...v, username: e.target.value }))}
                                    placeholder="superadmin"
                                    autoComplete="username"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">
                                    Contraseña actual
                                </label>
                                <input
                                    type="password"
                                    className="w-full bg-black/60 border border-white/10 text-white px-3 py-2 text-xs font-mono focus:border-[#0d33f2] outline-none"
                                    value={quickAdmin.currentPassword}
                                    onChange={e => setQuickAdmin(v => ({ ...v, currentPassword: e.target.value }))}
                                    placeholder="actual"
                                    autoComplete="current-password"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">
                                    Nueva contraseña
                                </label>
                                <input
                                    type="password"
                                    className="w-full bg-black/60 border border-white/10 text-white px-3 py-2 text-xs font-mono focus:border-[#0d33f2] outline-none"
                                    value={quickAdmin.newPassword}
                                    onChange={e => setQuickAdmin(v => ({ ...v, newPassword: e.target.value }))}
                                    placeholder="mínimo 14 caracteres"
                                    autoComplete="new-password"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">
                                    Confirmar contraseña
                                </label>
                                <input
                                    type="password"
                                    className="w-full bg-black/60 border border-white/10 text-white px-3 py-2 text-xs font-mono focus:border-[#0d33f2] outline-none"
                                    value={quickAdmin.confirmPassword}
                                    onChange={e => setQuickAdmin(v => ({ ...v, confirmPassword: e.target.value }))}
                                    placeholder="repite la contraseña"
                                    autoComplete="new-password"
                                />
                            </div>
                        </div>

                        <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest">
                                Historial protegido: {quickStatus?.passwordHistoryCount ?? 0}/3 antiguas. 2FA: <span className={quickStatus?.twoFactorEnabled ? 'text-emerald-400' : 'text-amber-400'}>{quickStatus?.twoFactorEnabled ? 'activo' : 'pendiente'}</span>.
                            </p>
                            <button
                                onClick={handleRotateQuickAdmin}
                                disabled={savingQuickAdmin}
                                className="bg-[#0d33f2] text-white px-6 py-3 text-xs font-bold tracking-widest uppercase italic shadow-[0_0_15px_rgba(13,51,242,0.3)] hover:brightness-110 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                            >
                                {savingQuickAdmin ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                <span>Actualizar Acceso</span>
                            </button>
                        </div>

                        <div className="mt-6 border-t border-white/10 pt-5">
                            <div className="flex items-center justify-between gap-3 mb-4">
                                <div className="flex items-center gap-3 text-emerald-400">
                                    <QrCode size={22} />
                                    <div>
                                        <h4 className="text-sm font-bold uppercase tracking-widest text-white">A2F / Authenticator App</h4>
                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">Compatible con Google Authenticator, Authy, 1Password y similares.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleStart2FASetup}
                                    disabled={saving2FA}
                                    className="border border-emerald-500/30 text-emerald-300 px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-500/10 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {saving2FA ? <Loader2 size={13} className="animate-spin" /> : <QrCode size={13} />}
                                    Generar QR
                                </button>
                            </div>

                            {twoFactorSetup && (
                                <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-5 bg-black/30 border border-white/5 p-4">
                                    <div className="bg-white p-3 w-[180px] h-[180px]">
                                        <img src={twoFactorSetup.qrCodeUrl} alt="QR 2FA SuperAdmin" className="w-full h-full" />
                                    </div>
                                    <div className="space-y-3">
                                        <p className="text-xs text-gray-400">Escanea el QR y escribe el código de 6 dígitos para activar 2FA real en el próximo login.</p>
                                        <div className="flex gap-3">
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                maxLength={12}
                                                className="bg-black/60 border border-white/10 text-white px-3 py-2 text-sm font-mono tracking-[0.35em] text-center focus:border-[#0d33f2] outline-none"
                                                value={twoFactorCode}
                                                onChange={e => setTwoFactorCode(e.target.value)}
                                                placeholder="000000"
                                                autoComplete="one-time-code"
                                            />
                                            <button
                                                onClick={handleVerify2FASetup}
                                                disabled={saving2FA}
                                                className="bg-emerald-600 text-white px-5 py-2 text-xs font-bold uppercase tracking-widest hover:brightness-110 disabled:opacity-50"
                                            >
                                                Verificar
                                            </button>
                                        </div>
                                        {twoFactorSetup.backupCodes.length > 0 && (
                                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                                {twoFactorSetup.backupCodes.map(code => (
                                                    <span key={code} className="bg-black/60 border border-white/10 px-2 py-1 text-[10px] font-mono text-gray-300 text-center">{code}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 border-t border-white/10 pt-5">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-bold uppercase tracking-widest text-white">SSO SuperAdmin Apps Nativas</h4>
                                <span className="text-[10px] text-gray-500 uppercase tracking-widest">Token con scope *</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {nativeAppsLinks.map(app => (
                                    <button
                                        key={app.url}
                                        onClick={() => openNativeApp(app.url)}
                                        className="flex items-center justify-between gap-2 bg-black/40 border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-300 hover:text-white hover:border-[#0d33f2]/60 transition-colors"
                                    >
                                        <span>{app.name}</span>
                                        <ExternalLink size={12} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
