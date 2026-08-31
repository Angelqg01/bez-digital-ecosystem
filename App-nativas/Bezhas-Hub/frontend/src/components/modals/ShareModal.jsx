import React, { useState } from 'react';
import { X, Link as LinkIcon, Check, MessageCircle, Send, Twitter, Facebook } from 'lucide-react';

const ShareModal = ({ isOpen, onClose, url, title }) => {
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Error al copiar:', err);
        }
    };

    const shareLinks = [
        {
            name: 'WhatsApp',
            icon: MessageCircle,
            color: 'bg-green-500 hover:bg-green-600',
            href: `https://wa.me/?text=${encodeURIComponent(title + ' ' + url)}`
        },
        {
            name: 'Telegram',
            icon: Send,
            color: 'bg-blue-500 hover:bg-blue-600',
            href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`
        },
        {
            name: 'X (Twitter)',
            icon: Twitter,
            color: 'bg-black hover:bg-gray-800',
            href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`
        },
        {
            name: 'Facebook',
            icon: Facebook,
            color: 'bg-blue-600 hover:bg-blue-700',
            href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
        }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                    <X size={20} />
                </button>

                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Compartir en</h3>

                <div className="grid grid-cols-4 gap-4 mb-6">
                    {shareLinks.map((link) => (
                        <a
                            key={link.name}
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-col items-center gap-2 group"
                        >
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white transition-transform group-hover:scale-110 ${link.color}`}>
                                <link.icon size={20} />
                            </div>
                            <span className="text-xs text-gray-600 dark:text-gray-300">{link.name}</span>
                        </a>
                    ))}
                </div>

                <div className="relative">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        Copiar enlace
                    </label>
                    <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                        <LinkIcon size={16} className="text-gray-400 ml-2" />
                        <input
                            type="text"
                            readOnly
                            value={url}
                            className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-gray-600 dark:text-gray-300 truncate"
                        />
                        <button
                            onClick={handleCopy}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${copied
                                    ? 'bg-green-500 text-white'
                                    : 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-500 shadow-sm'
                                }`}
                        >
                            {copied ? <Check size={16} /> : 'Copiar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShareModal;
