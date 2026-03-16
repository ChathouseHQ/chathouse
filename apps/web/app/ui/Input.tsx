import { EyeIcon, EyeSlashIcon } from '@phosphor-icons/react'
import { forwardRef, useState } from 'react'

import { cn } from '~/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string | React.ReactNode
  hint?: string
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
  error?: boolean
  rightElement?: React.ReactNode
  revealable?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      hint,
      icon,
      iconPosition = 'left',
      error,
      rightElement,
      revealable,
      type = 'text',
      id,
      ...props
    },
    ref,
  ) => {
    const [revealed, setRevealed] = useState(false)
    const hasIcon = !!icon
    const resolvedType = revealable ? (revealed ? 'text' : 'password') : type
    const revealButton = revealable ? (
      <button
        type="button"
        onClick={() => setRevealed(!revealed)}
        className="text-surface-400 hover:text-surface-600"
      >
        {revealed ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
      </button>
    ) : null
    const resolvedRightElement = revealButton ?? rightElement
    const hasRightElement = !!resolvedRightElement

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className="text-surface-700 mb-1.5 block text-sm font-medium">
            {label}
          </label>
        )}
        <div className="relative">
          {hasIcon && iconPosition === 'left' && (
            <div className="text-surface-400 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
              {icon}
            </div>
          )}
          <input
            type={resolvedType}
            id={id}
            ref={ref}
            className={cn(
              'text-surface-900 placeholder:text-surface-400 block w-full rounded-lg border bg-white px-4 py-2.5 transition-colors',
              'focus:border-primary-500 focus:ring-primary-500/20 focus:ring-2 focus:outline-none',
              error
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                : 'border-surface-300',
              hasIcon && iconPosition === 'left' && 'pl-10',
              hasIcon && iconPosition === 'right' && 'pr-10',
              hasRightElement && 'pr-12',
              className,
            )}
            {...props}
          />
          {hasIcon && iconPosition === 'right' && !hasRightElement && (
            <div className="text-surface-400 pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
              {icon}
            </div>
          )}
          {hasRightElement && (
            <div className="absolute inset-y-0 right-3 flex items-center">
              {resolvedRightElement}
            </div>
          )}
        </div>
        {hint && <p className="text-surface-500 mt-1.5 text-sm">{hint}</p>}
      </div>
    )
  },
)

Input.displayName = 'Input'
