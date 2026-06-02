import React from 'react';
import Card from '../ui/Card';

export const StatCard = ({ title, value, icon, trend }) => (
    <Card className="p-4 flex items-center justify-between bg-white dark:bg-gray-800 shadow-md">
        <div>
            <p className="text-sm text-gray-500">{title}</p>
            <h3 className="text-2xl font-bold">{value}</h3>
            {trend && <span className={`text-xs ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>{trend}%</span>}
        </div>
        <div className="text-3xl text-blue-600">{icon}</div>
    </Card>
);
