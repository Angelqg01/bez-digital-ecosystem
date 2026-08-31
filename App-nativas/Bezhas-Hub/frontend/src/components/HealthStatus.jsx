import { useEffect, useState } from 'react';
import http from '../services/http';

export default function HealthStatus() {
    const [status, setStatus] = useState('unknown');
    const [uptime, setUptime] = useState(null);
    const [error, setError] = useState(null);
    const [fetchAttempted, setFetchAttempted] = useState(false);

    useEffect(() => {
        // Prevent React 18 StrictMode double-fetch
        if (fetchAttempted) return;
        setFetchAttempted(true);

        http.get('/api/health')
            .then(res => {
                const data = res.data;
                setStatus(data.status);
                setUptime(data.uptime);
            })
            .catch(err => {
                setStatus('error');
                setError(err.message);
            });
    }, [fetchAttempted]);

    return (
        <div style={{ fontSize: '0.9em', color: status === 'ok' ? 'green' : 'red', marginBottom: 8 }}>
            Backend: {status}
            {uptime !== null && status === 'ok' && (
                <span> (uptime: {Math.floor(uptime)}s)</span>
            )}
            {error && <span> - {error}</span>}
        </div>
    );
}
