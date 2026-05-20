import type { Provider } from '~/lib/models'

import { PROVIDER_NAMES } from '~/lib/providers'
import { cn } from '~/lib/utils'

type LogoSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl'

interface ProviderLogoProps {
  provider: Provider
  size?: LogoSize
  className?: string
  showBackground?: boolean
}

const sizeClasses: Record<LogoSize, { container: string; icon: string }> = {
  sm: { container: 'h-6 w-6', icon: 'h-4 w-4' },
  md: { container: 'h-8 w-8', icon: 'h-5 w-5' },
  lg: { container: 'h-10 w-10', icon: 'h-6 w-6' },
  xl: { container: 'h-12 w-12', icon: 'h-7 w-7' },
  '2xl': { container: 'h-14 w-14', icon: 'h-8 w-8' },
}

const backgroundClasses: Record<Provider, string> = {
  openai: 'bg-[#10a37f]/10',
  anthropic: 'bg-[#d97757]/10',
  google: 'bg-[#4285F4]/10',
  ollama: 'bg-surface-900/10',
}

function OpenAILogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 320 320" fill="currentColor">
      <path d="m297.06 130.97c7.26-21.79 4.76-45.66-6.85-65.48-17.46-30.4-52.56-46.04-86.84-38.68-15.25-17.18-37.16-26.95-60.13-26.81-35.04-.08-66.13 22.48-76.91 55.82-22.51 4.61-41.94 18.7-53.31 38.67-17.59 30.32-13.58 68.54 9.92 94.54-7.26 21.79-4.76 45.66 6.85 65.48 17.46 30.4 52.56 46.04 86.84 38.68 15.24 17.18 37.16 26.95 60.13 26.8 35.06.09 66.16-22.49 76.94-55.86 22.51-4.61 41.94-18.7 53.31-38.67 17.57-30.32 13.55-68.51-9.94-94.51zm-120.28 168.11c-14.03.02-27.62-4.89-38.39-13.88.49-.26 1.34-.73 1.89-1.07l63.72-36.8c3.26-1.85 5.26-5.32 5.24-9.07v-89.83l26.93 15.55c.29.14.48.42.52.74v74.39c-.04 33.08-26.83 59.9-59.91 59.97zm-128.84-55.03c-7.03-12.14-9.56-26.37-7.15-40.18.47.28 1.3.79 1.89 1.13l63.72 36.8c3.23 1.89 7.23 1.89 10.47 0l77.79-44.92v31.1c.02.32-.13.63-.38.83l-64.41 37.19c-28.69 16.52-65.33 6.7-81.92-21.95zm-16.77-139.09c7-12.16 18.05-21.46 31.21-26.29 0 .55-.03 1.52-.03 2.2v73.61c-.02 3.74 1.98 7.21 5.23 9.06l77.79 44.91-26.93 15.55c-.27.18-.61.21-.91.08l-64.42-37.22c-28.63-16.58-38.45-53.21-21.95-81.89zm221.26 51.49-77.79-44.92 26.93-15.54c.27-.18.61-.21.91-.08l64.42 37.19c28.68 16.57 38.51 53.26 21.94 81.94-7.01 12.14-18.05 21.44-31.2 26.28v-75.81c.03-3.74-1.96-7.2-5.2-9.06zm26.8-40.34c-.47-.29-1.3-.79-1.89-1.13l-63.72-36.8c-3.23-1.89-7.23-1.89-10.47 0l-77.79 44.92v-31.1c-.02-.32.13-.63.38-.83l64.41-37.16c28.69-16.55 65.37-6.7 81.91 22 6.99 12.12 9.52 26.31 7.15 40.1zm-168.51 55.43-26.94-15.55c-.29-.14-.48-.42-.52-.74v-74.39c.02-33.12 26.89-59.96 60.01-59.94 14.01 0 27.57 4.92 38.34 13.88-.49.26-1.33.73-1.89 1.07l-63.72 36.8c-3.26 1.85-5.26 5.31-5.24 9.06l-.04 89.79zm14.63-31.54 34.65-20.01 34.65 20v40.01l-34.65 20-34.65-20z" />
    </svg>
  )
}

function AnthropicLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 92.2 65" fill="currentColor">
      <path d="M66.5,0H52.4l25.7,65h14.1L66.5,0z M25.7,0L0,65h14.4l5.3-13.6h26.9L51.8,65h14.4L40.5,0C40.5,0,25.7,0,25.7,0z   M24.3,39.3l8.8-22.8l8.8,22.8H24.3z" />
    </svg>
  )
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
      <path d="M1 1h22v22H1z" fill="none" />
    </svg>
  )
}

function OllamaLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3.25c5.05 0 8.75 3.72 8.75 8.75s-3.7 8.75-8.75 8.75S3.25 17.03 3.25 12 6.95 3.25 12 3.25Z"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      <path
        d="M8.75 12c0-2.12 1.27-3.55 3.25-3.55s3.25 1.43 3.25 3.55-1.27 3.55-3.25 3.55S8.75 14.12 8.75 12Z"
        fill="currentColor"
      />
    </svg>
  )
}

const logoColors: Record<Provider, string> = {
  openai: 'text-black',
  anthropic: 'text-[#d97757]',
  google: '',
  ollama: 'text-surface-900',
}

export function ProviderLogo({
  provider,
  size = 'md',
  className,
  showBackground = false,
}: ProviderLogoProps) {
  const sizes = sizeClasses[size]

  const Logo = {
    openai: OpenAILogo,
    anthropic: AnthropicLogo,
    google: GoogleLogo,
    ollama: OllamaLogo,
  }[provider]

  if (showBackground) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg',
          sizes.container,
          backgroundClasses[provider],
          className,
        )}
      >
        <Logo className={cn(sizes.icon, logoColors[provider])} />
      </div>
    )
  }

  return <Logo className={cn(sizes.icon, logoColors[provider], className)} />
}

export { PROVIDER_NAMES }
