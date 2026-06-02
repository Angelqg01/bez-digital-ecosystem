import React, { useState } from 'react';
import { Check as CheckIcon, Copy as CopyIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';

// Componente CodeBlock para mostrar código con funcionalidad de copiar
const CodeBlock = ({ title, code, language = 'javascript' }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('Código copiado al portapapeles');
    };

    return (
        <div className="mb-6 rounded-lg overflow-hidden border border-gray-700 bg-gray-900">
            <div className="bg-gray-800 px-4 py-2 flex justify-between items-center border-b border-gray-700">
                <span className="text-sm font-mono text-blue-400">{title}</span>
                <button
                    onClick={handleCopy}
                    className="text-xs hover:text-white flex items-center gap-1 text-gray-400 transition-colors"
                >
                    {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
                    {copied ? 'Copiado!' : 'Copiar'}
                </button>
            </div>
            <pre className="p-4 overflow-x-auto text-sm font-mono">
                <code className="text-gray-100">{code}</code>
            </pre>
        </div>
    );
};

export default CodeBlock;
