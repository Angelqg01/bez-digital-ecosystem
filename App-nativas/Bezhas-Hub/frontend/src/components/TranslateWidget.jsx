import React from 'react';

const TranslateWidget = () => {
    return (
        <div className="flex items-center justify-center p-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
            {/* The ID must match the one in the script in index.html */}
            <div id="google_translate_element"></div>
        </div>
    );
};

export default TranslateWidget;
