import * as React from 'react'

import { cn } from '~/lib/utils'

interface TooltipProps {
  content: string
  children: React.ReactNode
  className?: string
}

export function Tooltip({ content, children, className }: TooltipProps) {
  return (
    <div className={cn('group relative inline-block', className)}>
      {children}
      <div className="bg-surface-900 pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-xs -translate-x-1/2 scale-95 rounded px-2 py-1.5 text-xs text-white opacity-0 shadow-lg transition-all group-hover:scale-100 group-hover:opacity-100">
        {content}
        <div className="bg-surface-900 absolute top-full left-1/2 -mt-1 h-2 w-2 -translate-x-1/2 rotate-45" />
      </div>
    </div>
  )
}
