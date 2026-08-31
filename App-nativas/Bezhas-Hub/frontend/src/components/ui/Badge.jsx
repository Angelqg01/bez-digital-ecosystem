import React from 'react';

const Badge = ({ children, variant = 'default', className = '' }) => {
    const baseStyles = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold transition-colors duration-200';

    const variants = {
        default: 'bg-gray-700 text-gray-200',
        primary: 'bg-blue-600 text-white',
        success: 'bg-green-600 text-white',
        warning: 'bg-yellow-600 text-white',
        danger: 'bg-red-600 text-white',
        info: 'bg-cyan-600 text-white',
        outline: 'bg-transparent border border-gray-600 text-gray-300',
    };

    return (
        <span className={`${baseStyles} ${variants[variant]} ${className}`}>
            {children}
        </span>
    );
};

export default Badge;
export { Badge };
