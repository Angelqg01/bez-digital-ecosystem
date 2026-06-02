// frontend/src/components/AdEventsHistoryPanel.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';

const AdEventsHistoryPanel = ({ userId, campaignId }) => {
    const [events, setEvents] = useState([]);

    useEffect(() => {
        axios.get('/api/ads/events', { params: { userId, campaignId } })
            .then(res => setEvents(res.data));
    }, [userId, campaignId]);

    return (
        <div className="bg-white rounded-xl shadow p-4 mb-4">
            <h3 className="font-bold text-lg mb-2">Historial de eventos</h3>
            <ul className="space-y-2">
                {events.map((e, idx) => (
                    <li key={idx} className="text-sm text-gray-700">
                        <span className="font-semibold">{e.type}</span>: Campaña {e.campaignId} - Usuario {e.userId || 'N/A'}
                        <span className="ml-2 text-gray-400">{new Date(e.timestamp).toLocaleString()}</span>
                    </li>
                ))}
                {events.length === 0 && <li className="text-gray-400">Sin eventos registrados.</li>}
            </ul>
        </div>
    );
};

export default AdEventsHistoryPanel;
