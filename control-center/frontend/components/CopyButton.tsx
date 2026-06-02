'use client';

import { useState } from 'react';

interface CopyButtonProps {
    text: string;
    label?: string;
    className?: string;
    iconOnly?: boolean;
}

export default function CopyButton({ text, label, className, iconOnly = false }: CopyButtonProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (iconOnly) {
        return (
            <button
                onClick={handleCopy}
                className={className || "material-symbols-outlined text-gray-500 hover:text-white transition-colors"}
                title={copied ? 'Copiado!' : 'Copiar'}
            >
                {copied ? 'check_circle' : 'content_copy'}
            </button>
        );
    }

    return (
        <button
            onClick={handleCopy}
            className={className}
        >
            {copied ? '✓ COPIADO' : (label || 'COPY')}
        </button>
    );
}
