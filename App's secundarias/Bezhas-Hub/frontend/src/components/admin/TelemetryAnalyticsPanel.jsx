import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];

export default function TelemetryAnalyticsPanel() {
    const [telemetry, setTelemetry] = useState([]);
    const [ml, setML] = useState({ conclusions: [], stats: [], timeline: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                // TODO: Implementar endpoints en el backend
                // const [telemetryRes, mlRes] = await Promise.all([
                //     axios.get(`${API_URL}/admin-panel/telemetry/summary`),
                //     axios.get(`${API_URL}/admin-panel/ml/analysis`)
                // ]);
                // setTelemetry(telemetryRes.data.events || []);
                // setML(mlRes.data || { conclusions: [], stats: [], timeline: [] });

                // Datos de ejemplo por ahora
                setTelemetry([
                    { name: 'Page Views', count: 1234, change: '+12%' },
                    { name: 'User Actions', count: 567, change: '+8%' },
                    { name: 'Errors', count: 23, change: '-15%' }
                ]);
                setML({
                    conclusions: ['Sistema operando normalmente', 'Rendimiento óptimo'],
                    stats: [],
                    timeline: []
                });
            } catch (e) {
                console.warn('Error cargando telemetry:', e.message);
                setTelemetry([]);
                setML({ conclusions: [], stats: [], timeline: [] });
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    if (loading) return <div className="text-center py-8 text-gray-400">Cargando analítica...</div>;

    return (
        <div className="space-y-8">
            <section>
                <h2 className="text-xl font-bold mb-2">Resumen de Telemetría</h2>
                <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={telemetry.slice(0, 10)}>
                        <XAxis dataKey="eventType" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#3b82f6" />
                    </BarChart>
                </ResponsiveContainer>
            </section>
            <section>
                <h2 className="text-xl font-bold mb-2">Análisis ML y Conclusiones</h2>
                <ul className="list-disc ml-6 text-gray-200">
                    {ml.conclusions.length === 0 && <li>No hay conclusiones recientes.</li>}
                    {ml.conclusions.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <div>
                        <h3 className="font-semibold mb-1">Tendencias</h3>
                        <ResponsiveContainer width="100%" height={180}>
                            <LineChart data={ml.timeline}>
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Line type="monotone" dataKey="value" stroke="#8b5cf6" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <div>
                        <h3 className="font-semibold mb-1">Distribución de eventos</h3>
                        <ResponsiveContainer width="100%" height={180}>
                            <PieChart>
                                <Pie data={telemetry.slice(0, 6)} dataKey="count" nameKey="eventType" cx="50%" cy="50%" outerRadius={60}>
                                    {telemetry.slice(0, 6).map((entry, idx) => (
                                        <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </section>
        </div>
    );
}
