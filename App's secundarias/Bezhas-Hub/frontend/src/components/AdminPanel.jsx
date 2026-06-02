import React from 'react';
import { toast } from 'react-hot-toast';

const AdminPanel = ({ campaigns, onDeleteCampaign, onManageUsers }) => {
  return (
    <div className="bg-red-50 border border-red-300 rounded-xl p-6 mt-8">
      <h2 className="text-xl font-bold text-red-700 mb-4">Panel de Administración</h2>
      <div className="mb-6">
        <h3 className="font-semibold mb-2">Gestionar Campañas</h3>
        <ul className="space-y-2">
          {campaigns.map(camp => (
            <li key={camp.id} className="flex justify-between items-center bg-white rounded shadow p-2">
              <span>{camp.text} <span className="text-xs text-gray-500">(ID: {camp.id})</span></span>
              <button
                className="bg-red-600 text-white px-3 py-1 rounded"
                onClick={() => {
                  onDeleteCampaign(camp.id);
                  toast.success('Campaña eliminada');
                }}
              >Eliminar</button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="font-semibold mb-2">Gestionar Usuarios</h3>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          onClick={onManageUsers}
        >Ver y gestionar usuarios</button>
      </div>
    </div>
  );
};

export default AdminPanel;
