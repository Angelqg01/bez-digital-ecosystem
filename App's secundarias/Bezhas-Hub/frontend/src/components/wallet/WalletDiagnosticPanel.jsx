import React, { useState, useEffect } from 'react';
import { useAccount, useChainId, useConnectorClient } from 'wagmi';
import { AlertCircle, CheckCircle, Info, Wifi, WifiOff } from 'lucide-react';
import { hasPersistedConnection, getStoredConnector } from '../../lib/web3/walletStorage';

/**
 * Panel de diagnóstico de wallet para debugging
 * Solo visible en desarrollo
 */
export default function WalletDiagnosticPanel() {
    const { address, isConnected, connector, status } = useAccount();
    const chainId = useChainId();
    const { data: client } = useConnectorClient();
    const [diagnostics, setDiagnostics] = useState({});

    useEffect(() => {
        const runDiagnostics = () => {
            const diag = {
                walletDetected: typeof window !== 'undefined' && typeof window.ethereum !== 'undefined',
                isConnected,
                address: address || 'N/A',
                chainId: chainId || 'N/A',
                connector: connector?.name || 'N/A',
                status,
                hasPersistedData: hasPersistedConnection(),
                storedConnector: getStoredConnector(),
                web3ModalLoaded: typeof window !== 'undefined' && window.web3modal !== undefined,
                wagmiConfigured: true,
            };
            setDiagnostics(diag);
        };

        runDiagnostics();
        const interval = setInterval(runDiagnostics, 2000);
        return () => clearInterval(interval);
    }, [address, isConnected, chainId, connector, status]);

    // Solo mostrar en desarrollo
    if (process.env.NODE_ENV === 'production') {
        return null;
    }

    return (
        <div className="bg-white dark:bg-gray-900 border-2 border-purple-500 rounded-lg shadow-2xl p-4 max-w-sm z-50">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                <Info size={18} className="text-purple-500" />
                <h3 className="font-bold text-sm">Wallet Diagnostics</h3>
            </div>

            <div className="space-y-2 text-xs">
                <DiagnosticItem
                    label="Wallet Detected"
                    value={diagnostics.walletDetected}
                    isBoolean
                />
                <DiagnosticItem
                    label="Connection Status"
                    value={diagnostics.status}
                    isStatus
                />
                <DiagnosticItem
                    label="Is Connected"
                    value={diagnostics.isConnected}
                    isBoolean
                />
                <DiagnosticItem
                    label="Address"
                    value={diagnostics.address}
                    isTruncated
                />
                <DiagnosticItem
                    label="Chain ID"
                    value={diagnostics.chainId}
                />
                <DiagnosticItem
                    label="Connector"
                    value={diagnostics.connector}
                />
                <DiagnosticItem
                    label="Persisted Data"
                    value={diagnostics.hasPersistedData}
                    isBoolean
                />
            </div>

            <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500">
                    Actualizado cada 2s • Solo Dev Mode
                </p>
            </div>
        </div>
    );
}

function DiagnosticItem({ label, value, isBoolean, isStatus, isTruncated }) {
    const getIcon = () => {
        if (isBoolean) {
            return value ? (
                <CheckCircle size={14} className="text-green-500" />
            ) : (
                <AlertCircle size={14} className="text-red-500" />
            );
        }
        if (isStatus) {
            const statusColors = {
                connected: 'text-green-500',
                connecting: 'text-yellow-500',
                disconnected: 'text-gray-500',
                reconnecting: 'text-blue-500',
            };
            return <Wifi size={14} className={statusColors[value] || 'text-gray-500'} />;
        }
        return <Info size={14} className="text-blue-500" />;
    };

    const formatValue = () => {
        if (typeof value === 'boolean') {
            return value ? 'Yes' : 'No';
        }
        if (isTruncated && typeof value === 'string' && value.length > 20) {
            return `${value.slice(0, 10)}...${value.slice(-8)}`;
        }
        return String(value);
    };

    return (
        <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
                {getIcon()}
                <span className="text-gray-600 dark:text-gray-400">{label}:</span>
            </div>
            <span className="font-mono font-semibold text-gray-900 dark:text-white">
                {formatValue()}
            </span>
        </div>
    );
}
