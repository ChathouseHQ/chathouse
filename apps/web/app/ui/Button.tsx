import { SpinnerGapIcon } from '@phosphor-icons/react'
import { forwardRef } from 'react'

import { cn } from '~/lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-surface-900 text-white hover:bg-surface-800 focus-visible:ring-surface-500',
  secondary:
    'border border-surface-300 bg-white text-surface-700 hover:bg-surface-50 focus-visible:ring-surface-500',
  ghost: 'text-surface-700 hover:bg-surface-100 focus-visible:ring-surface-500',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
  'danger-ghost': 'text-red-600 hover:bg-red-50 focus-visible:ring-red-500',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = 'primary', size = 'md', disabled, isLoading, children, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
          'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
          'disabled:pointer-events-none disabled:opacity-50',
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      >
        {isLoading ? (
          <>
            <SpinnerGapIcon className="h-4 w-4 animate-spin" />
            <span>{children}</span>
          </>
        ) : (
          children
        )}
      </button>
    )
  },
)

Button.displayName = 'Button'
