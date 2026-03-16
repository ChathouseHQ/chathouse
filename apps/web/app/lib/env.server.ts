function requireClientUrl(): string {
  const url = process.env.CLIENT_URL

  if (url) {
    return url.replace(/\/+$/, '')
  }

  const env = process.env.NODE_ENV
  if (env === 'development' || env === 'test') {
    return 'http://localhost:3000'
  }

  throw new Error(
    'CLIENT_URL environment variable is not set. ' +
      'Set it to the public URL where Chathouse is accessible (e.g. https://chat.yourdomain.com).',
  )
}

export const CLIENT_URL = requireClientUrl()
