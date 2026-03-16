import { Link } from 'react-router'

import { cn } from '~/lib/utils'

import { Text } from './Text'

interface LogoProps {
  className?: string
  collapsed?: boolean
}

export function Logo({ className, collapsed }: LogoProps) {
  return (
    <Link
      to="/"
      className={cn(
        'hover:bg-surface-200 flex items-center gap-2 rounded-md px-2 py-2 transition-colors',
        collapsed ? 'justify-center' : '',
        className,
      )}
    >
      <div className="text-surface-900 flex shrink-0 items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
          <path
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4L20 10L20 20"
          />
          <line x1="5" y1="12" x2="10.4" y2="12" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="5" y1="15" x2="14" y2="15" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="5" y1="18" x2="14" y2="18" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      {!collapsed && (
        <Text as="span" weight="medium" size="base" className="text-surface-900 tracking-tight">
          Chathouse
        </Text>
      )}
    </Link>
  )
}
