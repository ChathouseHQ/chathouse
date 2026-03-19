import { redis } from './redis.server'

const GITHUB_REPO = 'ChathouseHQ/chathouse'
const CACHE_KEY = 'chathouse:latest_release'
const CACHE_TTL = 3600 // 1 hour

const CURRENT_VERSION = (process.env.APP_VERSION || 'dev').replace(/^v/, '')

interface LatestRelease {
  version: string
  url: string
}

interface VersionInfo {
  currentVersion: string
  latestVersion: string | null
  latestReleaseUrl: string | null
  updateAvailable: boolean
}

function compareVersions(a: string, b: string): number {
  const partsA = a.replace(/^v/, '').split('.').map(Number)
  const partsB = b.replace(/^v/, '').split('.').map(Number)
  const len = Math.max(partsA.length, partsB.length)

  for (let i = 0; i < len; i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

async function getLatestRelease(): Promise<LatestRelease | null> {
  try {
    const cached = await redis.get(CACHE_KEY)
    if (cached) {
      return JSON.parse(cached) as LatestRelease
    }
  } catch {
    // Redis unavailable, continue without cache
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Chathouse',
      },
    })

    if (!res.ok) return null

    const data = await res.json()
    const release: LatestRelease = {
      version: (data.tag_name as string).replace(/^v/, ''),
      url: data.html_url as string,
    }

    try {
      await redis.set(CACHE_KEY, JSON.stringify(release), 'EX', CACHE_TTL)
    } catch {
      // Redis unavailable, skip caching
    }

    return release
  } catch {
    return null
  }
}

export async function getVersionInfo(): Promise<VersionInfo> {
  const release = await getLatestRelease()

  if (!release) {
    return {
      currentVersion: CURRENT_VERSION,
      latestVersion: null,
      latestReleaseUrl: null,
      updateAvailable: false,
    }
  }

  return {
    currentVersion: CURRENT_VERSION,
    latestVersion: release.version,
    latestReleaseUrl: release.url,
    updateAvailable: compareVersions(release.version, CURRENT_VERSION) > 0,
  }
}
