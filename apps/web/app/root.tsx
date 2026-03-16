import type { LinksFunction } from 'react-router'

import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router'
import { Toaster } from 'sonner'

import './styles/tailwind.css'
import Analytics from './components/Analytics'

export const links: LinksFunction = () => [
  {
    rel: 'preconnect',
    href: 'https://fonts.googleapis.com',
  },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap',
  },
]

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="bg-surface-50 text-surface-900 h-full font-sans antialiased">
        {children}
        <Analytics />
        <Toaster richColors position="top-right" />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}

export function ErrorBoundary({ error }: { error: unknown }) {
  let message = 'Oops!'
  let details = 'An unexpected error occurred.'
  let stack: string | undefined

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error'
    details =
      error.status === 404 ? 'The requested page could not be found.' : error.statusText || details
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message
    stack = error.stack
  }

  return (
    <main className="flex min-h-full flex-col items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-primary-600 text-6xl font-bold">{message}</h1>
        <p className="text-surface-600 mt-4 text-lg">{details}</p>
        {stack && (
          <pre className="bg-surface-100 text-surface-700 mt-6 max-w-2xl overflow-auto rounded-lg p-4 text-left text-sm">
            {stack}
          </pre>
        )}
        <a
          href="/"
          className="bg-primary-600 hover:bg-primary-700 mt-6 inline-block rounded-lg px-6 py-3 font-medium text-white transition-colors"
        >
          Go back home
        </a>
      </div>
    </main>
  )
}
