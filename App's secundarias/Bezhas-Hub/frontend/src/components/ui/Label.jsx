import React from 'react';

const Label = ({ children, htmlFor, className = '', required = false }) => {
    const baseStyles = 'block text-sm font-medium text-gray-300 mb-1';

    return (
        <label
            htmlFor={htmlFor}
            className={`${baseStyles} ${className}`}
        >
            {children}
            {required && <span className="text-red-500 ml-1">*</span>}
        </label>
    );
};

export default Label;
export { Label };
