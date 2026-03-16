import { cn } from '~/lib/utils'

interface SwitchProps {
  checked: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
  name?: string
  value?: string
}

const sizeClasses = {
  sm: {
    track: 'h-5 w-9',
    thumb: 'h-4 w-4',
    translate: 'translate-x-4',
  },
  md: {
    track: 'h-6 w-11',
    thumb: 'h-5 w-5',
    translate: 'translate-x-5',
  },
  lg: {
    track: 'h-7 w-14',
    thumb: 'h-6 w-6',
    translate: 'translate-x-7',
  },
}

export function Switch({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  className,
  name,
  value,
}: SwitchProps) {
  const sizes = sizeClasses[size]

  if (!onChange) {
    return (
      <span
        role="switch"
        aria-checked={checked}
        className={cn(
          'pointer-events-none relative inline-flex shrink-0 rounded-full transition-colors duration-200 ease-in-out',
          sizes.track,
          checked ? 'bg-primary-600' : 'bg-surface-300',
          disabled && 'opacity-50',
          className,
        )}
      >
        {name && <input type="hidden" name={name} value={value ?? String(checked)} />}
        <span
          className={cn(
            'pointer-events-none absolute top-0.5 left-0.5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out',
            sizes.thumb,
            checked && sizes.translate,
          )}
        />
      </span>
    )
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'focus-visible:ring-primary-500 relative inline-flex shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        sizes.track,
        checked ? 'bg-primary-600' : 'bg-surface-300',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      {name && <input type="hidden" name={name} value={value ?? String(checked)} />}
      <span
        className={cn(
          'pointer-events-none absolute top-0.5 left-0.5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out',
          sizes.thumb,
          checked && sizes.translate,
        )}
      />
    </button>
  )
}
