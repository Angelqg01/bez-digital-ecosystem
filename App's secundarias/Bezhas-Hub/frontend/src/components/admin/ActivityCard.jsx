import React from 'react';
import { UserPlus, FileText, Users, Clock, MessageSquare, Heart } from 'lucide-react';

/**
 * Componente para mostrar actividad reciente del sistema
 * @param {object} activity - Objeto con datos de la actividad
 */
const ActivityCard = ({ activity }) => {
    const getIcon = (type) => {
        switch (type) {
            case 'user_registered':
                return <UserPlus className="h-5 w-5 text-blue-500" />;
            case 'post_created':
                return <FileText className="h-5 w-5 text-green-500" />;
            case 'group_created':
                return <Users className="h-5 w-5 text-purple-500" />;
            case 'comment':
                return <MessageSquare className="h-5 w-5 text-orange-500" />;
            case 'like':
                return <Heart className="h-5 w-5 text-red-500" />;
            default:
                return <Clock className="h-5 w-5 text-gray-500" />;
        }
    };

    const getDescription = (type, data) => {
        switch (type) {
            case 'user_registered':
                return `${data.username} se ha registrado`;
            case 'post_created':
                return `${data.author} publicó "${data.title}"`;
            case 'group_created':
                return `Nuevo grupo creado: ${data.groupName}`;
            case 'comment':
                return `${data.username} comentó en una publicación`;
            case 'like':
                return `${data.username} le dio like a una publicación`;
            default:
                return 'Actividad del sistema';
        }
    };

    return (
        <div className="flex items-start space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <div className="flex-shrink-0 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                {getIcon(activity.type)}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {getDescription(activity.type, activity.data)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(activity.timestamp).toLocaleString('es-ES')}
                </p>
            </div>
        </div>
    );
};

export default ActivityCard;
