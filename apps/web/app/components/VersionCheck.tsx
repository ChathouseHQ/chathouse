import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

const COOKIE_NAME = 'chathouse_update_dismissed'

function getDismissedVersion(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function setDismissedVersion(version: string) {
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(version)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
}

export default function VersionCheck() {
  const checked = useRef(false)

  useEffect(() => {
    if (checked.current) return
    checked.current = true

    fetch('/api/version')
      .then((res) => res.json())
      .then(
        (data: {
          updateAvailable: boolean
          latestVersion: string | null
          latestReleaseUrl: string | null
        }) => {
          if (!data.updateAvailable || !data.latestVersion || !data.latestReleaseUrl) return

          const dismissed = getDismissedVersion()
          if (dismissed === data.latestVersion) return

          toast('Update available', {
            description: `Chathouse v${data.latestVersion} is available.`,
            duration: Infinity,
            closeButton: true,
            action: {
              label: 'View release',
              onClick: () => {
                window.open(data.latestReleaseUrl!, '_blank')
              },
            },
            onDismiss: () => {
              setDismissedVersion(data.latestVersion!)
            },
          })
        },
      )
      .catch(() => {})
  }, [])

  return null
}
