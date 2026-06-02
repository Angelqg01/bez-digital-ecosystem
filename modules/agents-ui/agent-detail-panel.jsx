/**
 * AgentDetailPanel.jsx — Real-time metrics panel for individual agents.
 * Replaces mock useState/setInterval data in the 40+ agent components.
 * 
 * Usage in any agent JSX:
 *   import AgentDetailPanel from './agent-detail-panel';
 *   <AgentDetailPanel agentId="shiptrack" accentColor="#00C8FF" />
 */
import { useState, useEffect } from "react";

const API_BASE = typeof window !== 'undefined'
    ? (window.__BEZHAS_API_URL || 'http://localhost:3001/api')
    : 'http://localhost:3001/api';

function useFetchJSON(url, refreshMs = 0) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!url) { setLoading(false); return; }
        let cancelled = false;

        const load = async () => {
            try {
                const token = typeof window !== 'undefined' ? localStorage.getItem('bezhas_token') : null;
                const headers = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;
                const res = await fetch(`${API_BASE}${url}`, { headers });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                if (!cancelled) { setData(json.data || json); setLoading(false); }
            } catch (err) {
                if (!cancelled) { setError(err.message); setLoading(false); }
            }
        };

        load();
        let interval;
        if (refreshMs > 0) interval = setInterval(load, refreshMs);
        return () => { cancelled = true; if (interval) clearInterval(interval); };
    }, [url, refreshMs]);

    return { data, loading, error };
}

// Severity badge color
function sevColor(sev) {
    if (sev === 'critical') return '#EF4444';
    if (sev === 'warning') return '#FFB800';
    return '#00C896';
}

