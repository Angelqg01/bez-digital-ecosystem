import React, { useState } from 'react';
import { Check as CheckIcon, Copy as CopyIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';

// Tab 3: Embed Widgets
const EmbedWidgetsTab = () => {
    const [widgetType, setWidgetType] = useState('tracking');
    const [copied, setCopied] = useState(false);

    const embedCodes = {
        tracking: `<!-- BeZhas Tracking Widget -->
<div id="bezhas-tracking"></div>
<script src="https://cdn.bezhas.com/widgets/tracking.js"></script>
<script>
    BeZhasTracking.init({
        containerId: 'bezhas-tracking',
        apiKey: 'YOUR_API_KEY',
        shipmentId: 'SHIP_12345'
    });
</script>`,
        marketplace: `<!-- BeZhas Marketplace Widget -->
<div id="bezhas-marketplace"></div>
<script src="https://cdn.bezhas.com/widgets/marketplace.js"></script>
<script>
    BeZhasMarketplace.init({
        containerId: 'bezhas-marketplace',
        apiKey: 'YOUR_API_KEY',
        category: 'all'
    });
</script>`,
        wallet: `<!-- BeZhas Wallet Connect Button -->
<div id="bezhas-wallet-btn"></div>
<script src="https://cdn.bezhas.com/widgets/wallet.js"></script>
<script>
    BeZhasWallet.init({
        containerId: 'bezhas-wallet-btn',
        apiKey: 'YOUR_API_KEY',
        network: 'polygon-amoy'
    });
</script>`
    };

    const copyEmbed = () => {
        navigator.clipboard.writeText(embedCodes[widgetType]);
        setCopied(true);
        toast.success('Código copiado');
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    Embed Widgets
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Incrusta funcionalidades de BeZhas directamente en tu sitio web
                </p>

                {/* Widget Selector */}
                <div className="flex gap-2 mb-6 flex-wrap">
                    {[
                        { id: 'tracking', label: 'Tracking Logístico' },
                        { id: 'marketplace', label: 'Marketplace' },
                        { id: 'wallet', label: 'Wallet Connect' }
                    ].map(widget => (
                        <button
                            key={widget.id}
                            onClick={() => setWidgetType(widget.id)}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${widgetType === widget.id
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            {widget.label}
                        </button>
                    ))}
                </div>

                {/* Embed Code */}
                <div className="relative">
                    <pre className="bg-gray-900 text-green-400 p-6 rounded-lg overflow-x-auto">
                        <code>{embedCodes[widgetType]}</code>
                    </pre>
                    <button
                        onClick={copyEmbed}
                        className="absolute top-4 right-4 p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        {copied ? <CheckIcon className="w-5 h-5 text-green-400" /> : <CopyIcon className="w-5 h-5 text-gray-400" />}
                    </button>
                </div>

                {/* Widget Preview */}
                <div className="mt-6 p-6 bg-gray-50 dark:bg-gray-900 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
                    <p className="text-center text-gray-500 dark:text-gray-400 mb-4">Vista Previa del Widget</p>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                            El widget aparecerá aquí cuando lo implementes en tu sitio
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmbedWidgetsTab;
