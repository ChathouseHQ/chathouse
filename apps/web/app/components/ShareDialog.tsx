import {
  CopyIcon,
  PlusIcon,
  TrashIcon,
  EyeIcon,
  GitForkIcon,
  LinkIcon,
  SpinnerGapIcon,
  CheckIcon,
} from '@phosphor-icons/react'
import { useEffect, useCallback, useState } from 'react'
import { useFetcher } from 'react-router'

import { formatDate } from '~/lib/utils'
import { Modal, Switch, Text } from '~/ui'

interface SharedLink {
  id: string
  autoUpdate: boolean
  includeAttachments: boolean
  viewCount: number
  forkCount: number
  createdAt: string
}

interface ShareDialogProps {
  isOpen: boolean
  onClose: () => void
  chatId: string
  chatTitle: string
}

export function ShareDialog({ isOpen, onClose, chatId, chatTitle }: ShareDialogProps) {
  const fetcher = useFetcher<{ sharedLinks?: SharedLink[] }>()
  const actionFetcher = useFetcher()
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const links: SharedLink[] = fetcher.data?.sharedLinks ?? []
  const isLoading = fetcher.state === 'loading'

  useEffect(() => {
    if (isOpen) {
      fetcher.load(`/api/chat/${chatId}/share`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, chatId])

  const createLink = useCallback(() => {
    actionFetcher.submit(
      { intent: 'create' },
      {
        method: 'post',
        action: `/api/chat/${chatId}/share`,
        encType: 'application/json',
      },
    )
  }, [chatId, actionFetcher])

  const updateLink = useCallback(
    (linkId: string, field: 'autoUpdate' | 'includeAttachments', value: boolean) => {
      actionFetcher.submit(
        { intent: 'update', linkId, [field]: value },
        {
          method: 'post',
          action: `/api/chat/${chatId}/share`,
          encType: 'application/json',
        },
      )
    },
    [chatId, actionFetcher],
  )

  const deleteLink = useCallback(
    (linkId: string) => {
      actionFetcher.submit(
        { intent: 'delete', linkId },
        {
          method: 'post',
          action: `/api/chat/${chatId}/share`,
          encType: 'application/json',
        },
      )
    },
    [chatId, actionFetcher],
  )

  useEffect(() => {
    if (actionFetcher.state === 'idle' && actionFetcher.data) {
      fetcher.load(`/api/chat/${chatId}/share`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFetcher.state, actionFetcher.data, chatId])

  const copyToClipboard = useCallback(async (linkId: string) => {
    const url = `${window.location.origin}/share/${linkId}`
    await navigator.clipboard.writeText(url)
    setCopiedId(linkId)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="w-full max-w-lg">
      <div className="rounded-xl bg-white shadow-2xl">
        <div className="border-b border-stone-100 px-6 pt-6 pb-4">
          <Text as="h2" size="lg" weight="semibold">
            Share &ldquo;{chatTitle}&rdquo;?
          </Text>
          <Text as="p" size="sm" colour="muted" className="mt-1">
            Generate a public link to share this conversation. Anyone with the link can read it.
          </Text>
        </div>

        <div className="px-6 py-4">
          <div className="mb-4 flex justify-end">
            <button
              onClick={createLink}
              disabled={actionFetcher.state !== 'idle'}
              className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50"
            >
              <PlusIcon className="h-4 w-4" />
              New Link
            </button>
          </div>

          {isLoading && links.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <SpinnerGapIcon className="h-5 w-5 animate-spin text-stone-400" />
            </div>
          )}

          {!isLoading && links.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <LinkIcon className="h-8 w-8 text-stone-300" />
              <Text size="sm" colour="muted">
                No share links yet. Create one to get started.
              </Text>
            </div>
          )}

          <div className="max-h-[50vh] space-y-3 overflow-y-auto">
            {links.map((link) => (
              <SharedLinkCard
                key={link.id}
                link={link}
                copiedId={copiedId}
                onCopy={copyToClipboard}
                onUpdate={updateLink}
                onDelete={deleteLink}
              />
            ))}
          </div>
        </div>

        {links.length > 0 && (
          <div className="border-t border-stone-100 px-6 py-4">
            <button
              onClick={() => copyToClipboard(links[0].id)}
              className="bg-primary-600 hover:bg-primary-700 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors"
            >
              {copiedId === links[0].id ? (
                <>
                  <CheckIcon className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <CopyIcon className="h-4 w-4" />
                  Copy Link
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

function SharedLinkCard({
  link,
  copiedId,
  onCopy,
  onUpdate,
  onDelete,
}: {
  link: SharedLink
  copiedId: string | null
  onCopy: (id: string) => void
  onUpdate: (id: string, field: 'autoUpdate' | 'includeAttachments', value: boolean) => void
  onDelete: (id: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/share/${link.id}`
      : `/share/${link.id}`

  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50/50">
      <div className="flex items-center gap-3 px-4 py-3">
        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-600 decoration-primary-300 hover:text-primary-700 min-w-0 flex-1 truncate font-mono text-sm underline"
        >
          {shareUrl}
        </a>

        <Text size="xs" colour="muted" className="shrink-0">
          {formatDate(link.createdAt)}
        </Text>

        <div className="flex shrink-0 items-center gap-2 text-stone-400">
          <span className="flex items-center gap-1" title="Views">
            <EyeIcon className="h-3.5 w-3.5" />
            <Text size="xs" colour="muted">
              {link.viewCount}
            </Text>
          </span>
          <span className="flex items-center gap-1" title="Forks">
            <GitForkIcon className="h-3.5 w-3.5" />
            <Text size="xs" colour="muted">
              {link.forkCount}
            </Text>
          </span>
        </div>

        <button
          onClick={() => onCopy(link.id)}
          className="shrink-0 rounded p-1 text-stone-400 transition-colors hover:bg-stone-200 hover:text-stone-600"
          title="Copy link"
        >
          {copiedId === link.id ? (
            <CheckIcon className="h-4 w-4 text-green-500" />
          ) : (
            <CopyIcon className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="space-y-3 border-t border-stone-200 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Text size="sm" weight="medium">
              Auto-update
            </Text>
            <Text as="p" size="xs" colour="muted">
              Automatically update when the thread changes.
            </Text>
          </div>
          <Switch
            checked={link.autoUpdate}
            onChange={(v) => onUpdate(link.id, 'autoUpdate', v)}
            size="sm"
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Text size="sm" weight="medium">
              Include attachments
            </Text>
            <Text as="p" size="xs" colour="muted">
              Allow viewers to see attachments. When disabled, only filenames are shown.
            </Text>
          </div>
          <Switch
            checked={link.includeAttachments}
            onChange={(v) => onUpdate(link.id, 'includeAttachments', v)}
            size="sm"
          />
        </div>
      </div>

      <div className="flex justify-end border-t border-stone-200 px-4 py-3">
        <button
          onClick={() => {
            if (confirmDelete) {
              onDelete(link.id)
              setConfirmDelete(false)
            } else {
              setConfirmDelete(true)
            }
          }}
          onBlur={() => setConfirmDelete(false)}
          className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
        >
          <TrashIcon className="h-4 w-4" />
          {confirmDelete ? 'Are you sure?' : 'Delete'}
        </button>
      </div>
    </div>
  )
}