export default function AgentDetailPanel({ agentId, accentColor = "#00C896" }) {
    const { data: metrics, loading: mLoad } = useFetchJSON(
        agentId ? `/agents/${agentId}/metrics?days=7` : null, 30000
    );
    const { data: contracts, loading: cLoad } = useFetchJSON(
        agentId ? `/contracts/agent/${agentId}` : null, 120000
    );

    const bg = "#03060E";
    const card = "#0C1628";
    const border = "#0D2040";
    const muted = "#3D5E80";
    const text2 = "#A8C4E0";
    const mono = "'JetBrains Mono','Courier New',monospace";

    if (!agentId) return null;

    const stats = metrics?.stats;
    const timeseries = metrics?.timeseries || [];
    const recentLogs = metrics?.recent_logs || [];
    const agentContracts = contracts?.contracts || [];
    const metricsSource = metrics?.source || 'core-db';

    return (
        <div style={{ marginTop: 16 }}>
            {/* Stats Row */}
            <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: 8, color: muted, fontFamily: mono, fontSize: 9,
            }}>
                <span>DATA SOURCE: {metricsSource.toUpperCase()}</span>
                <span>CONTRACTS: {cLoad ? "LOADING" : `${agentContracts.filter(c => c.deployed).length}/${agentContracts.length} DEPLOYED`}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 14 }}>
                {[
                    { label: "Acciones (7d)", value: mLoad ? "…" : (stats?.total_actions ?? 0), color: accentColor },
                    { label: "Alertas Críticas", value: mLoad ? "…" : (stats?.critical_alerts ?? 0), color: "#EF4444" },
                    { label: "Confianza Promedio", value: mLoad ? "…" : (stats?.avg_confidence ? `${(stats.avg_confidence * 100).toFixed(1)}%` : "—"), color: "#FFB800" },
                    { label: "TXs On-Chain", value: mLoad ? "…" : (stats?.on_chain_txs ?? 0), color: "#7C3AED" },
                ].map(s => (
                    <div key={s.label} style={{
                        background: card, borderRadius: 10, padding: "10px 12px",
                        border: `1px solid ${border}`, textAlign: "center",
                    }}>
                        <div style={{ fontSize: 8, color: muted, fontFamily: mono, letterSpacing: 1.5, marginBottom: 4 }}>
                            {s.label.toUpperCase()}
                        </div>
                        <div style={{ color: s.color, fontFamily: mono, fontWeight: 900, fontSize: 20 }}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Timeseries mini chart (ASCII-style bar) */}
            {timeseries.length > 0 && (
                <div style={{
                    background: card, borderRadius: 12, padding: 12,
                    border: `1px solid ${border}`, marginBottom: 14,
                }}>
                    <div style={{ fontSize: 8, color: muted, fontFamily: mono, letterSpacing: 2, marginBottom: 8 }}>
                        ACTIVIDAD DIARIA (7d)
                    </div>
                    <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 60 }}>
                        {timeseries.map((p, i) => {
                            const maxVal = Math.max(...timeseries.map(t => t.actions), 1);
                            const h = Math.max(4, (p.actions / maxVal) * 56);
                            return (
                                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                    <div style={{
                                        width: "100%", height: h, background: p.alerts > 0 ? "#EF4444" : accentColor,
                                        borderRadius: "3px 3px 0 0", opacity: 0.8, transition: "height 0.3s",
                                    }} />
                                    <div style={{ fontSize: 7, color: muted, fontFamily: mono }}>
                                        {new Date(p.date).toLocaleDateString('es', { day: '2-digit' })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Deployed Contracts */}
            {agentContracts.length > 0 && (
                <div style={{
                    background: card, borderRadius: 12, padding: 12,
                    border: `1px solid ${border}`, marginBottom: 14,
                }}>
                    <div style={{ fontSize: 8, color: muted, fontFamily: mono, letterSpacing: 2, marginBottom: 8 }}>
                        CONTRATOS DEPLOYADOS ({agentContracts.filter(c => c.deployed).length}/{agentContracts.length})
                    </div>
                    {agentContracts.map(c => (
                        <div key={c.name} style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "6px 8px", background: "#101E38", borderRadius: 8, marginBottom: 4,
                            border: `1px solid ${c.deployed ? accentColor + '33' : border}`,
                        }}>
                            <span style={{ fontSize: 10, color: c.deployed ? text2 : muted, fontFamily: mono }}>
                                {c.deployed ? "✅" : "⬜"} {c.name}
                            </span>
                            <span style={{ fontSize: 8, color: c.deployed ? accentColor : muted, fontFamily: mono }}>
                                {c.address ? `${c.address.slice(0, 8)}…${c.address.slice(-4)}` : "NOT DEPLOYED"}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Recent Logs */}
            {recentLogs.length > 0 && (
                <div style={{
                    background: card, borderRadius: 12, padding: 12,
                    border: `1px solid ${border}`,
                }}>
                    <div style={{ fontSize: 8, color: muted, fontFamily: mono, letterSpacing: 2, marginBottom: 8 }}>
                        ÚLTIMAS ACCIONES ({recentLogs.length})
                    </div>
                    <div style={{ maxHeight: 200, overflowY: "auto" }}>
                        {recentLogs.slice(0, 15).map(log => (
                            <div key={log.id} style={{
                                display: "flex", gap: 8, alignItems: "center",
                                padding: "5px 8px", borderBottom: `1px solid ${border}`,
                            }}>
                                <span style={{
                                    width: 6, height: 6, borderRadius: "50%",
                                    background: sevColor(log.severity), flexShrink: 0,
                                }} />
                                <span style={{ fontSize: 9, color: text2, fontFamily: mono, flex: 1 }}>
                                    {log.action}
                                </span>
                                {log.confidence != null && (
                                    <span style={{ fontSize: 8, color: "#FFB800", fontFamily: mono }}>
                                        {(log.confidence * 100).toFixed(0)}%
                                    </span>
                                )}
                                {log.tx_hash && (
                                    <span style={{ fontSize: 8, color: accentColor, fontFamily: mono }}>
                                        tx:{log.tx_hash.slice(0, 8)}…
                                    </span>
                                )}
                                <span style={{ fontSize: 7, color: muted, fontFamily: mono, flexShrink: 0 }}>
                                    {new Date(log.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Loading / Empty state */}
            {mLoad && (
                <div style={{ textAlign: "center", padding: 20, color: muted, fontFamily: mono, fontSize: 10 }}>
                    ⏳ Cargando métricas reales de {agentId}...
                </div>
            )}
            {!mLoad && (!stats || stats.total_actions === 0) && recentLogs.length === 0 && (
                <div style={{ textAlign: "center", padding: 20, color: muted, fontFamily: mono, fontSize: 10 }}>
                    — Sin actividad reciente. El agente está online pero sin acciones registradas. —
                </div>
            )}
        </div>
    );
}
