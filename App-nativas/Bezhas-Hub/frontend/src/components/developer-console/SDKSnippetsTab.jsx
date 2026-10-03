import React, { useState } from 'react';
import { Key as KeyIcon, Check as CheckIcon, Copy as CopyIcon, Zap as ZapIcon, ExternalLink as ExternalLinkIcon, Download as DownloadIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';

// Tab 1: SDK & Code Snippets
const SDKSnippetsTab = ({ apiKeys, onCreateKey }) => {
    const [selectedLanguage, setSelectedLanguage] = useState('javascript');
    const [selectedApiKey, setSelectedApiKey] = useState(apiKeys[0]?._id || 'YOUR_API_KEY');
    const [copied, setCopied] = useState(false);

    const codeSnippets = {
        javascript: `// BeZhas SDK - JavaScript/Node.js
import {BeZhasSDK} from '@bezhas/sdk';

const bezhas = new BeZhasSDK({
    apiKey: '${selectedApiKey}',
    environment: 'production'
});

// Ejemplo: Crear envío logístico
const shipment = await bezhas.logistics.create({
    origin: 'CDMX',
    destination: 'GDL',
    cargo: 'Electronics',
    value: 50000
});

console.log('Shipment ID:', shipment.id);`,
        python: `# BeZhas SDK - Python
from bezhas_sdk import BeZhasClient

bezhas = BeZhasClient(api_key='${selectedApiKey}')

# Ejemplo: Tokenizar propiedad
property = bezhas.real_estate.tokenize(
    address="5th Avenue, NYC",
    valuation=5000000,
    fractions=10000
)

print(f"Property Token: {property.token_id}")`,
        php: `<?php
// BeZhas SDK - PHP
require 'vendor/autoload.php';
use Bezhas\\SDK\\Client;

$bezhas = new Client(['api_key' => '${selectedApiKey}']);

// Ejemplo: Crear smart contract
$contract = $bezhas->contracts->deploy([
    'type' => 'escrow',
    'amount' => 10000,
    'parties' => ['buyer', 'seller']
]);

echo "Contract Address: " . $contract->address;`,
        ruby: `# BeZhas SDK - Ruby
require 'bezhas'

bezhas = Bezhas::Client.new(api_key: '${selectedApiKey}')

# Ejemplo: Verificar KYC
kyc = bezhas.identity.verify(
    user_id: 'user_12345',
    document: 'passport'
)

puts "KYC Status: #{kyc.status}"`,
        curl: `# BeZhas API - cURL
curl -X POST https://api.bezhas.com/v1/logistics/shipments \\
  -H "Authorization: Bearer ${selectedApiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "origin": "CDMX",
    "destination": "GDL",
    "cargo": "Electronics",
    "value": 50000
  }'`
    };

    const copyCode = () => {
        navigator.clipboard.writeText(codeSnippets[selectedLanguage]);
        setCopied(true);
        toast.success('Código copiado');
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    SDK & Code Snippets
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Integra BeZhas en tu aplicación con nuestros SDKs oficiales en múltiples lenguajes
                </p>

                {/* API Key Selector */}
                <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                    <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <KeyIcon className="w-4 h-4 text-purple-600" />
                        Selecciona tu API Key
                    </label>
                    {apiKeys.length > 0 ? (
                        <select
                            value={selectedApiKey}
                            onChange={(e) => setSelectedApiKey(e.target.value)}
                            className="w-full px-4 py-3 bg-white dark:bg-gray-900 border-2 border-purple-300 dark:border-purple-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono text-sm transition-all"
                        >
                            {apiKeys.map(key => (
                                <option key={key._id} value={key._id}>
                                    {key.name} ({key.environment}) - {key.keyPreview}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <div className="text-center py-4">
                            <p className="text-gray-600 dark:text-gray-400 mb-3">No tienes API Keys creadas</p>
                            <button
                                onClick={onCreateKey}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                            >
                                Crear API Key
                            </button>
                        </div>
                    )}
                </div>

                {/* Language Selector */}
                <div className="flex gap-2 mb-4 flex-wrap">
                    {['javascript', 'python', 'php', 'ruby', 'curl'].map(lang => (
                        <button
                            key={lang}
                            onClick={() => setSelectedLanguage(lang)}
                            className={`px-4 py-2 rounded-lg font-medium transition-all capitalize ${selectedLanguage === lang
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            {lang}
                        </button>
                    ))}
                </div>

                {/* Code Block */}
                <div className="relative">
                    <pre className="bg-gray-900 text-green-400 p-6 rounded-lg overflow-x-auto">
                        <code>{codeSnippets[selectedLanguage]}</code>
                    </pre>
                    <button
                        onClick={copyCode}
                        className="absolute top-4 right-4 p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        {copied ? <CheckIcon className="w-5 h-5 text-green-400" /> : <CopyIcon className="w-5 h-5 text-gray-400" />}
                    </button>
                </div>

                {/* Installation Instructions */}
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <h3 className="font-bold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2">
                        <ZapIcon className="w-4 h-4" />
                        Instalación
                    </h3>
                    <code className="text-sm text-blue-800 dark:text-blue-400 font-mono">
                        {selectedLanguage === 'javascript' && 'pnpm add @bezhas/sdk'}
                        {selectedLanguage === 'python' && 'pip install bezhas-sdk'}
                        {selectedLanguage === 'php' && 'composer require bezhas/sdk'}
                        {selectedLanguage === 'ruby' && 'gem install bezhas'}
                        {selectedLanguage === 'curl' && 'No requiere instalación - usa directamente en terminal'}
                    </code>
                </div>
            </div>
        </div>
    );
};

export default SDKSnippetsTab;
