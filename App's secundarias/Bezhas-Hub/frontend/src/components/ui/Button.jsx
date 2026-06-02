import React from 'react';

const Button = ({ children, onClick, disabled, className, variant = 'primary' }) => {
  const baseStyles = 'px-4 py-2 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200';

  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500',
    outline: 'bg-transparent border border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white',
  };

  const disabledStyles = 'disabled:bg-gray-400 disabled:cursor-not-allowed';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${disabledStyles} ${className}`}
    >
      {children}
    </button>
  );
};

export default Button;
export { Button };
