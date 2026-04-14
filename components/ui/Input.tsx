import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    error?: string;
    label?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, error, label, id, ...props }, ref) => {
        const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

        return (
            <div className="w-full">
                {label && (
                    <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-foreground">
                        {label}
                    </label>
                )}
                <input
                    type={type}
                    id={inputId}
                    ref={ref}
                    className={cn(
                        'w-full rounded-xl border bg-background px-4 py-2.5 text-sm text-foreground transition-all duration-200',
                        'placeholder:text-muted-foreground',
                        'focus:outline-none focus:ring-2',
                        'hover:border-border/80',
                        error
                            ? 'border-destructive focus:border-destructive focus:ring-destructive/15'
                            : 'border-input focus:border-primary/40 focus:ring-primary/15',
                        'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted',
                        className
                    )}
                    {...props}
                />
                {error && (
                    <p className="mt-1.5 text-sm text-destructive flex items-center gap-1">
                        <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                        {error}
                    </p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

export { Input };
