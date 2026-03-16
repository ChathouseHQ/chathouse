import { cn } from '~/lib/utils'
import { Text } from '~/ui/Text'

interface TabHeaderProps {
  icon: React.ElementType
  label: string
  description: string
  iconColorClass?: string
}

export const TabHeader = ({
  icon: Icon,
  label,
  description,
  iconColorClass = 'text-surface-500',
}: TabHeaderProps) => {
  return (
    <div className="mb-6">
      <div className="flex items-start gap-4">
        <div className="border-surface-200 flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border p-2">
          <Icon className={cn('h-full w-full', iconColorClass)} weight="duotone" />
        </div>
        <div>
          <Text as="h2" size="lg" weight="semibold">
            {label}
          </Text>
          <Text as="p" size="sm" colour="muted">
            {description}
          </Text>
        </div>
      </div>
      <hr className="border-surface-200 mt-6" />
    </div>
  )
}
