import React, { ButtonHTMLAttributes } from 'react';
import { cn } from './Card'; // Reusing the cn utility
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, children, disabled, ...props }, ref) => {
    
    const variants = {
      primary: 'btn-primary',
      secondary: 'btn-secondary',
      outline: 'border-2 border-slate-200 hover:border-indigo-500 hover:bg-slate-50 text-slate-700 dark:border-slate-700 dark:hover:border-indigo-500 dark:text-slate-300 dark:hover:bg-slate-800',
      ghost: 'hover:bg-slate-100 text-slate-700 dark:hover:bg-slate-800 dark:text-slate-300',
      danger: 'bg-red-500 hover:bg-red-600 text-white shadow-sm',
    };

    const sizes = {
      sm: 'py-1.5 px-3 text-sm rounded-lg',
      md: 'py-2 px-4 rounded-xl',
      lg: 'py-3 px-6 text-lg rounded-xl',
    };

    const baseClasses = 'inline-flex items-center justify-center font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none gap-2';
    
    // btn-primary & btn-secondary have padding built-in via index.css, so adjust carefully
    const isCustomBase = variant === 'primary' || variant === 'secondary';

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          isCustomBase ? variants[variant] : cn(baseClasses, variants[variant], sizes[size]),
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
