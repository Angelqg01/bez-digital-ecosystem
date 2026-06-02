import React from 'react';

const Input = React.forwardRef(({
    type = 'text',
    placeholder,
    value,
    onChange,
    disabled,
    className = '',
    ...props
}, ref) => {
    const baseStyles = 'w-full px-4 py-2 rounded-lg border bg-gray-800 text-white border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50';

    return (
        <input
            ref={ref}
            type={type}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            disabled={disabled}
            className={`${baseStyles} ${className}`}
            {...props}
        />
    );
});

Input.displayName = 'Input';

export default Input;
export { Input };
