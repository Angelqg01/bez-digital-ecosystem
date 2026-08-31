// frontend/src/components/AdNotificationsPanel.jsx
import React, { useEffect, useState } from 'react';

const AdNotificationsPanel = ({ userId, campaignId }) => {
    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
        const ws = new WebSocket('ws://localhost:4000/ads');
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            // Filtra por usuario/campaña
            if ((userId && data.userId !== userId) || (campaignId && data.campaignId !== campaignId)) return;
            setNotifications(prev => [data, ...prev].slice(0, 10)); // Solo las 10 últimas
        };
        return () => ws.close();
    }, [userId, campaignId]);

    return (
        <div className="bg-white rounded-xl shadow p-4 mb-4">
            <h3 className="font-bold text-lg mb-2">Notificaciones relevantes</h3>
            <ul className="space-y-2">
                {notifications.map((n, idx) => (
                    <li key={idx} className="text-sm text-gray-700">
                        <span className="font-semibold">{n.type}</span>: {n.message}
                        <span className="ml-2 text-gray-400">{new Date(n.timestamp).toLocaleTimeString()}</span>
                    </li>
                ))}
                {notifications.length === 0 && <li className="text-gray-400">Sin notificaciones recientes.</li>}
            </ul>
        </div>
    );
};

export default AdNotificationsPanel;
