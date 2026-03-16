import type { ReactNode } from 'react'

// import { GithubInfo } from "fumadocs-ui/components/github-info";
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { RootProvider } from 'fumadocs-ui/provider/next'

import { source } from '@/lib/source'

import Analytics from './components/Analytics'
import './global.css'

export const metadata = {
  title: {
    template: '%s | Chathouse Docs',
    default: 'Chathouse Docs',
  },
  description: 'Chathouse documentation',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body>
        <RootProvider search={{ options: { api: '/docs/api/search' } }}>
          <DocsLayout
            tree={source.getPageTree()}
            nav={{
              title: (
                <div className="flex items-center gap-2 select-none">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
                    <path
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4L20 10L20 20"
                    />
                    <line
                      x1="5"
                      y1="12"
                      x2="10.4"
                      y2="12"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <line x1="5" y1="15" x2="14" y2="15" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="5" y1="18" x2="14" y2="18" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span className="text-base leading-5 font-medium text-slate-900 dark:text-white">
                    Chathouse
                  </span>
                </div>
              ),
              url: 'https://chathou.se',
            }}
            // links={[
            //   {
            //     type: "custom",
            //     children: <GithubInfo owner="ChathouseHQ" repo="chathouse" className="lg:-mx-2" />,
            //   },
            // ]}
          >
            {children}
          </DocsLayout>
          <Analytics />
        </RootProvider>
      </body>
    </html>
  )
}
