import { useEffect } from 'react'
import * as Swetrix from 'swetrix'

const SWETRIX_PID = 'nn8xyNcyPZ6o'

const REFS_TO_IGNORE = [/\/chat\//i, /\/share\//i]

const PATHS_REPLACEMENT_MAP = [
  {
    regex: /^\/chat\//i,
    replacement: '/chat/[id]',
  },
  {
    regex: /^\/share\//i,
    replacement: '/share/[id]',
  },
]

const checkIgnore = (path: string | undefined | null, ignore: RegExp[]) => {
  if (!path) {
    return false
  }

  for (let i = 0; i < ignore.length; ++i) {
    if (ignore[i].test(path)) {
      return true
    }
  }

  return false
}

const getNewPath = (path: string | undefined | null) => {
  if (!path) {
    return path
  }

  for (let i = 0; i < PATHS_REPLACEMENT_MAP.length; ++i) {
    const map = PATHS_REPLACEMENT_MAP[i]

    if (map.regex.test(path)) {
      return map.replacement
    }
  }

  return path
}

export const trackEvent = async (ev: string, meta?: Swetrix.TrackEventOptions['meta']) => {
  console.log('trackEvent', ev, meta)
  try {
    await Swetrix.track({
      ev,
      meta,
    })
    return true
  } catch (reason) {
    console.error('Failed to track custom event:', reason)
    return false
  }
}

export default function Analytics() {
  useEffect(() => {
    Swetrix.init(SWETRIX_PID)
    Swetrix.trackViews({
      callback: ({ pg, ref }) => {
        const result = {
          pg,
          ref,
        } as Swetrix.IPageViewPayload

        result.pg = getNewPath(pg)

        if (checkIgnore(ref, REFS_TO_IGNORE)) {
          result.ref = undefined
        }

        return result
      },
    })
    Swetrix.trackErrors({
      callback: ({ message, pg, filename }) => {
        if (message?.includes('Minified React error')) {
          return false
        }

        // 3rd party extension errors
        if (filename?.includes('chrome-extension://') || filename?.includes('moz-extension://')) {
          return false
        }

        return {
          pg: getNewPath(pg),
        }
      },
    })
  }, [])

  return null
}
