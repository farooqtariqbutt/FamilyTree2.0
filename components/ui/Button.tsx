
import React from 'react';

type ButtonProps<C extends React.ElementType> = {
  as?: C;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
} & React.ComponentPropsWithoutRef<C>;

const Button = <C extends React.ElementType = 'button'>({ as, children, variant = 'primary', size = 'md', className = '', ...props }: ButtonProps<C>) => {
  const Component = as || 'button';
  
  const baseClasses = "rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 flex items-center justify-center";
  
  const sizeClasses = {
      md: "px-4 py-2 text-sm",
      sm: "px-2 py-1 text-xs"
  };

  const variantClasses = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
    secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 focus:ring-gray-500",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
  };

  return (
    <Component className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </Component>
  );
};

export default Button;
