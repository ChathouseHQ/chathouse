import {
  PaperclipIcon,
  CameraIcon,
  GearIcon,
  TrashIcon,
  BookmarkSimpleIcon,
  PencilSimpleIcon,
  FileTextIcon,
  SignOutIcon,
} from '@phosphor-icons/react'
import { useRef, useEffect } from 'react'

import { cn } from '~/lib/utils'

import { Text } from './Text'

interface MenuProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'end' | 'center'
}

interface MenuItemProps {
  children: React.ReactNode
  icon?: React.ReactNode
  onClick?: () => void
  href?: string
  target?: string
  rel?: string
  variant?: 'default' | 'danger'
  disabled?: boolean
  className?: string
}

export function Menu({
  isOpen,
  onClose,
  children,
  className,
  position = 'bottom',
  align = 'start',
}: MenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const positionClasses = {
    top: 'bottom-full mb-2',
    bottom: 'top-full mt-2',
    left: 'right-full mr-2',
    right: 'left-full ml-2',
  }

  const alignClasses = {
    start: 'left-0',
    end: 'right-0',
    center: 'left-1/2 -translate-x-1/2',
  }

  return (
    <div
      ref={menuRef}
      className={cn(
        'ring-surface-200 absolute z-50 min-w-[180px] rounded-md bg-white p-1 shadow-lg ring-1',
        positionClasses[position],
        alignClasses[align],
        className,
      )}
    >
      {children}
    </div>
  )
}

export function MenuItem({
  children,
  icon,
  onClick,
  href,
  target,
  rel,
  variant = 'default',
  disabled = false,
  className,
}: MenuItemProps) {
  const baseClasses = cn(
    'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors',
    disabled && 'cursor-not-allowed opacity-50',
    variant === 'default' && 'text-surface-700 hover:bg-surface-100',
    variant === 'danger' && 'text-red-600 hover:bg-red-50',
    className,
  )

  const content = (
    <>
      {icon && <span className="h-4 w-4 shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      <Text as="span" size="sm" weight="medium" colour="inherit">
        {children}
      </Text>
    </>
  )

  if (href) {
    return (
      <a
        href={href}
        target={target}
        rel={rel}
        className={baseClasses}
        onClick={disabled ? (e) => e.preventDefault() : undefined}
      >
        {content}
      </a>
    )
  }

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={baseClasses}
    >
      {content}
    </button>
  )
}

export const MenuIcons = {
  Attachment: () => <PaperclipIcon />,
  Camera: () => <CameraIcon />,
  Settings: () => <GearIcon />,
  Trash: () => <TrashIcon />,
  Pin: () => <BookmarkSimpleIcon />,
  Edit: () => <PencilSimpleIcon />,
  Docs: () => <FileTextIcon />,
  Logout: () => <SignOutIcon />,
}
