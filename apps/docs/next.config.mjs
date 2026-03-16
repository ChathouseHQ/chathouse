import { createMDX } from 'fumadocs-mdx/next'
import path from 'node:path'

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const config = {
  basePath: '/docs',
  skipTrailingSlashRedirect: true,
  reactStrictMode: true,
  turbopack: {
    root: path.resolve(import.meta.dirname, '../..'),
  },
  async rewrites() {
    return [
      {
        source: '/:path*.mdx',
        destination: '/llms.mdx/:path*',
      },
    ]
  },
}

export default withMDX(config)
