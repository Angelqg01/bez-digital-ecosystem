import React from 'react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';

const SimpleFunctionCard = ({ id, title, desc, path, color, icon, status }) => {
    const navigate = useNavigate();
    const IconComponent = Icons[icon] || Icons.Zap;

    return (
        <div
            onClick={() => navigate(path)}
            className="group relative bg-white dark:bg-gray-800 rounded-xl p-6 hover:shadow-2xl transition-all duration-300 cursor-pointer border border-gray-200 dark:border-gray-700"
        >
            {/* Status Badge */}
            {status === 'beta' && (
                <div className="absolute top-3 right-3 px-2 py-1 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 text-xs font-semibold rounded-full">
                    BETA
                </div>
            )}

            {/* Icon */}
            <div className={`p-3 rounded-xl bg-gradient-to-br ${color} mb-4 inline-flex shadow-lg`}>
                <IconComponent className="w-6 h-6 text-white" />
            </div>

            {/* Content */}
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-purple-400 group-hover:to-pink-600 transition-all">
                {title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                {desc}
            </p>

            {/* Hover Arrow */}
            <div className="mt-4 flex items-center text-sm font-semibold text-purple-600 dark:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
                Abrir <Icons.ArrowRight className="w-4 h-4 ml-1" />
            </div>
        </div>
    );
};

export default SimpleFunctionCard;
