import { cn } from '~/lib/utils'

type BadgeVariant = 'default' | 'openai' | 'anthropic' | 'google' | 'success' | 'warning' | 'error'
type BadgeSize = 'sm' | 'md' | 'lg'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  size?: BadgeSize
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-surface-100 text-surface-700',
  openai: 'bg-emerald-100 text-emerald-700',
  anthropic: 'bg-orange-100 text-orange-700',
  google: 'bg-blue-100 text-blue-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  error: 'bg-red-100 text-red-700',
}

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
  lg: 'px-2.5 py-1 text-sm',
}

export function Badge({ children, variant = 'default', size = 'md', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded font-medium',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {children}
    </span>
  )
}
