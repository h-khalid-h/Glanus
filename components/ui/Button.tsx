import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
        const baseClasses = [
            'inline-flex items-center justify-center gap-2 rounded-xl font-semibold',
            'transition-all duration-200 ease-out',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'active:scale-[0.97]',
        ].join(' ');

        const variants = {
            primary: 'bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:shadow-md hover:shadow-primary/30 hover:brightness-105 focus-visible:ring-primary/30',
            secondary: 'bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80 hover:border-border/60 focus-visible:ring-border',
            accent: 'bg-cortex text-foreground shadow-sm shadow-cortex/20 hover:shadow-md hover:brightness-105 focus-visible:ring-cortex/30',
            ghost: 'bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-primary/20',
            danger: 'bg-destructive text-foreground shadow-sm shadow-destructive/20 hover:shadow-md hover:brightness-105 focus-visible:ring-destructive/30',
        };

        const sizes = {
            sm: 'px-3 py-1.5 text-xs',
            md: 'px-4 py-2.5 text-sm',
            lg: 'px-6 py-3 text-base',
        };

        return (
            <button type="button"
                ref={ref}
                className={cn(baseClasses, variants[variant], sizes[size], className)}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading && (
                    <svg className="mr-1.5 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                )}
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';

export { Button };
