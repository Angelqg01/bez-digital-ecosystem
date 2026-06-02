import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    User,
    Copy,
    CheckCircle2,
    Shield,
    Clock,
    Edit2,
    LogOut,
    Settings,
    Key,
    FileCheck,
    QrCode,
    Wallet,
    X
} from 'lucide-react'
import { getDIDProfile, connectWallet, updateProfile } from '../api'

const Profile = () => {
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [copied, setCopied] = useState(false)
    const [walletConnected, setWalletConnected] = useState(false)
    
    // Modal states
    const [showEdit, setShowEdit] = useState(false)
    const [showApiKeys, setShowApiKeys] = useState(false)
    const [showPreferences, setShowPreferences] = useState(false)

    // Form states
    const [editName, setEditName] = useState('')

    const loadProfile = async () => {
        setLoading(true)
        try {
            const data = await getDIDProfile()
            setProfile(data)
            setEditName(data.name)
            
            // Check if DID contains an actual ETH address
            if (data.did && data.did.includes('0x') && data.did !== 'did:bezhas:0x8a1e3930fde1f151471c368fdbb39f3f63a65b55') {
                setWalletConnected(true)
            }
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadProfile()
    }, [])

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleConnectWallet = async () => {
        try {
            const { address } = await connectWallet()
            setWalletConnected(true)
            // Reload profile to get new DID based on wallet
            await loadProfile()
        } catch (error) {
            console.error("Wallet connection failed:", error)
            alert("Failed to connect wallet: " + error.message)
        }
    }

    const handleDisconnectWallet = () => {
        // Just clear state and reload profile with mock
        setWalletConnected(false)
        loadProfile()
    }

    const handleSaveProfile = async () => {
        try {
            await updateProfile({ name: editName })
            setProfile(prev => ({ ...prev, name: editName }))
            setShowEdit(false)
        } catch (error) {
            console.error("Update profile failed:", error)
        }
    }

    if (loading) {
        return (
            <div className="px-4 py-6">
                <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="card glass animate-pulse h-24" />
                    ))}
                </div>
            </div>
        )
    }

    if (!profile) {
        return (
            <div className="px-4 py-6">
                <div className="card glass text-center py-8">
                    <p className="text-bz-text-muted">Profile not found</p>
                </div>
            </div>
        )
    }

    return (
        <div className="px-4 py-6">
            {/* Header */}
            <div className="mb-8">
                <p className="text-label-sm text-bz-primary mb-2">DIGITAL IDENTITY</p>
                <h1 className="text-4xl font-bold mb-2">DID Profile</h1>
                <p className="text-body-md text-bz-text-muted">Manage your BeZhas identity & credentials</p>
            </div>

            {/* Profile Card */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card elevated mb-6"
            >
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-bz-primary to-bz-primary-container rounded-2xl flex items-center justify-center">
                        <User size={32} className="text-white" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-title-md font-bold mb-1">{profile.name}</h2>
                        <div className="flex items-center gap-2">
                            {profile.verified ? (
                                <div className="flex items-center gap-1 text-bz-neon text-label-sm font-bold">
                                    <CheckCircle2 size={14} />
                                    VERIFIED
                                </div>
                            ) : (
                                <div className="text-bz-amber text-label-sm font-bold">UNVERIFIED</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* DID */}
                <div className="mb-4 p-4 bg-bz-surface rounded-xl">
                    <p className="text-label-sm text-bz-text-muted mb-2">DID</p>
                    <div className="flex items-center gap-2 justify-between">
                        <p className="font-mono text-body-sm text-bz-primary break-all">{profile.did}</p>
                        <button
                            onClick={() => copyToClipboard(profile.did)}
                            className="btn btn-icon p-2 hover:bg-bz-primary/20 transition-colors"
                            aria-label="Copy DID"
                        >
                            {copied ? <CheckCircle2 size={16} className="text-bz-neon" /> : <Copy size={16} />}
                        </button>
                    </div>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-bz-surface rounded-lg">
                        <p className="text-label-sm text-bz-text-muted mb-1">Created</p>
                        <p className="text-body-sm font-bold">
                            {new Date(profile.created_at).toLocaleDateString()}
                        </p>
                    </div>
                    <div className="p-3 bg-bz-surface rounded-lg">
                        <p className="text-label-sm text-bz-text-muted mb-1">Verification Methods</p>
                        <p className="text-body-sm font-bold text-bz-neon">{profile.verification_methods}</p>
                    </div>
                </div>
            </motion.div>

            {/* Credentials Section */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-title-md font-bold">Credentials</h3>
                    <span className="text-label-sm text-bz-primary font-bold">{profile.credentials?.length || 0}</span>
                </div>

                <div className="space-y-3">
                    {profile.credentials && profile.credentials.map((cred, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="card glass hover:shadow-glow transition-all"
                        >
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 bg-bz-neon/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                                    <FileCheck size={20} className="text-bz-neon" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-bz-text mb-1">{cred.type}</p>
                                    <div className="flex items-center gap-2 text-label-sm text-bz-text-muted mb-2">
                                        <span>Issued by {cred.issued_by}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-label-sm text-bz-amber">
                                        <Clock size={14} />
                                        <span>Expires: {new Date(cred.expires).toLocaleDateString()}</span>
                                    </div>
                                </div>

                                <button className="p-2 bg-bz-surface hover:bg-bz-surface-2 rounded-lg transition-colors flex-shrink-0">
                                    <QrCode size={20} className="text-bz-neon" />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Verification Status */}
            <div className="card glass mb-6">
                <div className="flex items-center gap-2 mb-3">
                    <Shield size={20} className="text-bz-neon" />
                    <p className="text-title-sm font-bold">Verification Status</p>
                </div>

                <div className="space-y-2">
                    <VerificationItem label="Email Verified" verified={true} />
                    <VerificationItem label="Blockchain Address Verified" verified={walletConnected} />
                    <VerificationItem label="Organization Verified" verified={false} />
                    <VerificationItem label="API Keys Configured" verified={true} />
                </div>
            </div>

            {/* Settings */}
            <div className="space-y-2 mb-4">
                <button 
                    onClick={() => setShowEdit(true)}
                    className="btn btn-secondary w-full justify-start gap-3 text-bz-text"
                >
                    <Edit2 size={18} />
                    <span>Edit Profile</span>
                </button>

                <button 
                    onClick={() => setShowApiKeys(true)}
                    className="btn btn-secondary w-full justify-start gap-3 text-bz-text"
                >
                    <Key size={18} />
                    <span>Manage API Keys</span>
                </button>

                <button 
                    onClick={() => setShowPreferences(true)}
                    className="btn btn-secondary w-full justify-start gap-3 text-bz-text"
                >
                    <Settings size={18} />
                    <span>Preferences</span>
                </button>

                {walletConnected ? (
                    <button 
                        onClick={handleDisconnectWallet}
                        className="btn btn-secondary w-full justify-start gap-3 text-red-400"
                    >
                        <LogOut size={18} />
                        <span>Disconnect Wallet</span>
                    </button>
                ) : (
                    <div className="space-y-4">
                        <div className="relative">
                            <input 
                                type="text" 
                                placeholder="Ingresa tu ID-BeZhas" 
                                className="input-field w-full pl-10"
                            />
                            <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-bz-text-muted" />
                        </div>
                        <button 
                            onClick={handleConnectWallet}
                            className="btn btn-primary w-full justify-start gap-3"
                        >
                            <Wallet size={18} />
                            <span>Conecta tu Wallet o ingresa tu ID-BeZhas</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Additional Info */}
            <div className="card glass bg-bz-primary/5 border-bz-primary/20">
                <div className="flex gap-3">
                    <div className="w-8 h-8 bg-bz-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Shield size={16} className="text-white" />
                    </div>
                    <div>
                        <p className="text-body-sm font-bold mb-1">Secure Your Identity</p>
                        <p className="text-body-sm text-bz-text-muted">
                            Your DID is securely stored on BeZhas blockchain infrastructure. All transactions are cryptographically verified.
                        </p>
                    </div>
                </div>
            </div>

            {/* MODALS */}
            <AnimatePresence>
                {/* Edit Profile Modal */}
                {showEdit && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-bz-surface w-full max-w-sm rounded-2xl p-6 border border-bz-primary/20"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-lg">Edit Profile</h3>
                                <button onClick={() => setShowEdit(false)} className="text-bz-text-muted hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="mb-6">
                                <label className="block text-sm text-bz-text-muted mb-2">Display Name</label>
                                <input 
                                    type="text" 
                                    className="input-field w-full" 
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                />
                            </div>
                            <button onClick={handleSaveProfile} className="btn btn-primary w-full">
                                Save Changes
                            </button>
                        </motion.div>
                    </div>
                )}

                {/* API Keys Modal */}
                {showApiKeys && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-bz-surface w-full max-w-sm rounded-2xl p-6 border border-bz-primary/20"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-lg">API Keys</h3>
                                <button onClick={() => setShowApiKeys(false)} className="text-bz-text-muted hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="mb-4">
                                <p className="text-sm text-bz-text-muted mb-2">Active Development Key</p>
                                <div className="flex items-center gap-2 bg-black/30 p-3 rounded-lg border border-bz-border">
                                    <span className="font-mono text-xs text-bz-primary break-all flex-1">
                                        bz_live_x89a...2k4b
                                    </span>
                                    <button onClick={() => copyToClipboard('bz_live_x89a...2k4b')} className="text-bz-text-muted hover:text-bz-primary">
                                        <Copy size={16} />
                                    </button>
                                </div>
                            </div>
                            <button className="btn btn-secondary w-full text-sm">
                                Generate New Key
                            </button>
                        </motion.div>
                    </div>
                )}

                {/* Preferences Modal */}
                {showPreferences && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-bz-surface w-full max-w-sm rounded-2xl p-6 border border-bz-primary/20"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-lg">Preferences</h3>
                                <button onClick={() => setShowPreferences(false)} className="text-bz-text-muted hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="space-y-4 mb-6">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm">Push Notifications</span>
                                    <div className="w-10 h-6 bg-bz-primary rounded-full relative">
                                        <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm">Auto-sync Blockchain</span>
                                    <div className="w-10 h-6 bg-bz-primary rounded-full relative">
                                        <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setShowPreferences(false)} className="btn btn-primary w-full">
                                Done
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}

const VerificationItem = ({ label, verified }) => (
    <div className="flex items-center justify-between py-2 px-3 bg-bz-surface/50 rounded-lg">
        <p className="text-body-sm text-bz-text">{label}</p>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${verified ? 'bg-bz-neon/20' : 'bg-bz-text-muted/20'}`}>
            {verified ? (
                <CheckCircle2 size={16} className="text-bz-neon" />
            ) : (
                <div className="w-3 h-3 bg-bz-text-muted rounded-full" />
            )}
        </div>
    </div>
)

export default Profile

