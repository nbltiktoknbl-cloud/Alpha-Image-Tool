
import React from 'react';

// FIX: Extend standard button attributes to allow props like 'title'.
// Omit the standard 'onClick' to replace it with our own required signature.
interface ActionButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({ onClick, disabled = false, children, variant = 'primary', className = '', ...rest }) => {
  const baseClasses = "px-6 py-3 font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variantClasses = {
    primary: 'bg-teal-500 hover:bg-teal-600 focus:ring-teal-400 text-white',
    secondary: 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-500 text-white',
    danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
};

export default ActionButton;
