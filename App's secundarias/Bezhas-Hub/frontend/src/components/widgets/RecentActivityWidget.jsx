import React from 'react';
import { Activity } from 'lucide-react';

const mockRecentActivity = [
    {
        user: 'Laura P.',
        action: 'publicó en Desarrollo Web',
        time: 'Hace 5 minutos'
    },
    {
        user: 'David S.',
        action: 'comentó tu post',
        time: 'Hace 12 minutos'
    },
    {
        user: 'Sofia R.',
        action: 'te mencionó en un grupo',
        time: 'Hace 25 minutos'
    },
    {
        user: 'Miguel A.',
        action: 'compartió tu contenido',
        time: 'Hace 1 hora'
    }
];

export default function RecentActivityWidget() {
    return (
        <div className="rounded-lg bg-gray-800 dark:bg-gray-200 p-4 border border-gray-700 dark:border-gray-300 mb-4">
            <div className="flex items-center gap-2 mb-3">
                <Activity className="w-5 h-5 text-blue-500" />
                <h3 className="font-semibold text-white dark:text-gray-900">Actividad Reciente</h3>
            </div>
            <div className="space-y-3">
                {mockRecentActivity.map((activity, idx) => (
                    <div
                        key={idx}
                        className="text-sm hover:bg-gray-700 dark:hover:bg-gray-300 p-2 rounded transition-colors"
                    >
                        <p className="text-gray-300 dark:text-gray-700">
                            <span className="font-semibold text-purple-400 dark:text-purple-600">
                                {activity.user}
                            </span>{' '}
                            {activity.action}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-600 mt-1">
                            {activity.time}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}
