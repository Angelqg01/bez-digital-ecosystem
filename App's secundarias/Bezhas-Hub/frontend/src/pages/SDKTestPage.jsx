import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { BeZhas as BeZhasSDK } from '@bezhas/sdk';

const SDKTestPage = () => {
    const [sdk, setSdk] = useState(null);
    const [status, setStatus] = useState('Initializing...');
    const [walletInfo, setWalletInfo] = useState(null);
    const [balance, setBalance] = useState(null);
    const [logs, setLogs] = useState([]);

    const addLog = (msg) => setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);

    useEffect(() => {
        try {
            const instance = new BeZhasSDK({
                network: 'localhost', // or 'amoy' depending on your current setup
                apiUrl: 'http://localhost:3001'
            });
            setSdk(instance);
            setStatus('SDK Initialized');
            addLog('SDK instance created');
        } catch (e) {
            setStatus(`Error: ${e.message}`);
            addLog(`Error initializing SDK: ${e.message}`);
        }
    }, []);

    const handleConnect = async () => {
        if (!sdk) return;
        addLog('Connecting wallet...');
        try {
            const result = await sdk.connectWallet();
            if (result.success) {
                setWalletInfo(result.address);
                addLog(`Wallet connected: ${result.address}`);
            } else {
                addLog(`Connection failed: ${result.error}`);
            }
        } catch (e) {
            addLog(`Connection error: ${e.message}`);
        }
    };

    const handleGetBalance = async () => {
        if (!sdk || !walletInfo) return;
        addLog('Fetching BEZ balance...');
        try {
            const result = await sdk.getTokenBalance();
            if (result.success) {
                setBalance(result.balance);
                addLog(`Balance: ${result.balance} BEZ`);
            } else {
                addLog(`Fetch balance failed: ${result.error}`);
            }
        } catch (e) {
            addLog(`Balance error: ${e.message}`);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                SDK Integration Test
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6 space-y-4 bg-gray-900 border-gray-800">
                    <h2 className="text-xl font-semibold text-white">Controls</h2>

                    <div className="p-3 bg-gray-800 rounded">
                        <span className="text-gray-400">Status: </span>
                        <span className={status.includes('Error') ? 'text-red-400' : 'text-green-400'}>
                            {status}
                        </span>
                    </div>

                    <div className="space-y-3">
                        <Button
                            onClick={handleConnect}
                            disabled={!sdk || walletInfo}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                        >
                            {walletInfo ? 'Connected' : 'Connect Wallet'}
                        </Button>

                        <Button
                            onClick={handleGetBalance}
                            disabled={!walletInfo}
                            variant="outline"
                            className="w-full"
                        >
                            Get Token Balance
                        </Button>
                    </div>

                    {walletInfo && (
                        <div className="mt-4 p-4 bg-slate-800 rounded border border-slate-700">
                            <p className="text-sm text-gray-400">Connected Address:</p>
                            <code className="text-xs text-blue-300 break-all">{walletInfo}</code>

                            {balance !== null && (
                                <div className="mt-3">
                                    <p className="text-sm text-gray-400">BEZ Balance:</p>
                                    <p className="text-2xl font-bold text-white">{balance}</p>
                                </div>
                            )}
                        </div>
                    )}
                </Card>

                <Card className="p-6 bg-black border-gray-800 font-mono text-sm h-96 overflow-hidden flex flex-col">
                    <h2 className="text-xl font-semibold text-white mb-4">Activity Log</h2>
                    <div className="flex-1 overflow-y-auto space-y-1 text-gray-300 pr-2 custom-scrollbar">
                        {logs.length === 0 && <span className="text-gray-600 italic">No activity yet...</span>}
                        {logs.map((log, i) => (
                            <div key={i} className="border-b border-gray-900 pb-1">
                                <span className="text-blue-500 mr-2">➜</span>
                                {log}
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default SDKTestPage;
