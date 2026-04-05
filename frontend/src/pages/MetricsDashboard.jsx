import React, { useEffect, useState, useRef } from 'react';
import http from '../services/http';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Activity, Server, Clock, AlertTriangle, RefreshCw, Database } from 'lucide-react';

// Metrics Dashboard Component
export default function MetricsDashboard() {
    const [metrics, setMetrics] = useState('');
    const [error, setError] = useState(null);
    const [chartData, setChartData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const intervalRef = useRef();

    // Parse Prometheus metrics for memory and uptime
    function parseMetrics(text) {
        const lines = text.split('\n');
        let mem = null, uptime = null;
        for (const line of lines) {
            if (line.startsWith('process_resident_memory_bytes ')) {
                mem = parseInt(line.split(' ')[1], 10) / (1024 * 1024); // MB
            }
            if (line.startsWith('process_uptime_seconds ')) {
                uptime = parseInt(line.split(' ')[1], 10);
            }
        }
        return { mem, uptime };
    }

    const fetchMetrics = async () => {
        setIsLoading(true);
        try {
            // Try to fetch from API
            const res = await http.get('/api/metrics');
            if (res.status !== 200) throw new Error('Failed to fetch metrics');
            const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);

            setMetrics(text);
            const { mem, uptime } = parseMetrics(text);

            if (mem !== null && uptime !== null) {
                setChartData(prev => {
                    const newData = [...prev, { time: new Date().toLocaleTimeString(), mem, uptime }];
                    return newData.slice(-20); // Keep last 20 points
                });
            }
            setError(null);
        } catch (err) {
            console.warn("Metrics API unreachable, switching to mock data for demo purposes.");
            setError(err.message);

            // Mock data generation for demo
            const mockMem = 150 + Math.random() * 50;
            const mockUptime = (chartData.length > 0 ? chartData[chartData.length - 1].uptime : 0) + 5;

            setChartData(prev => {
                const newData = [...prev, { time: new Date().toLocaleTimeString(), mem: mockMem, uptime: mockUptime }];
                return newData.slice(-20);
            });
            setMetrics(`# HELP process_resident_memory_bytes Resident memory size in bytes.\n# TYPE process_resident_memory_bytes gauge\nprocess_resident_memory_bytes ${Math.floor(mockMem * 1024 * 1024)}\n# HELP process_uptime_seconds The uptime of the process.\n# TYPE process_uptime_seconds gauge\nprocess_uptime_seconds ${mockUptime}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Poll metrics every 5s
    useEffect(() => {
        fetchMetrics();
        intervalRef.current = setInterval(fetchMetrics, 5000);
        return () => clearInterval(intervalRef.current);
    }, []);

    const currentMem = chartData.length > 0 ? chartData[chartData.length - 1].mem.toFixed(2) : '0.00';
    const currentUptime = chartData.length > 0 ? formatUptime(chartData[chartData.length - 1].uptime) : '0s';

    function formatUptime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h}h ${m}m ${s}s`;
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 pt-24">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                            <Activity className="text-purple-600" />
                            System Metrics
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                            Real-time monitoring of backend performance
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {error ? (
                            <span className="flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                                <AlertTriangle size={16} /> Demo Mode
                            </span>
                        ) : (
                            <span className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                                <RefreshCw size={16} className="animate-spin" /> Live
                            </span>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-gray-500 dark:text-gray-400 font-medium">Memory Usage</h3>
                            <Database className="text-blue-500" size={20} />
                        </div>
                        <div className="text-3xl font-bold text-gray-900 dark:text-white">{currentMem} MB</div>
                        <div className="text-sm text-green-500 mt-2 flex items-center">
                            <Activity size={14} className="mr-1" /> Stable
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-gray-500 dark:text-gray-400 font-medium">Uptime</h3>
                            <Clock className="text-green-500" size={20} />
                        </div>
                        <div className="text-3xl font-bold text-gray-900 dark:text-white">{currentUptime}</div>
                        <div className="text-sm text-gray-500 mt-2">Since last restart</div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-gray-500 dark:text-gray-400 font-medium">Status</h3>
                            <Server className={error ? "text-yellow-500" : "text-green-500"} size={20} />
                        </div>
                        <div className="text-3xl font-bold text-gray-900 dark:text-white">
                            {error ? "Simulated" : "Online"}
                        </div>
                        <div className="text-sm text-gray-500 mt-2">
                            {error ? "Backend unreachable" : "Connected to /api/metrics"}
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 mb-8 h-[400px]">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Performance History</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorUptime" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                            <XAxis dataKey="time" stroke="#9CA3AF" />
                            <YAxis yAxisId="left" stroke="#9CA3AF" label={{ value: 'Memory (MB)', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }} />
                            <YAxis yAxisId="right" orientation="right" stroke="#9CA3AF" label={{ value: 'Uptime (s)', angle: 90, position: 'insideRight', fill: '#9CA3AF' }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                            />
                            <Legend />
                            <Area yAxisId="left" type="monotone" dataKey="mem" stroke="#8884d8" fillOpacity={1} fill="url(#colorMem)" name="Memory (MB)" />
                            <Area yAxisId="right" type="monotone" dataKey="uptime" stroke="#82ca9d" fillOpacity={1} fill="url(#colorUptime)" name="Uptime (s)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div className="bg-gray-900 rounded-2xl p-6 overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-white font-mono text-sm">Raw Metrics Output</h3>
                        <span className="text-xs text-gray-400 font-mono">Prometheus Format</span>
                    </div>
                    <pre className="text-green-400 font-mono text-xs overflow-x-auto p-4 bg-black/50 rounded-xl h-48 scrollbar-thin scrollbar-thumb-gray-700">
                        {metrics || "# Waiting for data..."}
                    </pre>
                </div>
            </div>
        </div>
    );
}
