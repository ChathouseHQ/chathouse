import { cn } from '~/lib/utils'

interface PanelProps {
  children: React.ReactNode
  className?: string
}

export function Panel({ children, className }: PanelProps) {
  return (
    <div className={cn('border-surface-200 rounded-xl border bg-white p-6', className)}>
      {children}
    </div>
  )
}
