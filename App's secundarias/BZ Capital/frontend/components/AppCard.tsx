import React from 'react';
import { Download } from 'lucide-react';

export interface LiveAppProps {
    id: string;
    name: string;
    description: string;
    url: string;
}

export default function AppCard({ id, name, description, url }: LiveAppProps) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow p-6 flex flex-col justify-between h-full">
            <div>
                <h3 className="text-xl font-bold text-gray-800 mb-3">{name}</h3>
                <p className="text-gray-600 mb-6 text-sm">{description}</p>
            </div>
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl font-medium transition-colors"
                data-testid={`app-link-${id}`}
            >
                <Download className="w-5 h-5" />
                Descargar / Acceder
            </a>
        </div>
    );
}
