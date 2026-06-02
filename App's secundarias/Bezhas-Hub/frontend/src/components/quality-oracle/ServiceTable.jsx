import React from 'react';

export const ServiceTable = ({ services, onFinalize }) => (
    <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full leading-normal">
            <thead>
                <tr>
                    <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID</th>
                    <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Client</th>
                    <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
            </thead>
            <tbody>
                {services.map((service) => (
                    <tr key={service.id}>
                        <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{service.id}</td>
                        <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{service.clientWallet.substring(0, 6)}...</td>
                        <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                            <span className={`relative inline-block px-3 py-1 font-semibold leading-tight ${service.status === 'COMPLETED' ? 'text-green-900' : 'text-yellow-900'}`}>
                                <span aria-hidden className={`absolute inset-0 opacity-50 rounded-full ${service.status === 'COMPLETED' ? 'bg-green-200' : 'bg-yellow-200'}`}></span>
                                <span className="relative">{service.status}</span>
                            </span>
                        </td>
                        <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                            <button onClick={() => onFinalize(service.id)} className="text-blue-600 hover:text-blue-900">Finalize</button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);
