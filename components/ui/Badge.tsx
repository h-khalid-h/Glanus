import { cn } from '@/lib/utils';

export interface BadgeProps {
    children: React.ReactNode;
    variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
    className?: string;
}

export function Badge({ children, variant = 'primary', className }: BadgeProps) {
    const variants = {
        primary: 'bg-primary/10 text-primary border border-primary/15',
        success: 'bg-health-good/10 text-health-good border border-health-good/15',
        warning: 'bg-health-warn/10 text-health-warn border border-health-warn/15',
        danger: 'bg-health-critical/10 text-health-critical border border-health-critical/15',
        info: 'bg-cortex/10 text-cortex border border-cortex/15',
    };

    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
                variants[variant],
                className
            )}
        >
            {children}
        </span>
    );
}
