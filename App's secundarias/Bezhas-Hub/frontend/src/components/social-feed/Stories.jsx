import React from 'react';

const Stories = ({ stories = [] }) => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-3 dark:text-white">Stories</h3>
            <div className="flex space-x-4 overflow-x-auto pb-2">
                {stories.length > 0 ? (
                    stories.map((story) => (
                        <div key={story.id} className="flex-shrink-0 flex flex-col items-center space-y-1">
                            <div className="w-16 h-16 rounded-full ring-2 ring-pink-500 p-1">
                                <img
                                    src={story.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${story.user}`}
                                    alt={story.user}
                                    className="w-full h-full rounded-full object-cover"
                                />
                            </div>
                            <span className="text-xs truncate w-16 text-center dark:text-gray-300">
                                {story.user}
                            </span>
                        </div>
                    ))
                ) : (
                    <p className="text-gray-500 text-sm">No stories available</p>
                )}
            </div>
        </div>
    );
};

export default Stories;
