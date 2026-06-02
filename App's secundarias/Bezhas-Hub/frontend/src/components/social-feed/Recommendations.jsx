import React from 'react';

const Recommendations = () => {
    const topics = [
        { id: 1, tag: '#DeFi', posts: '12.5K' },
        { id: 2, tag: '#Ethereum', posts: '45.2K' },
        { id: 3, tag: '#Web3Gaming', posts: '8.1K' },
        { id: 4, tag: '#NFTDrops', posts: '22.4K' },
    ];

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm mt-6">
            <h3 className="font-semibold mb-4 dark:text-white">Trending Topics</h3>
            <div className="space-y-3">
                {topics.map((topic) => (
                    <div key={topic.id} className="flex items-center justify-between group cursor-pointer">
                        <div>
                            <p className="text-sm font-medium dark:text-gray-200 group-hover:text-blue-500 transition-colors">
                                {topic.tag}
                            </p>
                            <p className="text-xs text-gray-500">{topic.posts} posts</p>
                        </div>
                        <span className="text-gray-400">•••</span>
                    </div>
                ))}
            </div>
            <button className="w-full mt-4 text-sm text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-50 dark:hover:bg-gray-700 py-2 rounded-lg transition-colors">
                Show More
            </button>
        </div>
    );
};

export default Recommendations;
