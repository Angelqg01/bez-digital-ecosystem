import React from 'react';
import { Plus } from 'lucide-react';

const StoriesRail = () => {
    const stories = [
        { id: 1, user: 'User 1', viewed: false },
        { id: 2, user: 'User 2', viewed: true },
        { id: 3, user: 'User 3', viewed: false },
        { id: 4, user: 'User 4', viewed: false },
    ];

    return (
        <div className="flex space-x-3 overflow-x-auto pb-4 no-scrollbar">
            {/* Create Story Card */}
            <div className="flex-shrink-0 w-28 h-48 relative rounded-xl overflow-hidden bg-gray-900 group cursor-pointer">
                <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=60"
                    alt="Your Story"
                    className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-end pb-3">
                    <div className="bg-blue-600 rounded-full p-1 mb-2 border-2 border-white dark:border-gray-900">
                        <Plus size={20} className="text-white" />
                    </div>
                    <span className="text-white text-xs font-medium">Create Story</span>
                </div>
            </div>

            {stories.map((story) => (
                <div
                    key={story.id}
                    className={`flex-shrink-0 w-28 h-48 relative rounded-xl overflow-hidden cursor-pointer group border-2 ${story.viewed ? 'border-gray-200 dark:border-gray-700' : 'border-blue-500'}`}
                >
                    <img
                        src={`https://images.unsplash.com/photo-${1500000000000 + story.id}?w=500&auto=format&fit=crop&q=60`}
                        alt={story.user}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2 left-2">
                        <div className={`w-8 h-8 rounded-full border-2 border-white dark:border-gray-900 overflow-hidden`}>
                            <img
                                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${story.user}`}
                                alt="avatar"
                                className="w-full h-full bg-white"
                            />
                        </div>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60 flex items-end p-2">
                        <span className="text-white text-xs font-medium truncate w-full">{story.user}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default StoriesRail;
