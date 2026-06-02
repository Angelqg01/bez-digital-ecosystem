import React from 'react';

export interface DevApp {
    name: string;
    function: string;
    tags: string[];
}

export interface SectorCardProps {
    sector: string;
    icon: React.ReactNode;
    apps: DevApp[];
}

export default function SectorCard({ sector, icon, apps }: SectorCardProps) {
    return (
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-blue-50 rounded-lg">
                    {icon}
                </div>
                <h3 className="text-2xl font-bold text-gray-800">{sector}</h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {apps.map((app, appIdx) => (
                    <div key={appIdx} className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                        <h4 className="text-lg font-bold text-blue-900 mb-3">{app.name}</h4>
                        <p className="text-gray-600 text-sm leading-relaxed mb-4">
                            <span className="font-semibold text-gray-800">Función: </span>
                            {app.function}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-auto">
                            {app.tags.map(tag => (
                                <span key={tag} className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
