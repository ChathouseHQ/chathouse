import { InfoIcon } from '@phosphor-icons/react'
import { useLoaderData } from 'react-router'

import { getVersionInfo } from '~/lib/version.server'
import { TabHeader } from '~/ui'

export function meta() {
  return [{ title: 'About - Chathouse' }]
}

export async function loader() {
  return await getVersionInfo()
}

export default function AboutSettingsPage() {
  const { currentVersion, latestVersion, latestReleaseUrl, updateAvailable } =
    useLoaderData<typeof loader>()

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <TabHeader
        icon={InfoIcon}
        label="About"
        description="Learn more about Chathouse"
        iconColorClass="text-stone-500"
      />

      <div className="text-surface-900 mt-8 space-y-4 text-sm leading-relaxed">
        <p>
          Chathouse is an open-source, self-hosted AI chat application. Connect your own API keys
          and use models from OpenAI, Anthropic, Google, and others from a single interface.
        </p>

        <p>
          <a
            href="https://github.com/ChathouseHQ/chathouse"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-900 decoration-primary-300 hover:decoration-primary-600 underline"
          >
            GitHub
          </a>
          {' · '}
          <a
            href="/discord"
            className="text-primary-900 decoration-primary-300 hover:decoration-primary-600 underline"
          >
            Discord
          </a>
          {' · '}
          <a
            href="https://chathou.se/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-900 decoration-primary-300 hover:decoration-primary-600 underline"
          >
            Documentation
          </a>
        </p>

        <p className="text-surface-600 pt-4">
          v{currentVersion}
          {updateAvailable && latestVersion && latestReleaseUrl && (
            <>
              {' - '}
              <a
                href={latestReleaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-600 underline decoration-amber-300 hover:decoration-amber-600"
              >
                v{latestVersion} available
              </a>
            </>
          )}
          {!updateAvailable && latestVersion && <span> (up to date)</span>}
        </p>
      </div>
    </div>
  )
}
