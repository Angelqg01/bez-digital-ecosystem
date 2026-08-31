import React from 'react';

const Suggestions = () => {
    const suggestions = [
        { id: 1, name: 'Crypto King', mutuals: 12 },
        { id: 2, name: 'NFT Artist', mutuals: 8 },
        { id: 3, name: 'DeFi Expert', mutuals: 5 },
    ];

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold mb-4 dark:text-white">People You Might Know</h3>
            <div className="space-y-4">
                {suggestions.map((user) => (
                    <div key={user.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                <img
                                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`}
                                    alt={user.name}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div>
                                <p className="text-sm font-medium dark:text-white">{user.name}</p>
                                <p className="text-xs text-gray-500">{user.mutuals} mutual friends</p>
                            </div>
                        </div>
                        <button className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
                            Follow
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Suggestions;
