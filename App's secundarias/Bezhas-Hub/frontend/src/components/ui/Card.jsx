import React from 'react';
import './Card.css';

const Card = ({ children, className = '' }) => {
  return (
    <div className={`card-container ${className}`}>
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className = '' }) => <div className={`card-header ${className}`}>{children}</div>;
export const CardTitle = ({ children, className = '' }) => <h3 className={`card-title font-bold text-lg ${className}`}>{children}</h3>;
export const CardDescription = ({ children, className = '' }) => <p className={`card-description text-sm text-gray-500 ${className}`}>{children}</p>;
export const CardContent = ({ children, className = '' }) => <div className={`card-content ${className}`}>{children}</div>;
export const CardFooter = ({ children, className = '' }) => <div className={`card-footer ${className}`}>{children}</div>;

export { Card };
export default Card;
