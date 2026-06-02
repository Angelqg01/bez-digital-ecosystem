// frontend/src/components/AdCampaignCard.jsx
import React, { useState } from 'react';
import AdStatsPanel from './AdStatsPanel';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const AdCampaignCard = ({ campaign, userRole, onUpdate }) => {
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({ ...campaign });
    const [stats, setStats] = useState(null);

    const fetchStats = async () => {
        // Simulación: deberías consultar el backend
        setStats({ impressions: 123, clicks: 45, rewards: 67, remaining: campaign.budget - 67 });
    };

    const handleEdit = async (e) => {
        e.preventDefault();
        await axios.put(`/api/campaigns/${campaign.id}`, form);
        setEditing(false);
        onUpdate && onUpdate();
    };

    const handleDelete = async () => {
        if (!window.confirm('¿Seguro que deseas eliminar esta campaña?')) return;
        await axios.delete(`/api/campaigns/${campaign.id}`);
        toast.success('Campaña eliminada');
        onUpdate && onUpdate();
    };

    return (
        <div className="border rounded p-4 mb-4 bg-white">
            {editing ? (
                <form onSubmit={handleEdit} className="space-y-2">
                    <input type="text" value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} className="w-full p-2 border" />
                    <input type="text" value={form.keywords.join(', ')} onChange={e => setForm({ ...form, keywords: e.target.value.split(',').map(k => k.trim()) })} className="w-full p-2 border" />
                    <input type="number" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} className="w-full p-2 border" />
                    <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Guardar</button>
                    <button type="button" className="ml-2 px-4 py-2" onClick={() => setEditing(false)}>Cancelar</button>
                </form>
            ) : (
                <>
                    <h3 className="font-bold text-lg">{campaign.text}</h3>
                    <p className="text-gray-500">Segmentación: {campaign.keywords.join(', ')}</p>
                    <p className="text-gray-700 mt-2">Presupuesto: {campaign.budget} Bez-Coin</p>
                    <div className="flex gap-2 mt-4">
                        <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={fetchStats}>Ver Estadísticas</button>
                        {(userRole === 'admin' || userRole === 'advertiser') && (
                            <>
                                <button className="bg-purple-600 text-white px-4 py-2 rounded" onClick={() => setEditing(true)}>Editar</button>
                                <button className="bg-red-600 text-white px-4 py-2 rounded" onClick={handleDelete}>Eliminar</button>
                            </>
                        )}
                    </div>
                    {stats && <AdStatsPanel stats={stats} />}
                </>
            )}
        </div>
    );
};

export default AdCampaignCard;
